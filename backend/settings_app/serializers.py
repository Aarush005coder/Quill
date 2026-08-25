from rest_framework import serializers
from django.utils.timesince import timesince

from .models import (
    AppSettings,
    AutoSaveData,
    CustomShortcut,
    BlockedLanguage,
)


# ============================================================
# APP SETTINGS
# ============================================================

class AppSettingsSerializer(serializers.ModelSerializer):
    """
    Serializer for the user's application settings.
    
    Frontend uses camelCase keys while Django models use snake_case.
    `source=` maps both sides cleanly so frontend state matches perfectly.
    """

    # --------------------------------------------------------
    # Interface
    # --------------------------------------------------------
    sidebarCollapsed = serializers.BooleanField(source="sidebar_collapsed", required=False)
    defaultPage = serializers.CharField(source="default_page", required=False)
    showTips = serializers.BooleanField(source="show_tips", required=False)
    onboardingCompleted = serializers.BooleanField(source="onboarding_completed", required=False)

    # --------------------------------------------------------
    # Appearance
    # --------------------------------------------------------
    theme = serializers.CharField(required=False)
    fontSize = serializers.CharField(source="font_size", required=False)
    compactMode = serializers.BooleanField(source="compact_mode", required=False)
    showAnimations = serializers.BooleanField(source="show_animations", required=False)

    # --------------------------------------------------------
    # Translation (CORE)
    # --------------------------------------------------------
    sourceLanguage = serializers.CharField(source="source_language", required=False)
    targetLanguage = serializers.CharField(source="target_language", required=False)
    autoSwap = serializers.BooleanField(source="auto_swap", required=False)
    autoTranslate = serializers.BooleanField(source="auto_translate", required=False)
    preserveFormatting = serializers.BooleanField(source="preserve_formatting", required=False)
    saveHistory = serializers.BooleanField(source="save_history", required=False)
    translationStyle = serializers.CharField(source="translation_style", required=False)
    formalityLevel = serializers.CharField(source="formality_level", required=False)
    translationSpeed = serializers.CharField(source="translation_speed", required=False)
    defaultEngine = serializers.CharField(source="default_engine", required=False)
    autoDetectLanguage = serializers.BooleanField(source="auto_detect_language", required=False)
    showOriginalText = serializers.BooleanField(source="show_original_text", required=False)

    # Extra Translation Options
    showTransliteration = serializers.BooleanField(source="show_transliteration", required=False)
    showDefinitions = serializers.BooleanField(source="show_definitions", required=False)
    showExamples = serializers.BooleanField(source="show_examples", required=False)
    formalTone = serializers.BooleanField(source="formal_tone", required=False)

    # --------------------------------------------------------
    # Speech / Audio
    # --------------------------------------------------------
    ttsVoice = serializers.CharField(source="tts_voice", required=False)
    autoPlayTts = serializers.BooleanField(source="auto_play_tts", required=False)
    ttsVolume = serializers.IntegerField(source="tts_volume", required=False, min_value=0, max_value=100)
    sttLanguage = serializers.CharField(source="stt_language", required=False)
    microphoneSensitivity = serializers.IntegerField(source="microphone_sensitivity", required=False, min_value=0, max_value=100)

    # --------------------------------------------------------
    # Notifications
    # --------------------------------------------------------
    emailNotifications = serializers.BooleanField(source="email_notifications", required=False)
    pushNotifications = serializers.BooleanField(source="push_notifications", required=False)
    translationComplete = serializers.BooleanField(source="translation_complete", required=False)
    weeklyReport = serializers.BooleanField(source="weekly_report", required=False)
    browserNotifications = serializers.BooleanField(source="browser_notifications", required=False)
    soundEffects = serializers.BooleanField(source="sound_effects", required=False)
    weeklyDigest = serializers.BooleanField(source="weekly_digest", required=False)

    # --------------------------------------------------------
    # Privacy & Security
    # --------------------------------------------------------
    shareUsageData = serializers.BooleanField(source="share_usage_data", required=False)
    allowAnalytics = serializers.BooleanField(source="allow_analytics", required=False)
    twoFactorAuth = serializers.BooleanField(source="two_factor_auth", required=False)
    historyRetentionDays = serializers.IntegerField(source="history_retention_days", required=False, min_value=0)
    clearHistoryOnExit = serializers.BooleanField(source="clear_history_on_exit", required=False)
    incognitoMode = serializers.BooleanField(source="incognito_mode", required=False)

    # --------------------------------------------------------
    # Data & Storage
    # --------------------------------------------------------
    autoSave = serializers.BooleanField(source="auto_save", required=False)
    cacheSize = serializers.CharField(source="cache_size", required=False)
    exportFormat = serializers.CharField(source="export_format", required=False)
    defaultExportFormat = serializers.CharField(source="default_export_format", required=False)
    includeWatermark = serializers.BooleanField(source="include_watermark", required=False)
    watermarkText = serializers.CharField(source="watermark_text", required=False, allow_blank=True, max_length=200)

    # --------------------------------------------------------
    # Advanced
    # --------------------------------------------------------
    developerMode = serializers.BooleanField(source="developer_mode", required=False)

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = AppSettings
        fields = [
            # Interface
            "sidebarCollapsed", "defaultPage", "showTips", "onboardingCompleted",
            # Appearance
            "theme", "fontSize", "compactMode", "showAnimations",
            # Translation
            "sourceLanguage", "targetLanguage", "autoSwap", "autoTranslate",
            "preserveFormatting", "saveHistory", "translationStyle", "formalityLevel",
            "translationSpeed", "defaultEngine", "autoDetectLanguage", "showOriginalText",
            "showTransliteration", "showDefinitions", "showExamples", "formalTone",
            # Speech
            "ttsVoice", "autoPlayTts", "ttsVolume", "sttLanguage", "microphoneSensitivity",
            # Notifications
            "emailNotifications", "pushNotifications", "translationComplete", "weeklyReport",
            "browserNotifications", "soundEffects", "weeklyDigest",
            # Privacy
            "shareUsageData", "allowAnalytics", "twoFactorAuth",
            "historyRetentionDays", "clearHistoryOnExit", "incognitoMode",
            # Data
            "autoSave", "cacheSize", "exportFormat", "defaultExportFormat",
            "includeWatermark", "watermarkText",
            # Advanced
            "developerMode",
            # Metadata
            "updatedAt", "createdAt",
        ]

    def validate_ttsVolume(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("TTS volume must be between 0 and 100.")
        return value

    def validate_microphoneSensitivity(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Microphone sensitivity must be between 0 and 100.")
        return value

    def validate_historyRetentionDays(self, value):
        if value < 0:
            raise serializers.ValidationError("History retention cannot be negative.")
        return value


# ============================================================
# AUTO SAVE DATA
# ============================================================

class AutoSaveDataSerializer(serializers.ModelSerializer):
    timeAgo = serializers.SerializerMethodField()

    class Meta:
        model = AutoSaveData
        fields = [
            "id",
            "draft_type",
            "draft_data",
            "page_url",
            "timeAgo",
            "created_at",
        ]
        read_only_fields = ["id", "timeAgo", "created_at"]

    def get_timeAgo(self, obj):
        return f"{timesince(obj.created_at)} ago"


# ============================================================
# CUSTOM SHORTCUTS
# ============================================================

class CustomShortcutSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomShortcut
        fields = [
            "id",
            "action",
            "key_combo",
            "is_active",
        ]
        read_only_fields = ["id"]

    def validate_key_combo(self, value):
        value = str(value).strip()
        if not value:
            raise serializers.ValidationError("Key combination cannot be empty.")
        if len(value) > 50:
            raise serializers.ValidationError("Key combination is too long.")
        return value


# ============================================================
# BLOCKED LANGUAGES
# ============================================================

class BlockedLanguageSerializer(serializers.ModelSerializer):
    languageCode = serializers.CharField(source="language_code", required=True, max_length=10)

    class Meta:
        model = BlockedLanguage
        fields = [
            "id",
            "languageCode",
        ]
        read_only_fields = ["id"]

    def validate_languageCode(self, value):
        value = str(value).strip().lower()
        if not value:
            raise serializers.ValidationError("Language code is required.")
        return value


# ============================================================
# COMBINED SETTINGS RESPONSE
# ============================================================

class SettingsResponseSerializer(serializers.Serializer):
    """
    Wrapper to return a consistent response object for settings endpoints.
    """
    success = serializers.BooleanField(default=True)
    data = AppSettingsSerializer()
    message = serializers.CharField(required=False, allow_blank=True)