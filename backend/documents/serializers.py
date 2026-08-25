from rest_framework import serializers
from .models import DocumentUpload, DocumentTemplate


class DocumentUploadSerializer(serializers.ModelSerializer):
    file_size_display = serializers.CharField(source='file_size_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    file_type_display = serializers.CharField(source='get_file_type_display', read_only=True)
    time_ago = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = DocumentUpload
        fields = [
            'id', 'original_name', 'translated_name',
            'file_type', 'file_type_display',
            'file_size', 'file_size_display',
            'page_count',
            'source_lang', 'target_lang',
            'output_format', 'preserve_formatting',
            'status', 'status_display', 'progress_percent', 'status_message',
            'translated_file', 'translated_text_preview',
            'time_ago', 'duration_seconds',
            'uploaded_at', 'completed_at',
            'error_message'
        ]

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.uploaded_at) + " ago"

    def get_duration_seconds(self, obj):
        return obj.duration


class DocumentTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTemplate
        fields = ['id', 'name', 'source_lang', 'target_lang', 'output_format', 'preserve_formatting', 'created_at']
        