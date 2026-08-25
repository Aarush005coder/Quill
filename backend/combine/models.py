import os
import uuid

from django.conf import settings
from django.db import models


# ============================================================
# FILE UPLOAD PATH
# ============================================================

def combine_upload_path(instance, filename):
    """
    Generates a unique upload path for CombineOperation files.

    Example:
        combine/12/pdf_merge/8f3a....pdf
    """

    _, ext = os.path.splitext(filename)

    ext = ext.lower()

    if not ext:
        ext = ".bin"

    return (
        "combine/"
        f"{instance.user.id}/"
        f"{instance.operation_type}/"
        f"{uuid.uuid4().hex}"
        f"{ext}"
    )


# ============================================================
# COMBINE OPERATION
# ============================================================

class CombineOperation(models.Model):
    """
    Stores every Combine / Convert / PDF operation
    performed by a user.
    """

    # ========================================================
    # OPERATION TYPES
    # ========================================================

    OPERATION_TYPES = [
        # ----------------------------------------------------
        # PDF
        # ----------------------------------------------------
        ("pdf_merge", "PDF Merge"),
        ("split_pdf", "Split PDF"),
        ("organize_pdf", "Organize PDF"),

        # ----------------------------------------------------
        # IMAGE
        # ----------------------------------------------------
        ("image_merge", "Image Merge"),
        ("image_to_pdf", "Image to PDF"),
        ("image_convert", "Image Converter"),

        # ----------------------------------------------------
        # WORD
        # ----------------------------------------------------
        ("word_merge", "Word Merge"),

        # ----------------------------------------------------
        # PDF <-> WORD
        # ----------------------------------------------------
        ("pdf_to_word", "PDF to Word"),
        ("word_to_pdf", "Word to PDF"),

        # ----------------------------------------------------
        # PDF OPTIMIZATION
        # ----------------------------------------------------
        ("compress_pdf", "PDF Compress"),
        ("rotate_pdf", "Rotate PDF"),
        ("nup_pdf", "N-up PDF"),

        # ----------------------------------------------------
        # PDF EDITING
        # ----------------------------------------------------
        ("watermark_pdf", "Watermark PDF"),
        ("pdf_color_enhance", "PDF Color Enhance"),

        # ----------------------------------------------------
        # EXCEL
        # ----------------------------------------------------
        ("pdf_to_excel", "PDF to Excel"),
        ("excel_to_pdf", "Excel to PDF"),
    ]

    # ========================================================
    # STATUS
    # ========================================================

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    # ========================================================
    # PRIMARY KEY
    # ========================================================

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # ========================================================
    # USER
    # ========================================================

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="combine_operations",
    )

    # ========================================================
    # OPERATION TYPE
    # ========================================================

    operation_type = models.CharField(
        max_length=40,
        choices=OPERATION_TYPES,
        db_index=True,
    )

    # ========================================================
    # STATUS
    # ========================================================

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        db_index=True,
    )

    # ========================================================
    # INPUT FILE INFORMATION
    # ========================================================

    input_files = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "List of input file names or paths."
        ),
    )

    input_count = models.PositiveSmallIntegerField(
        default=0,
    )

    # ========================================================
    # OUTPUT FILE
    # ========================================================

    output_file = models.FileField(
        upload_to=combine_upload_path,
        blank=True,
        null=True,
    )

    output_name = models.CharField(
        max_length=500,
        blank=True,
        default="",
    )

    output_size = models.PositiveBigIntegerField(
        default=0,
    )

    # ========================================================
    # OPERATION OPTIONS
    # ========================================================

    options = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Operation-specific settings stored as JSON."
        ),
    )

    # ========================================================
    # EXAMPLES OF OPTIONS
    #
    # PDF COMPRESS
    # {
    #     "quality": "medium"
    # }
    #
    # ROTATE PDF
    # {
    #     "rotation": 90,
    #     "pages": "all"
    # }
    #
    # SPLIT PDF
    # {
    #     "split_mode": "keep",
    #     "split_pages": "1-5,7,9",
    #     "split_parity": "all"
    # }
    #
    # ORGANIZE PDF
    # {
    #     "page_order": "4,1,2,3,5"
    # }
    #
    # WATERMARK PDF
    # {
    #     "watermark_text": "Confidential",
    #     "watermark_pages": "custom",
    #     "watermark_custom_pages": "1-5,7,9",
    #     "watermark_size": "medium"
    # }
    #
    # PDF COLOR ENHANCE
    # {
    #     "effects": [
    #         "whiten",
    #         "high_contrast",
    #         "sharpen"
    #     ],
    #     "intensity": 70
    # }
    #
    # N-UP PDF
    # {
    #     "pages_per_sheet": 4,
    #     "spacing": "small",
    #     "border": true,
    #     "layout": "grid",
    #     "page_size": "a4",
    #     "orientation": "portrait",
    #     "margin": "medium",
    #     "fit_mode": "fit"
    # }
    #
    # PDF TO EXCEL
    # {
    #     "pages": "all",
    #     "format": "xlsx"
    # }
    #
    # EXCEL TO PDF
    # {
    #     "sheet": "all",
    #     "format": "pdf"
    # }
    # ========================================================

    # ========================================================
    # TIMESTAMPS
    # ========================================================

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    completed_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    # ========================================================
    # ERROR
    # ========================================================

    error_message = models.TextField(
        blank=True,
        default="",
    )

    # ========================================================
    # META
    # ========================================================

    class Meta:
        db_table = "combine_operations"

        ordering = [
            "-created_at",
        ]

        indexes = [
            models.Index(
                fields=[
                    "user",
                    "-created_at",
                ],
                name="combine_user_created_idx",
            ),

            models.Index(
                fields=[
                    "user",
                    "operation_type",
                ],
                name="combine_user_type_idx",
            ),

            models.Index(
                fields=[
                    "user",
                    "status",
                ],
                name="combine_user_status_idx",
            ),

            models.Index(
                fields=[
                    "operation_type",
                    "created_at",
                ],
                name="combine_type_created_idx",
            ),
        ]

    # ========================================================
    # STRING REPRESENTATION
    # ========================================================

    def __str__(self):
        try:
            operation_name = (
                self.get_operation_type_display()
            )
        except Exception:
            operation_name = (
                self.operation_type
            )

        user_email = getattr(
            self.user,
            "email",
            str(self.user),
        )

        return (
            f"{operation_name} | "
            f"{user_email} | "
            f"{self.status}"
        )

    # ========================================================
    # OUTPUT SIZE DISPLAY
    # ========================================================

    @property
    def output_size_display(self):
        """
        Human-readable output file size.
        """

        try:
            size = int(
                self.output_size or 0
            )
        except (
            TypeError,
            ValueError,
        ):
            size = 0

        if size <= 0:
            return "0 B"

        if size < 1024:
            return f"{size} B"

        if size < 1024 * 1024:
            return (
                f"{size / 1024:.1f} KB"
            )

        if size < 1024 * 1024 * 1024:
            return (
                f"{size / (1024 * 1024):.2f} MB"
            )

        return (
            f"{size / (1024 * 1024 * 1024):.2f} GB"
        )

    # ========================================================
    # OUTPUT FILE EXISTS
    # ========================================================

    @property
    def output_file_exists(self):
        """
        Safely checks whether generated output exists.
        """

        try:
            if not self.output_file:
                return False

            path = self.output_file.path

            return bool(
                path and os.path.exists(path)
            )

        except (
            ValueError,
            AttributeError,
            OSError,
        ):
            return False

    # ========================================================
    # DELETE OUTPUT FILE
    # ========================================================

    def delete_output_file(self):
        """
        Deletes generated physical file.
        """

        try:
            if (
                self.output_file
                and self.output_file_exists
            ):
                self.output_file.delete(
                    save=False
                )

        except (
            ValueError,
            AttributeError,
            OSError,
        ):
            pass

    # ========================================================
    # DELETE MODEL + OUTPUT FILE
    # ========================================================

    def delete(self, *args, **kwargs):
        """
        Delete database record and associated file.
        """

        self.delete_output_file()

        super().delete(
            *args,
            **kwargs
        )
