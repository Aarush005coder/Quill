import uuid

from django.conf import settings
from django.db import models


class AppSettings(models.Model):
    """
    Per-user quill application settings.

    Existing settings are preserved.
    Additional fields below support the current SettingsPage UI.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="app_settings",
    )

    # =========================================================
    # INTERFACE
    # =========================================================

    sidebar_collapsed = models.BooleanField(
        default=False
    )

    default_page = models.CharField(
        max_length=20,
        choices=[
            ("translate", "Translate"),
            ("tools", "Tools"),
            ("documents", "Documents"),
            ("history", "History"),
            ("dashboard", "Dashboard"),
            ("about", "About"),
            ("settings", "Settings"),
        ],
        default="translate",
    )

    show_tips = models.BooleanField(
        default=True
    )

    onboarding_completed = models.BooleanField(
        default=False
    )

    # =========================================================
    # APPEARANCE
    # =========================================================

    theme = models.CharField(
        max_length=10,
        choices=[
            ("light", "Light"),
            ("dark", "Dark"),
            ("system", "System"),
        ],
        default="light",
    )

    font_size = models.CharField(
        max_length=10,
        choices=[
            ("small", "Small"),
            ("medium", "Medium"),
            ("large", "Large"),
            ("xlarge", "Extra Large"),
        ],
        default="medium",
    )

    compact_mode = models.BooleanField(
        default=False
    )

    show_animations = models.BooleanField(
        default=True
    )

    # =========================================================
    # TRANSLATION
    # =========================================================

    source_language = models.CharField(
        max_length=10,
        default="auto",
    )

    target_language = models.CharField(
        max_length=10,
        default="en",
    )

    auto_swap = models.BooleanField(
        default=True
    )

    auto_translate = models.BooleanField(
        default=True
    )

    preserve_formatting = models.BooleanField(
        default=True
    )

    save_history = models.BooleanField(
        default=True
    )

    translation_style = models.CharField(
        max_length=20,
        choices=[
            ("balanced", "Balanced"),
            ("formal", "Formal"),
            ("casual", "Casual"),
            ("creative", "Creative"),
        ],
        default="balanced",
    )

    formality_level = models.CharField(
        max_length=20,
        choices=[
            ("neutral", "Neutral"),
            ("formal", "Formal"),
            ("informal", "Informal"),
        ],
        default="neutral",
    )

    translation_speed = models.CharField(
        max_length=20,
        choices=[
            ("standard", "Standard"),
            ("fast", "Fast"),
            ("quality", "High Quality"),
        ],
        default="standard",
    )

    default_engine = models.CharField(
        max_length=30,
        choices=[
            ("google", "Google Translate"),
            ("deepl", "DeepL"),
            ("microsoft", "Microsoft"),
            ("myMemory", "MyMemory"),
        ],
        default="google",
    )

    auto_detect_language = models.BooleanField(
        default=True
    )

    show_original_text = models.BooleanField(
        default=True
    )

    # Existing translation options
    show_transliteration = models.BooleanField(
        default=False
    )

    show_definitions = models.BooleanField(
        default=False
    )

    show_examples = models.BooleanField(
        default=False
    )

    formal_tone = models.BooleanField(
        default=False
    )

    # =========================================================
    # TEXT TO SPEECH / SPEECH TO TEXT
    # =========================================================

    tts_voice = models.CharField(
        max_length=100,
        default="en-US-AriaNeural",
    )

    auto_play_tts = models.BooleanField(
        default=False
    )

    tts_volume = models.PositiveSmallIntegerField(
        default=80
    )

    stt_language = models.CharField(
        max_length=10,
        default="en",
    )

    microphone_sensitivity = models.PositiveSmallIntegerField(
        default=50
    )

    # =========================================================
    # NOTIFICATIONS
    # =========================================================

    email_notifications = models.BooleanField(
        default=True
    )

    push_notifications = models.BooleanField(
        default=False
    )

    translation_complete = models.BooleanField(
        default=True
    )

    weekly_report = models.BooleanField(
        default=False
    )

    # Existing notification settings
    browser_notifications = models.BooleanField(
        default=True
    )

    sound_effects = models.BooleanField(
        default=True
    )

    weekly_digest = models.BooleanField(
        default=True
    )

    # =========================================================
    # PRIVACY & SECURITY
    # =========================================================

    share_usage_data = models.BooleanField(
        default=False
    )

    allow_analytics = models.BooleanField(
        default=True
    )

    two_factor_auth = models.BooleanField(
        default=False
    )

    # Existing privacy controls
    history_retention_days = models.PositiveSmallIntegerField(
        default=365
    )

    clear_history_on_exit = models.BooleanField(
        default=False
    )

    incognito_mode = models.BooleanField(
        default=False
    )

    # =========================================================
    # DATA & STORAGE
    # =========================================================

    auto_save = models.BooleanField(
        default=True
    )

    cache_size = models.CharField(
        max_length=20,
        choices=[
            ("small", "Small (50MB)"),
            ("medium", "Medium (200MB)"),
            ("large", "Large (500MB)"),
        ],
        default="medium",
    )

    export_format = models.CharField(
        max_length=10,
        choices=[
            ("pdf", "PDF"),
            ("docx", "Word (DOCX)"),
            ("txt", "Plain Text"),
            ("html", "HTML"),
        ],
        default="pdf",
    )

    # Existing export fields
    default_export_format = models.CharField(
        max_length=10,
        choices=[
            ("pdf", "PDF"),
            ("docx", "Word"),
            ("txt", "Text"),
            ("html", "HTML"),
        ],
        default="pdf",
    )

    include_watermark = models.BooleanField(
        default=False
    )

    watermark_text = models.CharField(
        max_length=200,
        blank=True,
        default="Translated by quill",
    )

    # =========================================================
    # ADVANCED
    # =========================================================

    developer_mode = models.BooleanField(
        default=False
    )

    # =========================================================
    # TIMESTAMP
    # =========================================================

    updated_at = models.DateTimeField(
        auto_now=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        db_table = "app_settings"
        verbose_name = "App Settings"
        verbose_name_plural = "App Settings"

    def __str__(self):
        return f"{self.user.email} settings"


# =============================================================
# AUTO SAVE DATA
# =============================================================

class AutoSaveData(models.Model):
    """
    Auto-saved drafts so user does not lose work after reload.
    """

    DRAFT_TYPES = [
        ("translate", "Translation Draft"),
        ("tool", "Tool Draft"),
        ("document", "Document Settings"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="autosave_drafts",
    )

    draft_type = models.CharField(
        max_length=20,
        choices=DRAFT_TYPES,
    )

    draft_data = models.JSONField(
        default=dict
    )

    page_url = models.CharField(
        max_length=500,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "autosave_data"
        unique_together = [
            "user",
            "draft_type",
            "page_url",
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.user.email} | "
            f"{self.draft_type} | "
            f"{self.page_url}"
        )


# =============================================================
# CUSTOM SHORTCUTS
# =============================================================

class CustomShortcut(models.Model):
    """
    User-defined keyboard shortcuts.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="custom_shortcuts",
    )

    action = models.CharField(
        max_length=100
    )

    key_combo = models.CharField(
        max_length=50
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:
        db_table = "custom_shortcuts"

        unique_together = [
            "user",
            "action",
        ]

    def __str__(self):
        return (
            f"{self.user.email} | "
            f"{self.action} = {self.key_combo}"
        )


# =============================================================
# BLOCKED LANGUAGES
# =============================================================

class BlockedLanguage(models.Model):
    """
    Languages that a user does not want to show
    in translation dropdowns.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_languages",
    )

    language_code = models.CharField(
        max_length=10
    )

    class Meta:
        db_table = "blocked_languages"

        unique_together = [
            "user",
            "language_code",
        ]

    def __str__(self):
        return (
            f"{self.user.email} "
            f"blocked {self.language_code}"
        )