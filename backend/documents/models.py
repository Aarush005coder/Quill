import uuid
import os
from django.db import models
from django.conf import settings
from django.utils import timezone


def document_upload_path(instance, filename):
    """Generate upload path: media/documents/{user_id}/{uuid}_{filename}"""
    ext = filename.split('.')[-1].lower()
    return f"documents/{instance.user.id}/{uuid.uuid4().hex}.{ext}"


class DocumentUpload(models.Model):
    """User uploaded documents for translation."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('uploading', 'Uploading'),
        ('processing', 'Processing'),
        ('translating', 'Translating'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    FILE_TYPES = [
        ('pdf', 'PDF'),
        ('docx', 'Word Document'),
        ('doc', 'Word Document (Old)'),
        ('txt', 'Plain Text'),
        ('rtf', 'Rich Text'),
        ('html', 'HTML'),
        ('md', 'Markdown'),
        ('csv', 'CSV'),
        ('xlsx', 'Excel'),
        ('pptx', 'PowerPoint'),
        ('epub', 'EPUB'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    
    # Original file
    original_file = models.FileField(upload_to=document_upload_path)
    original_name = models.CharField(max_length=500)
    file_type = models.CharField(max_length=10, choices=FILE_TYPES)
    file_size = models.PositiveIntegerField(help_text='Size in bytes')
    page_count = models.PositiveIntegerField(default=0, help_text='Estimated pages')
    
    # Translation settings
    source_lang = models.CharField(max_length=10, default='auto')
    target_lang = models.CharField(max_length=10)
    preserve_formatting = models.BooleanField(default=True)
    translate_images = models.BooleanField(default=False)  # OCR for images in PDF
    
    # Status & progress
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress_percent = models.PositiveSmallIntegerField(default=0)
    status_message = models.CharField(max_length=500, blank=True)
    
    # Translated output
    translated_file = models.FileField(upload_to=document_upload_path, blank=True, null=True)
    translated_name = models.CharField(max_length=500, blank=True)
    output_format = models.CharField(
        max_length=10,
        choices=[
            ('pdf', 'PDF'),
            ('docx', 'Word'),
            ('txt', 'Plain Text'),
            ('html', 'HTML'),
            ('rtf', 'Rich Text'),
        ],
        default='pdf'
    )
    
    # Content extraction (for search & preview)
    extracted_text = models.TextField(blank=True, help_text='Extracted text from document')
    translated_text_preview = models.TextField(blank=True, help_text='First 2000 chars preview')
    
    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    # Error handling
    error_message = models.TextField(blank=True)
    retry_count = models.PositiveSmallIntegerField(default=0)
    
    class Meta:
        db_table = 'document_uploads'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user', '-uploaded_at']),
            models.Index(fields=['user', 'status']),
        ]
    
    def __str__(self):
        return f"{self.original_name} | {self.user.email} | {self.status}"
    
    @property
    def file_size_display(self):
        """Human readable file size."""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
    
    @property
    def duration(self):
        """How long the translation took."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
    
    def mark_processing(self):
        self.status = 'processing'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])
    
    def mark_completed(self, translated_file_path, translated_name):
        self.status = 'completed'
        self.translated_file = translated_file_path
        self.translated_name = translated_name
        self.completed_at = timezone.now()
        self.progress_percent = 100
        self.save(update_fields=['status', 'translated_file', 'translated_name', 'completed_at', 'progress_percent'])
    
    def mark_failed(self, error):
        self.status = 'failed'
        self.error_message = str(error)[:500]
        self.save(update_fields=['status', 'error_message'])


class DocumentTemplate(models.Model):
    """Pre-saved document templates for quick use."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='document_templates'
    )
    name = models.CharField(max_length=200)
    source_lang = models.CharField(max_length=10)
    target_lang = models.CharField(max_length=10)
    output_format = models.CharField(max_length=10, default='pdf')
    preserve_formatting = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'document_templates'
        unique_together = ['user', 'name']
    
    def __str__(self):
        return f"{self.name} | {self.user.email}"