from rest_framework import serializers
from .models import (
    DailyUsageStats, WeeklyUsageStats, MonthlyUsageStats,
    LanguageUsageStats, UserActivityLog
)


class DailyUsageStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyUsageStats
        fields = [
            'date', 'translations_count', 'translation_chars',
            'text_to_text_count', 'text_to_speech_count',
            'speech_to_text_count', 'speech_to_speech_count',
            'tools_usage_count', 'documents_uploaded', 'document_pages',
            'combine_operations', 'session_duration'
        ]


class WeeklyUsageStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyUsageStats
        fields = [
            'year', 'week', 'translations_count', 'translation_chars',
            'tools_usage_count', 'documents_uploaded', 'combine_operations',
            'session_duration'
        ]


class MonthlyUsageStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyUsageStats
        fields = [
            'year', 'month', 'translations_count', 'translation_chars',
            'tools_usage_count', 'documents_uploaded', 'combine_operations',
            'session_duration'
        ]


class LanguageUsageStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LanguageUsageStats
        fields = ['source_lang', 'target_lang', 'usage_count', 'last_used']


class UserActivityLogSerializer(serializers.ModelSerializer):
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = UserActivityLog
        fields = [
            'id', 'activity_type', 'activity_type_display',
            'description', 'ip_address', 'metadata', 'time_ago', 'created_at'
        ]

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.created_at) + " ago"