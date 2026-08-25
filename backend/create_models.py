import os

models_content = '''import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_('email address'), unique=True)
    username = models.CharField(_('username'), max_length=50, unique=True, blank=True, null=True)
    
    auth_provider = models.CharField(
        max_length=20,
        choices=[('email', 'Email'), ('google', 'Google'), ('github', 'GitHub')],
        default='email'
    )
    auth_provider_id = models.CharField(max_length=100, blank=True, null=True)

    first_name = models.CharField(_('first name'), max_length=50, blank=True)
    last_name = models.CharField(_('last name'), max_length=50, blank=True)
    avatar = models.URLField(_('avatar'), blank=True, null=True)
    phone = models.CharField(_('phone'), max_length=20, blank=True, null=True)
    bio = models.TextField(_('bio'), max_length=500, blank=True)

    PLAN_CHOICES = [('free', 'Free'), ('pro', 'Pro'), ('enterprise', 'Enterprise')]
    plan = models.CharField(_('plan'), max_length=20, choices=PLAN_CHOICES, default='free')
    plan_expires_at = models.DateTimeField(_('plan expires at'), blank=True, null=True)
    
    monthly_translation_chars = models.PositiveIntegerField(default=0)
    monthly_translation_limit = models.PositiveIntegerField(default=10000)
    monthly_document_pages = models.PositiveIntegerField(default=0)
    monthly_document_limit = models.PositiveIntegerField(default=5)

    otp_secret = models.CharField(max_length=32, blank=True, null=True)
    otp_enabled = models.BooleanField(default=False)
    otp_verified = models.BooleanField(default=False)

    is_staff = models.BooleanField(_('staff status'), default=False)
    is_active = models.BooleanField(_('active'), default=True)
    is_verified = models.BooleanField(_('verified'), default=False)
    date_joined = models.DateTimeField(_('date joined'), default=timezone.now)
    last_login = models.DateTimeField(_('last login'), blank=True, null=True)

    theme = models.CharField(
        max_length=10,
        choices=[('light', 'Light'), ('dark', 'Dark'), ('system', 'System')],
        default='system'
    )
    default_source_lang = models.CharField(max_length=10, default='en')
    default_target_lang = models.CharField(max_length=10, default='es')
    auto_speak = models.BooleanField(default=True)
    speech_voice = models.CharField(max_length=50, default='default')
    speech_speed = models.FloatField(default=1.0)
    auto_save_history = models.BooleanField(default=True)
    email_notifications = models.BooleanField(default=True)
    desktop_notifications = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'users'
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-date_joined']

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self):
        return self.first_name or self.email

    def reset_monthly_usage(self):
        self.monthly_translation_chars = 0
        self.monthly_document_pages = 0
        self.save(update_fields=['monthly_translation_chars', 'monthly_document_pages'])

    @property
    def is_premium(self):
        if self.plan == 'free':
            return False
        if self.plan_expires_at and self.plan_expires_at < timezone.now():
            self.plan = 'free'
            self.save(update_fields=['plan'])
            return False
        return True


class UserSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    location = models.CharField(max_length=100, blank=True)
    device_type = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_sessions'
        ordering = ['-last_activity']


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('info', 'Info'), ('success', 'Success'),
        ('warning', 'Warning'), ('error', 'Error'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='info')
    is_read = models.BooleanField(default=False)
    action_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
'''

filepath = os.path.join(os.path.dirname(__file__), 'users', 'models.py')
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(models_content)

print(f"✅ Created users/models.py ({len(models_content)} chars)")