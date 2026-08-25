import uuid
from django.db import models
from django.conf import settings


class Language(models.Model):
    """Supported languages for translation."""
    
    code = models.CharField(max_length=10, primary_key=True)  # 'en', 'es', 'fr'
    name = models.CharField(max_length=100)  # 'English', 'Spanish'
    native_name = models.CharField(max_length=100, blank=True)  # 'English', 'Español'
    flag_emoji = models.CharField(max_length=10, blank=True)  # 🇺🇸, 🇪🇸
    is_active = models.BooleanField(default=True)
    is_popular = models.BooleanField(default=False)  # Show at top of list
    sort_order = models.PositiveIntegerField(default=0)
    
    class Meta:
        db_table = 'languages'
        ordering = ['sort_order', 'name']
    
    def __str__(self):
        return f"{self.flag_emoji} {self.name}"


class TranslationHistory(models.Model):
    """Stores every text translation performed by a user, including settings used."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='translation_history',
        null=True,
        blank=True  # Allows guest translations if needed
    )
    
    # Content
    source_text = models.TextField()
    translated_text = models.TextField()
    source_lang = models.CharField(max_length=10)
    target_lang = models.CharField(max_length=10)
    
    # Translation metadata
    TRANSLATION_MODES = [
        ('text_to_text', 'Text to Text'),
        ('text_to_speech', 'Text to Speech'),
        ('speech_to_text', 'Speech to Text'),
        ('speech_to_speech', 'Speech to Speech'),
    ]
    mode = models.CharField(max_length=20, choices=TRANSLATION_MODES, default='text_to_text')
    
    # AI / Engine used
    ENGINE_CHOICES = [
        ('grok', 'Grok AI'),
        ('google', 'Google Translate'),
        ('deepl', 'DeepL'),
        ('microsoft', 'Microsoft'),
        ('myMemory', 'MyMemory'),
    ]
    engine = models.CharField(max_length=20, choices=ENGINE_CHOICES, default='google')
    
    # ✅ NEW: Settings applied during this specific translation (Connects to Frontend Settings)
    translation_style = models.CharField(
        max_length=20,
        choices=[
            ('balanced', 'Balanced'),
            ('formal', 'Formal'),
            ('casual', 'Casual'),
            ('creative', 'Creative')
        ],
        default='balanced'
    )
    formality_level = models.CharField(
        max_length=20,
        choices=[
            ('neutral', 'Neutral'),
            ('formal', 'Formal'),
            ('informal', 'Informal')
        ],
        default='neutral'
    )
    translation_speed = models.CharField(
        max_length=20,
        choices=[
            ('standard', 'Standard'),
            ('fast', 'Fast'),
            ('quality', 'High Quality')
        ],
        default='standard'
    )
    preserve_formatting = models.BooleanField(default=True)
    auto_detected = models.BooleanField(default=False)
    show_original_text = models.BooleanField(default=True)
    tts_voice = models.CharField(max_length=100, blank=True, null=True)  # e.g., 'en-US-AriaNeural'
    
    # Character count for usage tracking
    char_count = models.PositiveIntegerField(default=0)
    
    # Audio file (for TTS / STS modes)
    audio_url = models.URLField(blank=True, null=True)
    audio_duration = models.FloatField(blank=True, null=True)  # seconds
    
    # Detected language (if auto-detect was used)
    detected_source_lang = models.CharField(max_length=10, blank=True, null=True)
    
    # User feedback
    is_favorite = models.BooleanField(default=False)
    user_rating = models.PositiveSmallIntegerField(blank=True, null=True)  # 1-5 stars
    user_note = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'translation_history'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_favorite']),
            models.Index(fields=['source_lang', 'target_lang']),
        ]
    
    def __str__(self):
        user_email = self.user.email if self.user else 'Guest'
        return f"{user_email} | {self.source_lang} → {self.target_lang} | {self.created_at.strftime('%Y-%m-%d %H:%M')}"
    
    def save(self, *args, **kwargs):
        if not self.char_count and self.source_text:
            self.char_count = len(self.source_text)
        super().save(*args, **kwargs)


class FavoriteTranslation(models.Model):
    """User's saved favorite translations (quick access)."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='favorite_translations'
    )
    title = models.CharField(max_length=200, blank=True)
    source_text = models.TextField()
    translated_text = models.TextField()
    source_lang = models.CharField(max_length=10)
    target_lang = models.CharField(max_length=10)
    tags = models.CharField(max_length=500, blank=True)  # comma-separated tags
    folder = models.CharField(max_length=100, blank=True, default='General')
    usage_count = models.PositiveIntegerField(default=0)  # How many times used
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'favorite_translations'
        ordering = ['-usage_count', '-created_at']
        unique_together = ['user', 'source_text', 'source_lang', 'target_lang']
    
    def __str__(self):
        return f"{self.title or 'Untitled'} | {self.user.email}"


class SpeechProfile(models.Model):
    """User's saved speech/voice preferences per language."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='speech_profiles'
    )
    language = models.CharField(max_length=10)
    voice_id = models.CharField(max_length=100)  # Provider-specific voice ID
    voice_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(
        max_length=10, 
        choices=[('male', 'Male'), ('female', 'Female'), ('neutral', 'Neutral')], 
        default='neutral'
    )
    speed = models.FloatField(default=1.0)
    pitch = models.FloatField(default=1.0)
    is_default = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'speech_profiles'
        unique_together = ['user', 'language']
    
    def __str__(self):
        return f"{self.user.email} | {self.language} | {self.voice_name or self.voice_id}"