import uuid
from django.db import models
from django.conf import settings


class UnifiedHistory(models.Model):
    """
    Aggregated history entry from all features (Translate, Tools, Documents, Combine).
    Acts as a central log for user activities across the platform.
    """
    
    # Choices exactly match your frontend categories for seamless mapping
    HISTORY_TYPES = [
        ('translate', 'Translation'),
        ('tools', 'Tools'),
        ('documents', 'Documents'),
        ('combine', 'Combine'),
    ]

    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('processing', 'Processing'),
    ]
    
    id = models.UUIDField(
        primary_key=True, 
        default=uuid.uuid4, 
        editable=False
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='unified_history'
    )
    
    history_type = models.CharField(
        max_length=20, 
        choices=HISTORY_TYPES, 
        db_index=True
    )
    
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    
    # Link to original record (Generic relation fields)
    source_app = models.CharField(max_length=50, blank=True)  # e.g., 'translation', 'tools', 'combine'
    source_model = models.CharField(max_length=50, blank=True) # e.g., 'TextTranslation', 'PdfMerge'
    source_id = models.CharField(max_length=100, blank=True)   # CharField to safely support both UUID and Integer IDs
    
    # Quick data snapshot for frontend display
    metadata = models.JSONField(default=dict, blank=True)
    
    # File and Status tracking
    output_file = models.FileField(
        upload_to='history_outputs/%Y/%m/', 
        blank=True, 
        null=True
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='completed', 
        db_index=True
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'unified_history'
        ordering = ['-created_at']
        verbose_name = 'Unified History'
        verbose_name_plural = 'Unified Histories'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'history_type', '-created_at']),
            models.Index(fields=['user', 'status']),
        ]
    
    def __str__(self):
        # Using str(self.user) to avoid errors if user.email/username is blank
        return f"{self.user} | {self.get_history_type_display()} | {self.title}"

    def get_frontend_category(self):
        """Helper to return exact category name for frontend."""
        return self.history_type