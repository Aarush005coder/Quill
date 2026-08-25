from rest_framework import serializers
from .models import UnifiedHistory


class UnifiedHistorySerializer(serializers.ModelSerializer):
    # Display name for history_type (e.g., 'Translation' instead of 'translate')
    history_type_display = serializers.CharField(
        source='get_history_type_display', 
        read_only=True
    )
    
    # Time ago string (e.g., "2 hours ago")
    time_ago = serializers.SerializerMethodField()
    
    # Absolute URL for the output file (Crucial for frontend Download button)
    output_file_url = serializers.SerializerMethodField()

    class Meta:
        model = UnifiedHistory
        fields = [
            'id', 
            'history_type', 
            'history_type_display', 
            'status',
            'title', 
            'description', 
            'source_app', 
            'source_model',
            'source_id', 
            'metadata', 
            'output_file_url', 
            'time_ago', 
            'created_at'
        ]
        # Explicitly mark generated/computed fields as read-only
        read_only_fields = [
            'id', 
            'created_at', 
            'time_ago', 
            'history_type_display', 
            'output_file_url'
        ]

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        # timesince safely handles recent dates (returns "0 minutes" if very recent)
        return timesince(obj.created_at) + " ago"

    def get_output_file_url(self, obj):
        if obj.output_file:
            request = self.context.get('request')
            if request:
                try:
                    # Returns full absolute URL like http://127.0.0.1:8000/media/history_outputs/...
                    return request.build_absolute_uri(obj.output_file.url)
                except ValueError:
                    # Fallback to relative URL if absolute URI generation fails
                    return obj.output_file.url
        return None