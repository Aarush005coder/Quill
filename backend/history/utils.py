from .models import UnifiedHistory
import traceback


def save_to_history(
    user,
    history_type,
    title,
    description,
    source_app,
    source_model,
    source_id,
    metadata=None,
    output_file=None,
    status="completed",
):
    """
    Create a unified history record for the logged-in user.

    This function is used by:
        - translation
        - tools
        - documents
        - combine

    Parameters:
        user          : Django authenticated user
        history_type  : translate | tools | documents | combine
        title         : Activity title shown in HistoryPage
        description   : Human-readable description
        source_app    : Source Django app
        source_model  : Source model/view identifier
        source_id     : Original record ID
        metadata      : Extra frontend information
        output_file   : Relative media path or FileField-compatible value
        status        : completed | failed | processing
    """

    try:
        # ---------------------------------------------------------
        # VALIDATION
        # ---------------------------------------------------------

        if user is None:
            raise ValueError("User is required for history.")

        allowed_types = {
            "translate",
            "tools",
            "documents",
            "combine",
        }

        if history_type not in allowed_types:
            raise ValueError(
                f"Invalid history_type: {history_type}. "
                f"Allowed values: {', '.join(sorted(allowed_types))}"
            )

        allowed_statuses = {
            "completed",
            "failed",
            "processing",
        }

        if status not in allowed_statuses:
            status = "completed"

        # ---------------------------------------------------------
        # DUPLICATE PROTECTION
        # ---------------------------------------------------------
        #
        # The same operation should not create multiple unified
        # history rows when the endpoint is retried.
        #
        # source_app + source_model + source_id + user
        # uniquely identifies the originating operation.
        #
        # For source_id generated as UUID/random values this still
        # remains safe.
        # ---------------------------------------------------------

        existing = UnifiedHistory.objects.filter(
            user=user,
            source_app=str(source_app or ""),
            source_model=str(source_model or ""),
            source_id=str(source_id or ""),
        ).first()

        if existing:
            # Update the latest information instead of creating
            # duplicate rows.
            existing.history_type = history_type
            existing.title = title
            existing.description = description
            existing.metadata = metadata or {}
            existing.status = status

            if output_file:
                existing.output_file = output_file

            existing.save(
                update_fields=[
                    "history_type",
                    "title",
                    "description",
                    "metadata",
                    "status",
                    "output_file",
                    "updated_at",
                ]
            )

            print(
                f"✅ HISTORY UPDATED | "
                f"user={user.id} | "
                f"type={history_type} | "
                f"title={title} | "
                f"source={source_app}.{source_model} | "
                f"source_id={source_id} | "
                f"history_id={existing.id}"
            )

            return existing

        # ---------------------------------------------------------
        # CREATE NEW HISTORY
        # ---------------------------------------------------------

        history = UnifiedHistory.objects.create(
            user=user,
            history_type=history_type,
            title=str(title or "Activity"),
            description=str(description or ""),
            source_app=str(source_app or ""),
            source_model=str(source_model or ""),
            source_id=str(source_id or ""),
            metadata=metadata or {},
            output_file=output_file,
            status=status,
        )

        print(
            f"✅ HISTORY SAVED | "
            f"user={user.id} | "
            f"type={history_type} | "
            f"title={title} | "
            f"source={source_app}.{source_model} | "
            f"source_id={source_id} | "
            f"history_id={history.id}"
        )

        return history

    except Exception as exc:
        print(
            f"❌ HISTORY SAVE ERROR | "
            f"user={getattr(user, 'id', None)} | "
            f"type={history_type} | "
            f"title={title} | "
            f"error={exc}"
        )

        traceback.print_exc()

        # IMPORTANT:
        # History failure should not break the actual operation.
        return None