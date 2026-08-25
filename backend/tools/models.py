import uuid
from django.db import models
from django.conf import settings


class ToolHistory(models.Model):
    """Base history for all tools usage."""
    
    TOOL_TYPES = [
        ('number_converter', 'Number Converter'),
        ('currency_converter', 'Currency Converter'),
        ('unit_converter', 'Unit Converter'),
        ('data_storage_converter', 'Data Storage Converter'),
        ('electrical_converter', 'Electrical Converter'),
        ('health_calculator', 'Health Calculator'),
        ('specific_calculator', 'Specific Calculator'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tools_history'
    )
    tool_type = models.CharField(max_length=30, choices=TOOL_TYPES)
    input_data = models.JSONField()      # Stores all inputs
    output_data = models.JSONField()     # Stores all outputs
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'tools_history'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'tool_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} | {self.get_tool_type_display()} | {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class CurrencyRate(models.Model):
    """Cached currency exchange rates (updated via Celery beat)."""
    
    base_currency = models.CharField(max_length=3, default='USD')  # USD, EUR, etc.
    target_currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=20, decimal_places=10)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'currency_rates'
        unique_together = ['base_currency', 'target_currency']
    
    def __str__(self):
        return f"1 {self.base_currency} = {self.rate} {self.target_currency}"


class SavedCalculation(models.Model):
    """User's saved calculations for quick re-use."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_calculations'
    )
    name = models.CharField(max_length=200)
    tool_type = models.CharField(max_length=30, choices=ToolHistory.TOOL_TYPES)
    input_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'saved_calculations'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} | {self.user.email}"