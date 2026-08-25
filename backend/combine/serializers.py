from django.utils.timesince import timesince
from rest_framework import serializers

from .models import CombineOperation


class CombineOperationSerializer(serializers.ModelSerializer):
    """
    Serializer for CombineOperation history API.

    Provides:
    - Human-readable operation type
    - Human-readable status
    - Relative time
    - Formatted output size
    - Download URL for completed operations
    """

    # =========================================================
    # DISPLAY FIELDS
    # =========================================================

    operation_type_display = serializers.CharField(
        source="get_operation_type_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    # =========================================================
    # COMPUTED FIELDS
    # =========================================================

    time_ago = serializers.SerializerMethodField()

    output_size_display = serializers.SerializerMethodField()

    download_url = serializers.SerializerMethodField()

    # =========================================================
    # META
    # =========================================================

    class Meta:
        model = CombineOperation

        fields = [
            "id",

            # Operation
            "operation_type",
            "operation_type_display",

            # Status
            "status",
            "status_display",

            # Input
            "input_count",

            # Output
            "output_name",
            "output_size",
            "output_size_display",

            # Options
            "options",

            # Computed
            "time_ago",
            "download_url",

            # Dates
            "created_at",
            "completed_at",

            # Error
            "error_message",
        ]

        read_only_fields = [
            "id",
            "operation_type_display",
            "status_display",
            "input_count",
            "output_name",
            "output_size",
            "output_size_display",
            "options",
            "time_ago",
            "download_url",
            "created_at",
            "completed_at",
            "error_message",
        ]

    # =========================================================
    # TIME AGO
    # =========================================================

    def get_time_ago(self, obj):
        """
        Return something like:
        - 'just now'
        - '2 minutes ago'
        - '3 hours ago'
        - '2 days ago'
        """

        try:
            if not obj.created_at:
                return "just now"

            return f"{timesince(obj.created_at)} ago"

        except Exception:
            return "just now"

    # =========================================================
    # OUTPUT SIZE
    # =========================================================

    def get_output_size_display(self, obj):
        """
        Convert bytes into human-readable format.
        """

        try:
            size = int(obj.output_size or 0)
        except (TypeError, ValueError):
            size = 0

        if size <= 0:
            return "0 B"

        if size < 1024:
            return f"{size} B"

        if size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"

        if size < 1024 * 1024 * 1024:
            return f"{size / (1024 * 1024):.2f} MB"

        return f"{size / (1024 * 1024 * 1024):.2f} GB"

    # =========================================================
    # DOWNLOAD URL
    # =========================================================

    def get_download_url(self, obj):
        """
        Return download endpoint only when:
        - operation is completed
        - output file exists
        """

        try:
            if (
                obj.status == "completed"
                and obj.output_file
            ):
                request = self.context.get("request")

                relative_url = (
                    f"/api/combine/"
                    f"{obj.id}/download/"
                )

                # If serializer is used inside a request,
                # return absolute URL.
                if request is not None:
                    return request.build_absolute_uri(
                        relative_url
                    )

                return relative_url

        except Exception:
            pass

        return None