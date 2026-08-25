import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class DailyUsageStats(models.Model):
    """Aggregated daily usage statistics per user."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_stats'
    )
    date = models.DateField()
    
    # Translation stats
    translations_count = models.PositiveIntegerField(default=0)
    translation_chars = models.PositiveIntegerField(default=0)
    text_to_text_count = models.PositiveIntegerField(default=0)
    text_to_speech_count = models.PositiveIntegerField(default=0)
    speech_to_text_count = models.PositiveIntegerField(default=0)
    speech_to_speech_count = models.PositiveIntegerField(default=0)
    
    # Tools stats
    tools_usage_count = models.PositiveIntegerField(default=0)
    
    # Document stats
    documents_uploaded = models.PositiveIntegerField(default=0)
    document_pages = models.PositiveIntegerField(default=0)
    
    # Combine stats
    combine_operations = models.PositiveIntegerField(default=0)
    
    # Time spent (in seconds)
    session_duration = models.PositiveIntegerField(default=0)
    
    class Meta:
        db_table = 'daily_usage_stats'
        unique_together = ['user', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.user.email} | {self.date} | {self.translations_count} translations"


class WeeklyUsageStats(models.Model):
    """Aggregated weekly usage statistics per user."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='weekly_stats'
    )
    year = models.PositiveSmallIntegerField()
    week = models.PositiveSmallIntegerField()
    
    translations_count = models.PositiveIntegerField(default=0)
    translation_chars = models.PositiveIntegerField(default=0)
    tools_usage_count = models.PositiveIntegerField(default=0)
    documents_uploaded = models.PositiveIntegerField(default=0)
    combine_operations = models.PositiveIntegerField(default=0)
    session_duration = models.PositiveIntegerField(default=0)
    
    class Meta:
        db_table = 'weekly_usage_stats'
        unique_together = ['user', 'year', 'week']
        ordering = ['-year', '-week']


class MonthlyUsageStats(models.Model):
    """Aggregated monthly usage statistics per user."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='monthly_stats'
    )
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    
    translations_count = models.PositiveIntegerField(default=0)
    translation_chars = models.PositiveIntegerField(default=0)
    tools_usage_count = models.PositiveIntegerField(default=0)
    documents_uploaded = models.PositiveIntegerField(default=0)
    combine_operations = models.PositiveIntegerField(default=0)
    session_duration = models.PositiveIntegerField(default=0)
    
    class Meta:
        db_table = 'monthly_usage_stats'
        unique_together = ['user', 'year', 'month']
        ordering = ['-year', '-month']


class LanguageUsageStats(models.Model):
    """Track most used language pairs per user."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='language_stats'
    )
    source_lang = models.CharField(max_length=10)
    target_lang = models.CharField(max_length=10)
    usage_count = models.PositiveIntegerField(default=0)
    last_used = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'language_usage_stats'
        unique_together = ['user', 'source_lang', 'target_lang']
        ordering = ['-usage_count']
    
    def __str__(self):
        return f"{self.user.email} | {self.source_lang} → {self.target_lang} | {self.usage_count}"


class UserActivityLog(models.Model):
    """Detailed activity log for audit and analytics."""
    
    ACTIVITY_TYPES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('translate', 'Translate'),
        ('tts', 'Text to Speech'),
        ('stt', 'Speech to Text'),
        ('tool_use', 'Tool Use'),
        ('document_upload', 'Document Upload'),
        ('document_download', 'Document Download'),
        ('combine', 'File Combine'),
        ('settings_change', 'Settings Change'),
        ('profile_update', 'Profile Update'),
        ('password_change', 'Password Change'),
        ('otp_enable', 'OTP Enabled'),
        ('otp_disable', 'OTP Disabled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='activity_logs'
    )
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    description = models.CharField(max_length=500, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'user_activity_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'activity_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} | {self.get_activity_type_display()} | {self.created_at.strftime('%Y-%m-%d %H:%M')}"