from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [

    # ============================================================
    # AUTHENTICATION
    # ============================================================
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),


    # ============================================================
    # TWO-FACTOR AUTHENTICATION (2FA) - TOTP + Email Fallback
    # ============================================================
    path("2fa/setup/", views.TwoFactorSetupView.as_view(), name="2fa-setup"),
    path("2fa/verify/", views.TwoFactorVerifyView.as_view(), name="2fa-verify"),
    path("2fa/email-fallback/", views.TwoFactorEmailFallbackView.as_view(), name="2fa-email-fallback"), # ✅ NEW: Sends TOTP code via Email
    path("2fa/login/", views.TwoFactorLoginView.as_view(), name="2fa-login"),
    path("otp/toggle/", views.OTPToggleView.as_view(), name="otp-toggle"), # ✅ Consolidated (Removed duplicate)


    # ============================================================
    # OTP (Email OTP for Login/Register/Profile)
    # ============================================================
    path("otp/send/", views.OTPSendView.as_view(), name="otp-send"),
    path("otp/request/", views.OTPSendView.as_view(), name="otp-request"),
    path("otp/verify/", views.OTPVerifyView.as_view(), name="otp-verify"),


    # ============================================================
    # ✅ NEW: FORGOT PASSWORD (Username + Email Flow)
    # ============================================================
    path("forgot-password/", views.ForgotPasswordRequestView.as_view(), name="forgot-password"),
    path("forgot-password/verify/", views.ForgotPasswordVerifyView.as_view(), name="forgot-password-verify"),
    path("forgot-password/reset/", views.ForgotPasswordResetView.as_view(), name="forgot-password-reset"),


    # ============================================================
    # USER & PROFILE
    # ============================================================
    path("me/", views.me, name="me"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("settings/", views.SettingsView.as_view(), name="settings"),
    path("password/change/", views.ChangePasswordView.as_view(), name="change-password"),


    # ============================================================
    # NOTIFICATIONS
    # ============================================================
    path("notifications/", views.NotificationListView.as_view(), name="notifications"),
    path("notifications/<uuid:pk>/read/", views.mark_notification_read, name="mark-notification-read"),
    path("notifications/read-all/", views.mark_all_notifications_read, name="mark-all-notifications-read"),
    path("push-subscription/", views.PushSubscriptionView.as_view(), name="push-subscription"),


    # ============================================================
    # GOOGLE OAUTH
    # ============================================================
    path("google/", views.oauth_redirect, {"provider": "google"}, name="google-auth"),
    path("google/callback/", views.google_callback, name="google-callback"),


    # ============================================================
    # GITHUB OAUTH
    # ============================================================
    path("github/", views.oauth_redirect, {"provider": "github"}, name="github-auth"),
    path("github/callback/", views.github_callback, name="github-callback"),


    # ============================================================
    # ✅ ACCOUNT ACTIVITY & DANGER ZONE
    # ============================================================
    path("account/activity/", views.AccountActivityListView.as_view(), name="account-activity"),
    path("account/reset-settings/", views.ResetSettingsView.as_view(), name="reset-settings"),
    path("account/delete/", views.DeleteAccountView.as_view(), name="delete-account"),

]