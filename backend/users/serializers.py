from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

# ✅ UPDATED: Import AccountActivity model
from .models import Notification, AccountActivity

User = get_user_model()


# ============================================================
# TOKEN SERIALIZER
# ============================================================

class TokenSerializer(serializers.Serializer):
    @staticmethod
    def get_tokens_for_user(user):
        refresh = RefreshToken.for_user(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "name": (
                    user.get_full_name()
                    or user.email.split("@")[0]
                ),
                "avatar": (
                    user.avatar
                    if hasattr(user, "avatar")
                    else None
                ),
                # ✅ Notification Preferences
                "email_notifications": getattr(user, 'email_notifications', True),
                "push_notifications": getattr(user, 'push_notifications', False),
                "translation_complete": getattr(user, 'translation_complete', True),
                "weekly_report": getattr(user, 'weekly_report', False),
                
                # ✅ NEW: Privacy & Security Preferences
                "share_usage_data": getattr(user, 'share_usage_data', False),
                "allow_analytics": getattr(user, 'allow_analytics', True),
                "two_factor_auth": getattr(user, 'otp_enabled', False),
                
                # ✅ NEW: Data & Storage Settings
                "auto_save": getattr(user, 'auto_save', True),
                "cache_size": getattr(user, 'cache_size', 'medium'),
                "export_format": getattr(user, 'export_format', 'pdf'),
                
                # ✅ NEW: Developer Mode & API Config (For cross-device sync)
                "developer_mode": getattr(user, 'developer_mode', False),
                "api_config": getattr(user, 'api_config', {}),
            },
        }


# ============================================================
# REGISTRATION
# ============================================================

class UserRegistrationSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
    )

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "password",
            "confirm_password",
        ]
        extra_kwargs = {
            "password": {
                "write_only": True,
            },
            "first_name": {
                "required": True,
            },
            "last_name": {
                "required": False,
            },
        }

    def validate_email(self, value):
        email = value.lower().strip()

        if User.objects.filter(
            email__iexact=email
        ).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )

        return email

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password":
                    "Passwords do not match."
                }
            )

        validate_password(
            attrs["password"]
        )

        return attrs

    def create(self, validated_data):
        validated_data.pop(
            "confirm_password",
            None,
        )

        email = validated_data["email"]

        base_username = email.split("@")[0]
        username = base_username
        counter = 1

        while User.objects.filter(
            username=username
        ).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data["password"],
            first_name=validated_data.get(
                "first_name",
                "",
            ),
            last_name=validated_data.get(
                "last_name",
                "",
            ),
            is_verified=True,
        )

        return user


# ============================================================
# LOGIN
# ============================================================

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=True
    )

    password = serializers.CharField(
        required=True,
        write_only=True,
    )

    def validate(self, attrs):
        email = (
            attrs.get("email")
            .lower()
            .strip()
        )

        password = attrs.get("password")

        try:
            user = User.objects.get(
                email__iexact=email
            )
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {
                    "email":
                    "No account found with this email."
                }
            )

        if not user.check_password(password):
            raise serializers.ValidationError(
                {
                    "password":
                    "Incorrect password."
                }
            )

        attrs["user"] = user

        return attrs


# ============================================================
# OTP SEND
# ============================================================

class OTPSendSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=False,
        help_text="Target email for OTP (defaults to user email)"
    )

    purpose = serializers.ChoiceField(
        choices=[
            ("login", "Login"),
            ("register", "Register"),
            ("email_change", "Email Change"),
            ("password_reset", "Password Reset"),
            ("profile_update", "Profile Update"),
        ],
        required=False,
        default="login",
    )

    def validate_email(self, value):
        if value:
            return value.lower().strip()
        return value


# ============================================================
# OTP VERIFY
# ============================================================

class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    otp_code = serializers.CharField(required=True, min_length=6, max_length=6)
    purpose = serializers.ChoiceField(
        choices=[
            ("login", "Login"),
            ("register", "Register"),
            ("email_change", "Email Change"),
            ("password_reset", "Password Reset"),
            ("profile_update", "Profile Update"),
        ],
        required=True,
    )
    new_email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        purpose = attrs.get("purpose")
        email = attrs.get("email")
        new_email = attrs.get("new_email")

        if purpose in ["login", "register"]:
            if not email:
                raise serializers.ValidationError({"email": "Email is required for login/register OTP verification."})
        
        if purpose == "email_change":
            if not new_email:
                raise serializers.ValidationError({"new_email": "New email is required for email change."})
            new_email = new_email.lower().strip()
            
        return attrs


# ============================================================
# SOCIAL AUTH
# ============================================================

class SocialAuthSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(
        choices=[
            "google",
            "github",
        ],
        required=True,
    )

    access_token = serializers.CharField(
        required=True
    )


# ============================================================
# PROFILE (Updated with Privacy, 2FA, Developer Mode & API Config)
# ============================================================

class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile including appearance, notification, privacy, developer mode & API config.
    """
    # Map otp_enabled to two_factor_auth for cleaner API response
    two_factor_auth = serializers.BooleanField(source='otp_enabled', read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "avatar",
            "auth_provider",
            # Appearance Settings
            "font_size",
            "compact_mode",
            "show_animations",
            # Existing preferences
            "theme",
            "language",
            "notifications_enabled",
            "auto_save",
            # Notification Preferences
            "email_notifications",
            "push_notifications",
            "translation_complete",
            "weekly_report",
            # ✅ Privacy & Security Preferences
            "share_usage_data",
            "allow_analytics",
            "two_factor_auth",
            # ✅ Data & Storage Settings
            "cache_size",
            "export_format",
            # ✅ NEW: Developer Mode & API Config (For cross-device sync)
            "developer_mode",
            "api_config",
        ]
        read_only_fields = [
            "id",
            "email",
            "username",
            "auth_provider",
            "two_factor_auth",  # Handled via dedicated 2FA endpoints
        ]

    def validate_first_name(self, value):
        return str(value).strip()

    def validate_last_name(self, value):
        return str(value).strip()


# ============================================================
# PROFILE UPDATE (For PATCH requests)
# ============================================================

class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile (name, email, appearance, notifications, privacy, developer mode & API config).
    """
    class Meta:
        model = User
        fields = [
            "email",
            "first_name",
            "last_name",
            # Appearance Settings
            "font_size",
            "compact_mode",
            "show_animations",
            # Existing preferences
            "theme",
            "language",
            "notifications_enabled",
            "auto_save",
            # Notification Preferences
            "email_notifications",
            "push_notifications",
            "translation_complete",
            "weekly_report",
            # ✅ Privacy Preferences
            "share_usage_data",
            "allow_analytics",
            # ✅ Data & Storage Settings
            "cache_size",
            "export_format",
            # ✅ NEW: Developer Mode & API Config
            "developer_mode",
            "api_config",
        ]

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate_first_name(self, value):
        return str(value).strip()

    def validate_last_name(self, value):
        return str(value).strip()

    def validate_font_size(self, value):
        if value not in ["small", "medium", "large"]:
            raise serializers.ValidationError("Font size must be 'small', 'medium', or 'large'.")
        return value

    def validate_cache_size(self, value):
        if value not in ["small", "medium", "large"]:
            raise serializers.ValidationError("Cache size must be 'small', 'medium', or 'large'.")
        return value

    def validate_export_format(self, value):
        if value not in ["txt", "html", "docx", "pdf"]:
            raise serializers.ValidationError("Export format must be 'txt', 'html', 'docx', or 'pdf'.")
        return value

    def validate_api_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("API config must be a JSON object.")
        return value


# ============================================================
# PASSWORD CHANGE
# ============================================================

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(
        required=True,
        write_only=True,
        help_text="Current password"
    )

    new_password = serializers.CharField(
        required=True,
        write_only=True,
        min_length=8,
        help_text="New password (min 8 characters)"
    )

    confirm_password = serializers.CharField(
        required=True,
        write_only=True,
        help_text="Confirm new password"
    )

    def validate_old_password(self, value):
        request = self.context.get("request")

        if not request or not request.user:
            raise serializers.ValidationError(
                "Authentication required."
            )

        if not request.user.check_password(value):
            raise serializers.ValidationError(
                "Current password is incorrect."
            )

        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password":
                    "New passwords do not match."
                }
            )

        validate_password(
            attrs["new_password"],
            self.context.get("request").user,
        )

        return attrs


# ============================================================
# ✅ NEW: FORGOT PASSWORD (Username + Email Flow)
# ============================================================

class ForgotPasswordRequestSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)

    def validate(self, attrs):
        username_input = str(attrs.get('username', '')).strip()
        email_input = str(attrs.get('email', '')).strip().lower()
        
        if not username_input or not email_input:
            raise serializers.ValidationError("Both username and email are required.")

        # 1. Pehle email se user dhundho
        try:
            user = User.objects.get(email__iexact=email_input)
        except User.DoesNotExist:
            raise serializers.ValidationError({
                "email": "No account found with this email address."
            })
        
        # 2. Check karo ki provided username, actual username YA email se match karta hai
        db_username = str(user.username).strip().lower()
        db_email = str(user.email).strip().lower()
        
        if username_input != db_username and username_input != db_email:
            raise serializers.ValidationError({
                "username": f"Username does not match. Your registered username is '{user.username}'."
            })
        
        attrs['user'] = user
        attrs['email'] = email_input
        return attrs


class ForgotPasswordVerifySerializer(serializers.Serializer):
    """
    Step 2: User provides Username, Email, and the OTP code received.
    """
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    otp_code = serializers.CharField(min_length=6, max_length=6, required=True)

    def validate(self, attrs):
        attrs['username'] = attrs.get('username', '').strip()
        attrs['email'] = attrs.get('email', '').lower().strip()
        return attrs


class ForgotPasswordResetSerializer(serializers.Serializer):
    """
    Step 3: User provides Username, Email, OTP, and the New Password.
    """
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    otp_code = serializers.CharField(min_length=6, max_length=6, required=True)
    new_password = serializers.CharField(required=True, min_length=8, write_only=True)

    def validate_new_password(self, value):
        # Validate password strength using Django's default validators
        validate_password(value)
        return value

    def validate(self, attrs):
        attrs['username'] = attrs.get('username', '').strip()
        attrs['email'] = attrs.get('email', '').lower().strip()
        return attrs


# ============================================================
# TWO-FACTOR AUTHENTICATION (2FA)
# ============================================================

class TwoFactorSetupSerializer(serializers.Serializer):
    """
    Used to verify the OTP code when enabling 2FA.
    The secret generation happens in the view.
    """
    otp_code = serializers.CharField(
        min_length=6, 
        max_length=6,
        help_text="Enter the 6-digit code from your authenticator app to enable 2FA."
    )


class TwoFactorLoginSerializer(serializers.Serializer):
    """
    Used for login when a user has 2FA enabled.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    otp_code = serializers.CharField(
        min_length=6, 
        max_length=6, 
        required=True,
        help_text="Enter the 6-digit code from your authenticator app."
    )


# ============================================================
# NOTIFICATION
# ============================================================

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "type",
            "is_read",
            "link",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]


# ============================================================
# ✅ NEW: ACCOUNT ACTIVITY
# ============================================================

class AccountActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountActivity
        fields = [
            "id",
            "action",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]