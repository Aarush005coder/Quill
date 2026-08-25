import uuid
import json

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone # ✅ Added for OTP expiry check

# ========================================================
# CUSTOM USER MODEL
# ========================================================
class User(AbstractUser):
    email = models.EmailField(unique=True)
    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
    )

    # ========================================================
    # OTP (TOTP / Google Authenticator)
    # ========================================================
    otp_secret = models.CharField(
        max_length=32,
        blank=True,
        null=True,
    )

    otp_enabled = models.BooleanField(
        default=False,
    )

    otp_verified = models.BooleanField(
        default=False,
    )

    # ========================================================
    # PROFILE
    # ========================================================
    first_name = models.CharField(
        max_length=150,
        blank=True,
    )

    last_name = models.CharField(
        max_length=150,
        blank=True,
    )

    avatar = models.URLField(
        blank=True,
        null=True,
    )

    bio = models.TextField(
        blank=True,
        null=True,
    )

    # ========================================================
    # PLAN
    # ========================================================
    plan = models.CharField(
        max_length=20,
        default="free",
    )

    monthly_translation_chars = models.PositiveIntegerField(
        default=0,
    )

    monthly_translation_limit = models.PositiveIntegerField(
        default=50000,
    )

    # ========================================================
    # PREFERENCES
    # ========================================================
    language = models.CharField(
        max_length=10,
        default="en",
    )

    theme = models.CharField(
        max_length=20,
        default="system",
    )

    notifications_enabled = models.BooleanField(
        default=True,
    )

    auto_save = models.BooleanField(
        default=True,
        help_text="Automatically save translation history"
    )

    # ✅ Appearance Settings
    font_size = models.CharField(
        max_length=10,
        choices=[
            ("small", "Small"),
            ("medium", "Medium"),
            ("large", "Large"),
        ],
        default="medium",
    )

    compact_mode = models.BooleanField(
        default=False,
    )

    show_animations = models.BooleanField(
        default=True,
    )

    # ✅ Notification Preferences
    email_notifications = models.BooleanField(
        default=True,
        help_text="Receive updates via email"
    )

    push_notifications = models.BooleanField(
        default=False,
        help_text="Get browser push notifications"
    )

    translation_complete = models.BooleanField(
        default=True,
        help_text="Notify when translation finishes"
    )

    weekly_report = models.BooleanField(
        default=False,
        help_text="Get a weekly summary of your activity"
    )

    # ✅ Privacy & Security Preferences
    share_usage_data = models.BooleanField(
        default=False,
        help_text="Help us improve by sharing anonymous usage data"
    )

    allow_analytics = models.BooleanField(
        default=True,
        help_text="Enable analytics to improve the platform"
    )

    # ✅ SMS 2FA Field
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        help_text="Phone number for SMS 2FA"
    )

    # ✅ NEW: Data & Storage Settings
    cache_size = models.CharField(
        max_length=10,
        choices=[
            ("small", "Small (10 items)"),
            ("medium", "Medium (20 items)"),
            ("large", "Large (50 items)"),
        ],
        default="medium",
        help_text="Number of history items to store"
    )

    export_format = models.CharField(
        max_length=10,
        choices=[
            ("txt", "Text File"),
            ("html", "HTML"),
            ("docx", "Word Document"),
            ("pdf", "PDF"),
        ],
        default="pdf",
        help_text="Default export format"
    )

    # ✅ NEW: Developer Mode & API Config
    developer_mode = models.BooleanField(
        default=False,
        help_text="Enable advanced debugging features"
    )

    api_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="API configuration (Base URL, API Key, etc.)"
    )

    # ========================================================
    # OAUTH
    # ========================================================
    auth_provider = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    auth_provider_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    is_verified = models.BooleanField(
        default=False,
    )

    # ========================================================
    # TIMESTAMPS
    # ========================================================
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    # ========================================================
    # HELPERS
    # ========================================================
    @property
    def is_premium(self):
        return self.plan.lower() in {
            "pro",
            "premium",
            "business",
        }

    def __str__(self):
        return self.email


# ========================================================
# ACCOUNT ACTIVITY
# ========================================================
class AccountActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activities")
    action = models.CharField(max_length=100, help_text="e.g., 'Password changed', '2FA enabled', 'New login'")
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Account Activity"
        verbose_name_plural = "Account Activities"

    def __str__(self):
        return f"{self.user.email} - {self.action} at {self.created_at}"


# ========================================================
# USER SESSION
# ========================================================
class UserSession(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessions",
    )

    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
    )

    user_agent = models.TextField(
        blank=True,
        null=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    last_active = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return f"{self.user.email} - {self.created_at}"


# ========================================================
# NOTIFICATION
# ========================================================
class Notification(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    title = models.CharField(
        max_length=200,
    )

    message = models.TextField()

    type = models.CharField(
        max_length=50,
        default="info",
    )

    is_read = models.BooleanField(
        default=False,
    )

    link = models.URLField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return f"{self.title} - {self.user.email}"


# ========================================================
# PUSH SUBSCRIPTION
# ========================================================
class PushSubscription(models.Model):
    """Stores the user's browser push notification subscription."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="push_subscriptions"
    )
    endpoint = models.URLField(max_length=500)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'push_subscriptions'
        unique_together = [['user', 'endpoint']]

    def __str__(self):
        return f"{self.user.email} - Push Subscription"


# ========================================================
# ✅ NEW: EMAIL OTP MODEL (For Login & Forgot Password)
# ========================================================
class OTP(models.Model):
    PURPOSE_CHOICES = [
        ('login', 'Login'),
        ('forgot_password', 'Forgot Password'),
        ('email_verification', 'Email Verification'),
    ]

    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='email_otps' # Changed related_name to avoid conflict with TOTP
    )
    otp_code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Email OTP'
        verbose_name_plural = 'Email OTPs'

    def __str__(self):
        return f"OTP for {self.user.email} - {self.purpose}"

    def is_expired(self):
        return timezone.now() > self.expires_at