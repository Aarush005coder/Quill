from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import UnifiedHistory
from .serializers import UnifiedHistorySerializer
from combine.models import CombineOperation


# ============================================================
# HELPERS
# ============================================================

COMBINE_OPERATION_LABELS = {
    "pdf_merge": "PDF Merge",
    "split_pdf": "Split PDF",
    "image_merge": "Image Merge",
    "image_to_pdf": "Image to PDF",
    "image_convert": "Image Converter",
    "word_merge": "Word Merge",
    "pdf_to_word": "PDF to Word",
    "word_to_pdf": "Word to PDF",
    "compress_pdf": "PDF Compress",
    "rotate_pdf": "Rotate PDF",
    "organize_pdf": "Organize PDF",
    "watermark_pdf": "Watermark PDF",
    "pdf_color_enhance": "PDF Color Enhance",
    "nup_pdf": "N-up PDF",
    "pdf_to_excel": "PDF to Excel",
    "excel_to_pdf": "Excel to PDF",
}


def combine_category_metadata(operation):
    """
    Convert CombineOperation into UnifiedHistory-compatible metadata.
    """

    options = operation.options or {}

    metadata = {
        "files": operation.input_count or 1,
        "operation": operation.operation_type,
        "status": operation.status,
    }

    if operation.output_name:
        metadata["output"] = operation.output_name

    if operation.output_size:
        metadata["output_size"] = operation.output_size

    if options:
        metadata.update(options)

    return metadata


def get_combine_title(operation):
    """
    Return user-friendly title for CombineOperation.
    """

    return COMBINE_OPERATION_LABELS.get(
        operation.operation_type,
        str(
            operation.operation_type or "Operation"
        ).replace("_", " ").title(),
    )


def get_combine_description(operation):
    """
    Generate readable history description.
    """

    title = get_combine_title(operation)

    if operation.status == "completed":

        if operation.output_name:
            return (
                f"{title} completed successfully. "
                f"Output: {operation.output_name}"
            )

        return f"{title} completed successfully."

    if operation.status == "failed":

        description = f"{title} failed."

        if operation.error_message:
            description += (
                f" {operation.error_message[:300]}"
            )

        return description

    if operation.status == "processing":
        return f"{title} is currently processing."

    return f"{title} is pending."


def sync_combine_history_for_user(user):
    """
    Automatically creates missing UnifiedHistory rows
    for CombineOperation records.

    Existing UnifiedHistory entries are never duplicated.

    Only the currently authenticated user's records
    are synchronized.
    """

    if user is None or not user.is_authenticated:
        return 0

    operations = (
        CombineOperation.objects
        .filter(user=user)
        .order_by("created_at")
    )

    existing_source_ids = set(
        UnifiedHistory.objects.filter(
            user=user,
            source_app="combine",
            source_model="CombineOperation",
        ).values_list(
            "source_id",
            flat=True,
        )
    )

    history_objects_to_create = []

    for operation in operations:

        source_id = str(operation.id)

        if source_id in existing_source_ids:
            continue

        history_objects_to_create.append(
            UnifiedHistory(
                user=user,
                history_type="combine",
                title=get_combine_title(operation),
                description=get_combine_description(
                    operation
                ),
                source_app="combine",
                source_model="CombineOperation",
                source_id=source_id,
                metadata=combine_category_metadata(
                    operation
                ),
                output_file=(
                    operation.output_file
                    if operation.output_file
                    else None
                ),
                status=(
                    "completed"
                    if operation.status == "completed"
                    else (
                        "failed"
                        if operation.status == "failed"
                        else "processing"
                    )
                ),
                created_at=operation.created_at,
            )
        )

    if not history_objects_to_create:
        return 0

    with transaction.atomic():
        UnifiedHistory.objects.bulk_create(
            history_objects_to_create
        )

    return len(history_objects_to_create)


# ============================================================
# UNIFIED HISTORY
# ============================================================

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def unified_history(request):
    """
    Return complete history for the currently
    authenticated user.

    CombineOperation records are synchronized before
    returning the unified history.
    """

    user = request.user

    # --------------------------------------------------------
    # Sync Combine history
    # --------------------------------------------------------

    sync_combine_history_for_user(user)

    history_type = (
        request.query_params.get("type")
        or ""
    ).strip().lower()

    search = (
        request.query_params.get("search")
        or ""
    ).strip()

    # --------------------------------------------------------
    # Current user's history only
    # --------------------------------------------------------

    queryset = (
        UnifiedHistory.objects
        .filter(user=user)
    )

    # --------------------------------------------------------
    # Category filter
    # --------------------------------------------------------

    if history_type and history_type != "all":

        allowed_types = {
            "translate",
            "tools",
            "documents",
            "combine",
        }

        if history_type in allowed_types:
            queryset = queryset.filter(
                history_type=history_type
            )

    # --------------------------------------------------------
    # Search
    # --------------------------------------------------------

    if search:

        queryset = queryset.filter(
            Q(title__icontains=search)
            |
            Q(description__icontains=search)
            |
            Q(source_model__icontains=search)
            |
            Q(source_app__icontains=search)
        )

    # --------------------------------------------------------
    # Latest first
    # --------------------------------------------------------

    queryset = queryset.order_by(
        "-created_at"
    )

    # --------------------------------------------------------
    # Pagination
    # --------------------------------------------------------

    try:
        page = max(
            1,
            int(
                request.query_params.get(
                    "page",
                    1,
                )
            ),
        )
    except (
        TypeError,
        ValueError,
    ):
        page = 1

    try:
        page_size = min(
            100,
            max(
                1,
                int(
                    request.query_params.get(
                        "page_size",
                        20,
                    )
                ),
            ),
        )
    except (
        TypeError,
        ValueError,
    ):
        page_size = 20

    start = (
        page - 1
    ) * page_size

    end = (
        start + page_size
    )

    total = queryset.count()

    paginated_queryset = queryset[
        start:end
    ]

    serializer = UnifiedHistorySerializer(
        paginated_queryset,
        many=True,
        context={
            "request": request
        },
    )

    return Response(
        {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": serializer.data,
        },
        status=status.HTTP_200_OK,
    )


# ============================================================
# HISTORY STATS
# ============================================================

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def history_stats(request):
    """
    Return complete statistics for the currently
    authenticated user.
    """

    user = request.user

    # --------------------------------------------------------
    # Sync Combine
    # --------------------------------------------------------

    sync_combine_history_for_user(user)

    today = timezone.now().date()

    queryset = UnifiedHistory.objects.filter(
        user=user
    )

    # --------------------------------------------------------
    # Total counts
    # --------------------------------------------------------

    total_all = queryset.count()

    total_translate = queryset.filter(
        history_type="translate"
    ).count()

    total_tools = queryset.filter(
        history_type="tools"
    ).count()

    total_documents = queryset.filter(
        history_type="documents"
    ).count()

    total_combine = queryset.filter(
        history_type="combine"
    ).count()

    # --------------------------------------------------------
    # Today's counts
    # --------------------------------------------------------

    today_queryset = queryset.filter(
        created_at__date=today
    )

    today_all = today_queryset.count()

    today_translate = (
        today_queryset
        .filter(
            history_type="translate"
        )
        .count()
    )

    today_tools = (
        today_queryset
        .filter(
            history_type="tools"
        )
        .count()
    )

    today_documents = (
        today_queryset
        .filter(
            history_type="documents"
        )
        .count()
    )

    today_combine = (
        today_queryset
        .filter(
            history_type="combine"
        )
        .count()
    )

    return Response(
        {
            "success": True,
            "data": {
                "totals": {
                    "all": total_all,
                    "translate": total_translate,
                    "tools": total_tools,
                    "documents": total_documents,
                    "combine": total_combine,
                },
                "today": {
                    "all": today_all,
                    "translate": today_translate,
                    "tools": today_tools,
                    "documents": today_documents,
                    "combine": today_combine,
                },
            },
        },
        status=status.HTTP_200_OK,
    )


# ============================================================
# DELETE ONE HISTORY ITEM
# ============================================================

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_history_item(request, item_id):
    """
    Delete one UnifiedHistory item.

    If this history item belongs to CombineOperation,
    the original CombineOperation is also removed.
    """

    try:

        item = UnifiedHistory.objects.get(
            id=item_id,
            user=request.user,
        )

        source_app = item.source_app
        source_model = item.source_model
        source_id = item.source_id

        # ----------------------------------------------------
        # Delete output file
        # ----------------------------------------------------

        if item.output_file:

            try:

                if item.output_file.storage.exists(
                    item.output_file.name
                ):
                    item.output_file.delete(
                        save=False
                    )

            except Exception:
                pass

        # ----------------------------------------------------
        # Delete Combine source
        # ----------------------------------------------------

        if (
            source_app == "combine"
            and source_model == "CombineOperation"
            and source_id
        ):

            try:

                CombineOperation.objects.filter(
                    id=source_id,
                    user=request.user,
                ).delete()

            except Exception:
                pass

        # ----------------------------------------------------
        # Delete UnifiedHistory record
        # ----------------------------------------------------

        item.delete()

        return Response(
            {
                "success": True,
                "message": (
                    "History item deleted successfully."
                ),
            },
            status=status.HTTP_200_OK,
        )

    except UnifiedHistory.DoesNotExist:

        return Response(
            {
                "success": False,
                "error": (
                    "History item not found."
                ),
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    except Exception as exc:

        return Response(
            {
                "success": False,
                "error": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ============================================================
# DELETE ALL HISTORY
# ============================================================

@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_all_history(request):
    """
    Delete complete history for the currently
    authenticated user.

    CombineOperation records are also deleted,
    preventing them from being recreated during
    the next synchronization.
    """

    user = request.user

    try:

        # ----------------------------------------------------
        # Delete Combine operations
        # ----------------------------------------------------

        CombineOperation.objects.filter(
            user=user
        ).delete()

        # ----------------------------------------------------
        # Delete files
        # ----------------------------------------------------

        history_items = UnifiedHistory.objects.filter(
            user=user
        )

        for item in history_items:

            if item.output_file:

                try:

                    if item.output_file.storage.exists(
                        item.output_file.name
                    ):
                        item.output_file.delete(
                            save=False
                        )

                except Exception:
                    pass

        # ----------------------------------------------------
        # Delete history
        # ----------------------------------------------------

        history_items.delete()

        return Response(
            {
                "success": True,
                "message": (
                    "All history deleted successfully."
                ),
            },
            status=status.HTTP_200_OK,
        )

    except Exception as exc:

        return Response(
            {
                "success": False,
                "error": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )