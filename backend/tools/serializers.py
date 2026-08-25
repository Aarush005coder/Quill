from rest_framework import serializers
from .models import ToolHistory, CurrencyRate, SavedCalculation


class ToolHistorySerializer(serializers.ModelSerializer):
    tool_type_display = serializers.CharField(source='get_tool_type_display', read_only=True)
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = ToolHistory
        fields = [
            'id', 'tool_type', 'tool_type_display',
            'input_data', 'output_data',
            'time_ago', 'created_at'
        ]

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.created_at) + " ago"


class CurrencyRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurrencyRate
        fields = ['base_currency', 'target_currency', 'rate', 'last_updated']


class SavedCalculationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedCalculation
        fields = ['id', 'name', 'tool_type', 'input_data', 'created_at']