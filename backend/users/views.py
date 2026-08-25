import json
import urllib.parse
import logging
import requests
import pyotp
import random

from django.conf import settings
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.shortcuts import redirect
from django.views.decorators.http import require_GET
from django.utils import timezone
from datetime import timedelta

from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import (
    User,
    Notification,
    PushSubscription,
    AccountActivity,
    OTP,  # ✅ NEW: Added OTP model
)

from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    OTPSendSerializer,
    OTPVerifySerializer,
    SocialAuthSerializer,
    UserProfileSerializer,
    ProfileUpdateSerializer,
    ChangePasswordSerializer,
    TokenSerializer,
    NotificationSerializer,
    TwoFactorSetupSerializer,
    TwoFactorLoginSerializer,
    AccountActivitySerializer,
    # ✅ NEW: Added Forgot Password Serializers
    ForgotPasswordRequestSerializer,
    ForgotPasswordVerifySerializer,
    ForgotPasswordResetSerializer,
)

from .email_utils import send_otp_email

User = get_user_model()
logger = logging.getLogger(__name__)


# ============================================================
# HELPERS
# ============================================================

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def get_client_ip(request):
    """Safely get the real client IP."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_user_activity(user, action, request):
    """Creates an AccountActivity record. Activity logging must NEVER break the main request."""
    try:
        AccountActivity.objects.create(
            user=user,
            action=str(action).strip()[:100],
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )
    except Exception as exc:
        logger.warning(
            "Account activity logging failed for user %s: %s",
            getattr(user, "pk", "unknown"),
            exc,
        )


def generate_unique_username(base_username, user_model=None):
    """Generate a unique username for OAuth accounts."""
    UserModel = user_model or get_user_model()
    base_username = str(base_username or "user").strip().lower()
    cleaned = "".join(char for char in base_username if char.isalnum() or char in "._-")
    if not cleaned:
        cleaned = "user"
    cleaned = cleaned[:145]
    candidate = cleaned

    if not UserModel.objects.filter(username__iexact=candidate).exists():
        return candidate

    counter = 1
    while True:
        suffix = str(counter)
        candidate = f"{cleaned[:150 - len(suffix)]}{suffix}"
        if not UserModel.objects.filter(username__iexact=candidate).exists():
            return candidate
        counter += 1


def get_or_create_oauth_user(
    *,
    email,
    provider,
    username_base,
    first_name="",
    last_name="",
    avatar=None,
):
    """Find an existing account by email or safely create a new OAuth user."""
    normalized_email = str(email).lower().strip()
    user = User.objects.filter(email__iexact=normalized_email).first()
    created = False

    if user:
        update_fields = []
        if user.auth_provider != provider:
            user.auth_provider = provider
            update_fields.append("auth_provider")
        if not user.is_verified:
            user.is_verified = True
            update_fields.append("is_verified")
        if not user.avatar and avatar:
            user.avatar = avatar
            update_fields.append("avatar")
        if not user.first_name and first_name:
            user.first_name = first_name
            update_fields.append("first_name")
        if not user.last_name and last_name:
            user.last_name = last_name
            update_fields.append("last_name")

        if update_fields:
            user.save(update_fields=list(dict.fromkeys(update_fields)))
        return user, created

    unique_username = generate_unique_username(username_base, User)
    user = User.objects.create(
        email=normalized_email,
        username=unique_username,
        first_name=first_name or "",
        last_name=last_name or "",
        auth_provider=provider,
        avatar=avatar or "",
        is_verified=True,
    )
    created = True
    return user, created


def send_user_otp(user, email, purpose):
    """Generate and send a 6-digit TOTP."""
    try:
        if not user.otp_secret:
            user.otp_secret = pyotp.random_base32()
            user.save(update_fields=["otp_secret"])

        totp = pyotp.TOTP(user.otp_secret, interval=300)
        otp_code = totp.now()

        email_sent, email_error = send_otp_email(
            to_email=email,
            otp_code=otp_code,
            purpose=purpose,
            user_name=user.get_full_name(),
        )

        if not email_sent:
            logger.error("OTP email failed: %s", email_error)
            return False, email_error

        return True, None
    except Exception as exc:
        logger.exception("OTP generation/send failed: %s", exc)
        return False, str(exc)


# ✅ NEW: Helper specifically for Forgot Password (Random 6-digit DB OTP)
def send_forgot_password_otp(user, email):
    """Generate and send a random 6-digit OTP for password reset."""
    try:
        otp_code = str(random.randint(100000, 999999))
        
        # Clean up old unused password reset OTPs for this user
        OTP.objects.filter(user=user, purpose='password_reset', is_used=False).delete()
        
        # Create new OTP record valid for 10 minutes
        OTP.objects.create(
            user=user,
            otp_code=otp_code,
            purpose='password_reset',
            expires_at=timezone.now() + timedelta(minutes=10)
        )
        
        # Send email using existing utility
        email_sent, email_error = send_otp_email(
            to_email=email,
            otp_code=otp_code,
            purpose='password_reset',
            user_name=user.get_full_name() or user.username
        )
        
        if not email_sent:
            logger.error("Forgot password OTP email failed: %s", email_error)
            return False, email_error
        
        return True, None
    except Exception as exc:
        logger.exception("Forgot password OTP generation/send failed: %s", exc)
        return False, str(exc)


# ============================================================
# NOTIFICATION HELPER
# ============================================================

def create_notification(user, title, message, notification_type="info", link=None):
    """Create a notification if notifications are enabled."""
    try:
        if hasattr(user, "notifications_enabled") and not user.notifications_enabled:
            return None
        return Notification.objects.create(
            user=user,
            title=title,
            message=message,
            type=notification_type,
            link=link,
        )
    except Exception as exc:
        logger.error("Failed to create notification: %s", exc)
        return None


# ============================================================
# OAUTH REDIRECTS
# ============================================================

@require_GET
def google_login(request):
    frontend_redirect = request.GET.get("redirect_uri", "http://localhost:3000/login")
    request.session["oauth_redirect_uri"] = frontend_redirect

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{settings.BACKEND_URL}/api/auth/google/callback/",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return redirect(auth_url)


@require_GET
def github_login(request):
    frontend_redirect = request.GET.get("redirect_uri", "http://localhost:3000/login")
    request.session["oauth_redirect_uri"] = frontend_redirect

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"{settings.BACKEND_URL}/api/auth/github/callback/",
        "scope": "user:email read:user",
    }
    auth_url = "https://github.com/login/oauth/authorize?" + urllib.parse.urlencode(params)
    return redirect(auth_url)


@require_GET
def oauth_redirect(request, provider):
    if provider == "google":
        return google_login(request)
    if provider == "github":
        return github_login(request)
    return Response({"success": False, "message": "Unknown provider."}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# GOOGLE CALLBACK
# ============================================================

@api_view(["GET"])
@permission_classes([AllowAny])
def google_callback(request):
    code = request.GET.get("code")
    frontend_redirect = request.session.get("oauth_redirect_uri", "http://localhost:3000/login")

    if not code:
        return redirect(f"{frontend_redirect}?error=Google+auth+failed")

    try:
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.BACKEND_URL}/api/auth/google/callback/",
                "grant_type": "authorization_code",
            },
            timeout=20,
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            return redirect(f"{frontend_redirect}?error=Google+token+missing")

        user_info_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20,
        )
        user_info_response.raise_for_status()
        user_info = user_info_response.json()
    except Exception as exc:
        logger.exception("Google authentication failed: %s", exc)
        return redirect(f"{frontend_redirect}?error=Google+auth+failed")

    email = str(user_info.get("email", "")).lower().strip()
    if not email:
        return redirect(f"{frontend_redirect}?error=Email+not+provided")

    first_name = user_info.get("given_name", "") or ""
    last_name = user_info.get("family_name", "") or ""
    username_base = user_info.get("name") or email.split("@")[0]

    try:
        user, created = get_or_create_oauth_user(
            email=email,
            provider="google",
            username_base=username_base,
            first_name=first_name,
            last_name=last_name,
            avatar=user_info.get("picture"),
        )
    except Exception as exc:
        logger.exception("Google user creation failed: %s", exc)
        return redirect(f"{frontend_redirect}?error=Google+account+creation+failed")

    tokens = get_tokens_for_user(user)
    log_user_activity(user, "Google account registered" if created else "Successful Google login", request)

    user_data = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "name": user.get_full_name() or email.split("@")[0],
        "avatar": user.avatar if getattr(user, "avatar", None) else None,
    }

    return redirect(
        f"{frontend_redirect}"
        f"?access_token={tokens['access']}"
        f"&refresh_token={tokens['refresh']}"
        f"&user={urllib.parse.quote(json.dumps(user_data))}"
    )


# ============================================================
# GITHUB CALLBACK
# ============================================================

@api_view(["GET"])
@permission_classes([AllowAny])
def github_callback(request):
    code = request.GET.get("code")
    frontend_redirect = request.session.get("oauth_redirect_uri", "http://localhost:3000/login")

    if not code:
        return redirect(f"{frontend_redirect}?error=GitHub+auth+failed")

    try:
        token_res = requests.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": f"{settings.BACKEND_URL}/api/auth/github/callback/",
            },
            headers={"Accept": "application/json"},
            timeout=20,
        )
        token_res.raise_for_status()
        token_data = token_res.json()
        access_token = token_data.get("access_token")

        if not access_token:
            return redirect(f"{frontend_redirect}?error=GitHub+token+missing")

        headers = {"Authorization": f"token {access_token}"}
        user_response = requests.get("https://api.github.com/user", headers=headers, timeout=20)
        user_response.raise_for_status()
        user_info = user_response.json()

        email = user_info.get("email")
        if not email:
            emails_response = requests.get("https://api.github.com/user/emails", headers=headers, timeout=20)
            emails_response.raise_for_status()
            emails_data = emails_response.json()
            if isinstance(emails_data, list):
                email = next(
                    (item.get("email") for item in emails_data if item.get("primary") and item.get("verified", True)),
                    emails_data[0].get("email") if emails_data else None,
                )
    except Exception as exc:
        logger.exception("GitHub authentication failed: %s", exc)
        return redirect(f"{frontend_redirect}?error=GitHub+auth+failed")

    if not email:
        return redirect(f"{frontend_redirect}?error=Email+not+provided")

    email = email.lower().strip()
    name = user_info.get("name") or user_info.get("login") or email.split("@")[0]
    name_parts = name.split()
    first_name = name_parts[0] if name_parts else ""
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    username_base = user_info.get("login") or email.split("@")[0]

    try:
        user, created = get_or_create_oauth_user(
            email=email,
            provider="github",
            username_base=username_base,
            first_name=first_name,
            last_name=last_name,
            avatar=user_info.get("avatar_url"),
        )
    except Exception as exc:
        logger.exception("GitHub user creation failed: %s", exc)
        return redirect(f"{frontend_redirect}?error=GitHub+account+creation+failed")

    tokens = get_tokens_for_user(user)
    log_user_activity(user, "GitHub account registered" if created else "Successful GitHub login", request)

    user_data = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "name": user.get_full_name() or email.split("@")[0],
        "avatar": user.avatar if getattr(user, "avatar", None) else None,
    }

    return redirect(
        f"{frontend_redirect}"
        f"?access_token={tokens['access']}"
        f"&refresh_token={tokens['refresh']}"
        f"&user={urllib.parse.quote(json.dumps(user_data))}"
    )


# ============================================================
# REGISTER
# ============================================================

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "message": "Registration failed.", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        email_sent, email_error = send_user_otp(user=user, email=user.email, purpose="register")

        if not email_sent:
            logger.error("Registration OTP failed: %s", email_error)

        log_user_activity(user, "Account created", request)

        return Response(
            {
                "success": True,
                "message": "Account created. Please verify with the OTP sent to your email.",
                "requires_otp": True,
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# LOGIN
# ============================================================

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]

            if getattr(user, "otp_enabled", False):
                log_user_activity(user, "Login attempt - 2FA required", request)
                return Response(
                    {
                        "success": True,
                        "message": "Two-factor authentication required.",
                        "requires_2fa": True,
                        "email": user.email,
                    },
                    status=status.HTTP_200_OK,
                )

            email_sent, email_error = send_user_otp(user=user, email=user.email, purpose="login")
            if not email_sent:
                return Response(
                    {"success": False, "message": "Unable to send OTP email.", "error": str(email_error)},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            return Response(
                {"success": True, "message": "OTP sent to your email.", "requires_otp": True, "email": user.email},
                status=status.HTTP_200_OK,
            )

        error_message = "Invalid email or password."
        if serializer.errors:
            first_key = next(iter(serializer.errors))
            first_error = serializer.errors[first_key]
            if isinstance(first_error, list) and first_error:
                error_message = str(first_error[0])
            else:
                error_message = str(first_error)

        return Response({"success": False, "message": error_message, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# 2FA SETUP
# ============================================================

class TwoFactorSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.otp_secret:
            user.otp_secret = pyotp.random_base32()
            user.save(update_fields=["otp_secret"])

        uri = pyotp.totp.TOTP(user.otp_secret).provisioning_uri(name=user.email, issuer_name="Quill")
        return Response({"success": True, "data": {"secret": user.otp_secret, "uri": uri}})


# ============================================================
# 2FA VERIFY / ENABLE
# ============================================================

class TwoFactorVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TwoFactorSetupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        otp_code = serializer.validated_data["otp_code"]

        if not user.otp_secret:
            return Response({"success": False, "message": "2FA not initialized. Please setup first."}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(user.otp_secret)
        if totp.verify(otp_code, valid_window=1):
            user.otp_enabled = True
            user.otp_verified = True
            user.save(update_fields=["otp_enabled", "otp_verified"])
            log_user_activity(user, "Two-Factor Authentication enabled", request)
            return Response({"success": True, "message": "Two-factor authentication enabled successfully."})

        return Response({"success": False, "message": "Invalid 2FA code. Please try again."}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# 2FA EMAIL FALLBACK
# ============================================================

class TwoFactorEmailFallbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.otp_secret:
            return Response({"success": False, "message": "2FA is not setup."}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(user.otp_secret)
        current_code = totp.now()

        email_sent, error = send_otp_email(
            to_email=user.email,
            otp_code=current_code,
            purpose="2fa_fallback",
            user_name=user.get_full_name() or user.email.split("@")[0],
        )

        if email_sent:
            log_user_activity(user, "2FA fallback code sent to email", request)
            return Response({"success": True, "message": "Code sent to your email."})

        return Response({"success": False, "message": f"Email failed: {error}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# OTP TOGGLE
# ============================================================

class OTPToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        action = request.data.get("action")

        if action == "enable":
            if not user.otp_secret:
                user.otp_secret = pyotp.random_base32()
            user.otp_enabled = True
            user.otp_verified = True
            user.save(update_fields=["otp_secret", "otp_enabled", "otp_verified"])
            log_user_activity(user, "Two-Factor Authentication enabled", request)
            return Response({"success": True, "message": "Two-factor authentication enabled successfully."})

        if action == "disable":
            user.otp_enabled = False
            user.otp_verified = False
            user.otp_secret = None
            user.save(update_fields=["otp_enabled", "otp_verified", "otp_secret"])
            log_user_activity(user, "Two-Factor Authentication disabled", request)
            return Response({"success": True, "message": "Two-factor authentication disabled successfully."})

        return Response({"success": False, "message": "Invalid action. Use enable or disable."}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# 2FA LOGIN
# ============================================================

class TwoFactorLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TwoFactorLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"].lower().strip()
        password = serializer.validated_data["password"]
        otp_code = serializer.validated_data["otp_code"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"success": False, "message": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(password):
            return Response({"success": False, "message": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.otp_enabled:
            return Response({"success": False, "message": "2FA is not enabled for this account."}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(user.otp_secret)
        if not totp.verify(otp_code, valid_window=1):
            return Response({"success": False, "message": "Invalid 2FA code."}, status=status.HTTP_400_BAD_REQUEST)

        tokens = get_tokens_for_user(user)
        log_user_activity(user, "Successful login with 2FA", request)

        return Response({"success": True, "message": "Login successful.", "data": tokens})


# ============================================================
# OTP REQUEST / SEND
# ============================================================

class OTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPSendSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        purpose = request.data.get("purpose", "login")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"success": False, "message": "No account found with this email."}, status=status.HTTP_404_NOT_FOUND)

        email_sent, email_error = send_user_otp(user=user, email=email, purpose=purpose)
        if not email_sent:
            return Response({"success": False, "message": "Unable to send OTP email.", "error": str(email_error)}, status=status.HTTP_502_BAD_GATEWAY)

        if purpose in {"login", "register"}:
            log_user_activity(user, "Login OTP requested" if purpose == "login" else "Registration OTP requested", request)

        return Response({"success": True, "message": "OTP sent successfully."})


class OTPSendView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        purpose = request.data.get("purpose", "login")

        if not email:
            return Response({"success": False, "message": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"success": False, "message": "No account found with this email."}, status=status.HTTP_404_NOT_FOUND)

        email_sent, email_error = send_user_otp(user=user, email=email, purpose=purpose)
        if not email_sent:
            return Response({"success": False, "message": "Unable to send OTP email.", "error": str(email_error)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"success": True, "message": "OTP sent successfully."})


# ============================================================
# OTP VERIFY
# ============================================================

class OTPVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data.get("email")
        otp_code = str(serializer.validated_data.get("otp_code", "")).strip()
        purpose = request.data.get("purpose", "login")
        new_email = request.data.get("new_email")

        if purpose == "email_change":
            if not request.user.is_authenticated:
                return Response({"success": False, "message": "Authentication is required for email change."}, status=status.HTTP_401_UNAUTHORIZED)
            user = request.user
        else:
            if not email:
                return Response({"success": False, "message": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                return Response({"success": False, "message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not user.otp_secret:
            return Response({"success": False, "message": "No OTP has been requested."}, status=status.HTTP_400_BAD_REQUEST)

        totp = pyotp.TOTP(user.otp_secret, interval=300)
        if not totp.verify(otp_code, valid_window=2):
            return Response({"success": False, "message": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        if purpose == "email_change":
            if not new_email:
                return Response({"success": False, "message": "New email is required."}, status=status.HTTP_400_BAD_REQUEST)
            normalized_new_email = str(new_email).lower().strip()
            if User.objects.filter(email__iexact=normalized_new_email).exclude(pk=user.pk).exists():
                return Response({"success": False, "message": "This email is already registered."}, status=status.HTTP_400_BAD_REQUEST)
            user.email = normalized_new_email
            user.save(update_fields=["email"])
            log_user_activity(user, "Email address changed", request)
            return Response({"success": True, "message": "Email changed successfully.", "data": UserProfileSerializer(user).data})

        if purpose == "register":
            user.is_verified = True
            user.save(update_fields=["is_verified"])
            log_user_activity(user, "Account email verified", request)
        elif purpose == "login":
            log_user_activity(user, "Successful login", request)

        tokens = get_tokens_for_user(user)
        return Response({"success": True, "message": "OTP verified successfully.", "data": tokens})


# ============================================================
# ✅ NEW: FORGOT PASSWORD FLOW (3 Steps)
# ============================================================

class ForgotPasswordRequestView(APIView):
    """Step 1: User provides Username and Email to request an OTP."""
    permission_classes = [AllowAny]

    def post(self, request):
        # 🔍 DEBUG: Dekhne ke liye ki frontend kya bhej raha hai
        print("🔍 DEBUG: Received Forgot Password Data:", request.data)
        
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        if not serializer.is_valid():
            # ❌ DEBUG: Exact error jo fail kar raha hai
            print("❌ DEBUG: Serializer Validation Errors:", serializer.errors)
            
            return Response({
                "success": False, 
                "message": "Validation failed",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']
        email = serializer.validated_data['email']

        email_sent, error = send_forgot_password_otp(user, email)
        if not email_sent:
            return Response({"success": False, "message": "Unable to send OTP email.", "error": str(error)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"success": True, "message": "OTP sent to your registered email."})


class ForgotPasswordVerifyView(APIView):
    """Step 2: User provides Username, Email, and the OTP code received."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data['username']
        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']

        try:
            user = User.objects.get(username__iexact=username, email__iexact=email)
        except User.DoesNotExist:
            return Response({"success": False, "message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check if OTP is valid (We mark it used in the Reset step to prevent race conditions)
        otp_obj = OTP.objects.filter(
            user=user,
            otp_code=otp_code,
            purpose='password_reset',
            is_used=False,
            expires_at__gt=timezone.now()
        ).first()

        if not otp_obj:
            return Response({"success": False, "message": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"success": True, "message": "OTP verified successfully. You can now reset your password."})


class ForgotPasswordResetView(APIView):
    """Step 3: User provides Username, Email, OTP, and the New Password."""
    permission_classes = [AllowAny]

    def post(self, request):
        # 🔍 DEBUG: Dekhne ke liye ki frontend kya bhej raha hai
        print("🔍 DEBUG Reset: Received Data:", request.data)
        
        serializer = ForgotPasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            # ❌ DEBUG: Exact error jo fail kar raha hai
            print("❌ DEBUG Reset: Serializer Errors:", serializer.errors)
            
            return Response({
                "success": False, 
                "message": "Validation failed",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data['username']
        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        try:
            user = User.objects.get(username__iexact=username, email__iexact=email)
        except User.DoesNotExist:
            return Response({"success": False, "message": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Verify OTP again for security and mark it as used
        otp_obj = OTP.objects.filter(
            user=user,
            otp_code=otp_code,
            purpose='password_reset',
            is_used=False,
            expires_at__gt=timezone.now()
        ).first()

        if not otp_obj:
            return Response({"success": False, "message": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        # Reset password
        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Consume the OTP
        otp_obj.is_used = True
        otp_obj.save()

        log_user_activity(user, "Password reset successfully", request)

        return Response({"success": True, "message": "Password reset successfully. Please login with your new password."})


# ============================================================
# PROFILE
# ============================================================

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response({"success": True, "data": serializer.data})

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        new_email = serializer.validated_data.get("email")
        if new_email and new_email != request.user.email:
            return Response(
                {"success": True, "requires_otp": True, "message": "OTP verification required for email change.", "new_email": new_email}
            )

        serializer.save()
        changed_fields = [field for field in serializer.validated_data if field in {"first_name", "last_name", "email", "avatar", "bio"}]
        log_user_activity(request.user, "Profile updated: " + ", ".join(changed_fields) if changed_fields else "Profile information updated", request)

        return Response({"success": True, "message": "Profile updated successfully.", "data": UserProfileSerializer(request.user).data})


# ============================================================
# USER SETTINGS
# ============================================================

class SettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response({"success": True, "data": serializer.data})

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        log_user_activity(request.user, "Account settings updated", request)
        return Response({"success": True, "message": "Settings saved successfully.", "data": UserProfileSerializer(request.user).data})


# ============================================================
# CHANGE PASSWORD
# ============================================================

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response({"success": False, "message": "Password change failed.", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        update_session_auth_hash(request, user)
        log_user_activity(user, "Password changed successfully", request)

        return Response({"success": True, "message": "Password changed successfully."})


# ============================================================
# LOGOUT
# ============================================================

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        log_user_activity(user, "Logged out", request)

        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({"success": True, "message": "Logged out successfully."})
        except TokenError:
            return Response({"success": False, "message": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# NOTIFICATIONS
# ============================================================

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        unread_count = queryset.filter(is_read=False).count()
        serializer = self.get_serializer(queryset[:20], many=True)
        return Response({"success": True, "unread_count": unread_count, "data": serializer.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, pk):
    try:
        notification = Notification.objects.get(pk=pk, user=request.user)
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response({"success": True, "message": "Marked as read."})
    except Notification.DoesNotExist:
        return Response({"success": False, "message": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({"success": True, "message": "All notifications marked as read."})


# ============================================================
# ME
# ============================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserProfileSerializer(request.user)
    return Response({"success": True, "data": serializer.data})


# ============================================================
# PUSH SUBSCRIPTION
# ============================================================

class PushSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get("endpoint")
        p256dh = request.data.get("keys", {}).get("p256dh")
        auth = request.data.get("keys", {}).get("auth")

        if not all([endpoint, p256dh, auth]):
            return Response({"success": False, "message": "Invalid subscription data."}, status=status.HTTP_400_BAD_REQUEST)

        PushSubscription.objects.update_or_create(
            user=request.user,
            endpoint=endpoint,
            defaults={"p256dh": p256dh, "auth": auth},
        )
        log_user_activity(request.user, "Push notifications enabled", request)
        return Response({"success": True, "message": "Push subscription saved."})

    def delete(self, request):
        endpoint = request.data.get("endpoint")
        if endpoint:
            PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        log_user_activity(request.user, "Push notifications disabled", request)
        return Response({"success": True, "message": "Push subscription removed."})


# ============================================================
# ACCOUNT ACTIVITY
# ============================================================

class AccountActivityListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        activities = AccountActivity.objects.filter(user=request.user).order_by("-created_at")[:50]
        serializer = AccountActivitySerializer(activities, many=True)
        return Response({"success": True, "count": len(serializer.data), "data": serializer.data})


# ============================================================
# RESET USER SETTINGS
# ============================================================

class ResetSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.theme = "system"
        user.auto_save = True
        user.cache_size = "medium"
        user.export_format = "pdf"
        user.font_size = "medium"
        user.compact_mode = False
        user.show_animations = True
        user.email_notifications = True
        user.push_notifications = False
        user.translation_complete = True
        user.weekly_report = False
        user.share_usage_data = False
        user.allow_analytics = True
        user.save(
            update_fields=[
                "theme", "auto_save", "cache_size", "export_format", "font_size", "compact_mode",
                "show_animations", "email_notifications", "push_notifications", "translation_complete",
                "weekly_report", "share_usage_data", "allow_analytics",
            ]
        )
        log_user_activity(user, "Account settings reset to default", request)
        return Response({"success": True, "message": "Settings reset to default successfully."})


# ============================================================
# DELETE ACCOUNT
# ============================================================

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        log_user_activity(user, "Account deleted", request)
        user.delete()
        return Response({"success": True, "message": "Account deleted successfully."})