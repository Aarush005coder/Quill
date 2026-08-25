from rest_framework import serializers

from .models import (
    Language,
    TranslationHistory,
    FavoriteTranslation,
    SpeechProfile,
)


# ============================================================
# LANGUAGE
# ============================================================

class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = [
            "code",
            "name",
            "native_name",
            "flag_emoji",
            "is_popular",
        ]


# ============================================================
# TRANSLATION REQUEST
# ============================================================

class TranslationRequestSerializer(serializers.Serializer):
    """
    Request serializer for the main translation endpoint.
    Includes all settings from the frontend SettingsPage.
    """

    source_text = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    source_lang = serializers.CharField(
        required=False,
        max_length=10,
        default="auto",
    )

    target_lang = serializers.CharField(
        required=False,
        max_length=10,
        default="en",
    )

    mode = serializers.ChoiceField(
        required=False,
        choices=[
            ("text_to_text", "Text to Text"),
            ("text_to_speech", "Text to Speech"),
            ("speech_to_text", "Speech to Text"),
            ("speech_to_speech", "Speech to Speech"),
        ],
        default="text_to_text",
    )

    # ✅ FIXED: Changed to CharField to prevent case-sensitivity 400 errors.
    # The view's normalize_engine() function will handle the actual validation.
    engine = serializers.CharField(
        required=False,
        max_length=20,
        default="google",
    )

    auto_detect = serializers.BooleanField(
        required=False,
        default=False,
    )

    localize_terms = serializers.BooleanField(
        required=False,
        default=True,
    )

    # ✅ Settings fields from frontend
    translation_style = serializers.ChoiceField(
        required=False,
        choices=[
            ("balanced", "Balanced"),
            ("formal", "Formal"),
            ("casual", "Casual"),
            ("creative", "Creative"),
        ],
        default="balanced",
    )

    formality_level = serializers.ChoiceField(
        required=False,
        choices=[
            ("neutral", "Neutral"),
            ("formal", "Formal"),
            ("informal", "Informal"),
        ],
        default="neutral",
    )

    translation_speed = serializers.ChoiceField(
        required=False,
        choices=[
            ("standard", "Standard"),
            ("fast", "Fast"),
            ("quality", "High Quality"),
        ],
        default="standard",
    )

    preserve_formatting = serializers.BooleanField(
        required=False,
        default=True,
    )

    show_original_text = serializers.BooleanField(
        required=False,
        default=True,
    )

    tts_voice = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        default="",
    )


# ============================================================
# TRANSLATION RESPONSE
# ============================================================

class TranslationResponseSerializer(serializers.Serializer):
    translated_text = serializers.CharField()

    detected_source_lang = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    audio_url = serializers.URLField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    char_count = serializers.IntegerField()

    history_id = serializers.UUIDField(
        required=False,
    )

    source_lang = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    target_lang = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    mode = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    engine = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    # ✅ Return applied settings in response
    translation_style = serializers.CharField(required=False)
    formality_level = serializers.CharField(required=False)
    translation_speed = serializers.CharField(required=False)
    preserve_formatting = serializers.BooleanField(required=False)
    auto_detected = serializers.BooleanField(required=False)
    show_original_text = serializers.BooleanField(required=False)
    tts_voice = serializers.CharField(required=False, allow_blank=True)


# ============================================================
# TRANSLATION HISTORY
# ============================================================

class TranslationHistorySerializer(serializers.ModelSerializer):
    source_lang_name = serializers.CharField(
        source="source_lang",
        read_only=True,
    )

    target_lang_name = serializers.CharField(
        source="target_lang",
        read_only=True,
    )

    mode_display = serializers.CharField(
        source="get_mode_display",
        read_only=True,
    )

    engine_display = serializers.CharField(
        source="get_engine_display",
        read_only=True,
    )

    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = TranslationHistory
        fields = [
            "id",
            "source_text",
            "translated_text",
            "source_lang",
            "source_lang_name",
            "target_lang",
            "target_lang_name",
            "mode",
            "mode_display",
            "engine",
            "engine_display",
            "char_count",
            "audio_url",
            "audio_duration",
            "detected_source_lang",
            "is_favorite",
            "user_rating",
            "user_note",
            "time_ago",
            "created_at",
            
            # ✅ Include settings fields in history response
            "translation_style",
            "formality_level",
            "translation_speed",
            "preserve_formatting",
            "auto_detected",
            "show_original_text",
            "tts_voice",
        ]

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.created_at) + " ago"


# ============================================================
# FAVORITE TRANSLATION
# ============================================================

class FavoriteTranslationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = FavoriteTranslation
        fields = [
            "id",
            "title",
            "source_text",
            "translated_text",
            "source_lang",
            "target_lang",
            "tags",
            "folder",
            "usage_count",
            "time_ago",
            "created_at",
        ]

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.created_at) + " ago"


# ============================================================
# SPEECH PROFILE
# ============================================================

class SpeechProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpeechProfile
        fields = [
            "id",
            "language",
            "voice_id",
            "voice_name",
            "gender",
            "speed",
            "pitch",
            "is_default",
        ]