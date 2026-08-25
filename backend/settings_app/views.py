from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import (
    AppSettings,
    AutoSaveData,
    CustomShortcut,
    BlockedLanguage,
)
from .serializers import (
    AppSettingsSerializer,
    AutoSaveDataSerializer,
    CustomShortcutSerializer,
    BlockedLanguageSerializer,
)


# ============================================================
# APP SETTINGS (GET / PATCH)
# ============================================================

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def app_settings(request):
    """
    GET: Fetch user settings.
    PATCH: Update specific user settings.
    """
    # Get or create settings for the logged-in user
    settings_obj, _ = AppSettings.objects.get_or_create(user=request.user)

    if request.method == "GET":
        serializer = AppSettingsSerializer(settings_obj)
        return Response(
            {
                "success": True,
                "data": serializer.data,
            }
        )

    elif request.method == "PATCH":
        serializer = AppSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,  # Allows partial updates
        )

        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "success": True,
                    "data": serializer.data,
                    "message": "Settings updated successfully.",
                }
            )

        return Response(
            {
                "success": False,
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# RESET SETTINGS (POST)
# ============================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reset_settings(request):
    """
    Resets user settings to default by deleting the current record.
    The next GET request will automatically create a fresh one with defaults.
    """
    try:
        settings_obj = AppSettings.objects.get(user=request.user)
        settings_obj.delete()
    except AppSettings.DoesNotExist:
        pass  # Already reset or never created

    return Response(
        {
            "success": True,
            "message": "Settings have been reset to default.",
        }
    )


# ============================================================
# AUTO SAVE DATA (GET / POST)
# ============================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def autosave_data(request):
    """
    GET: List all autosave drafts for the user.
    POST: Create or update an autosave draft.
    """
    if request.method == "GET":
        drafts = AutoSaveData.objects.filter(user=request.user)
        serializer = AutoSaveDataSerializer(drafts, many=True)
        return Response({"success": True, "data": serializer.data})

    elif request.method == "POST":
        draft_type = request.data.get("draft_type")
        page_url = request.data.get("page_url", "")
        draft_data = request.data.get("draft_data", {})

        if not draft_type:
            return Response(
                {"success": False, "message": "draft_type is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update existing or create new based on unique_together constraint
        obj, created = AutoSaveData.objects.update_or_create(
            user=request.user,
            draft_type=draft_type,
            page_url=page_url,
            defaults={"draft_data": draft_data},
        )

        serializer = AutoSaveDataSerializer(obj)
        return Response(
            {"success": True, "data": serializer.data},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ============================================================
# DELETE AUTO SAVE (DELETE)
# ============================================================

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_autosave(request, draft_id):
    """
    Delete a specific autosave draft.
    """
    draft = get_object_or_404(AutoSaveData, id=draft_id, user=request.user)
    draft.delete()
    return Response({"success": True, "message": "Draft deleted."})


# ============================================================
# CUSTOM SHORTCUTS (GET / POST)
# ============================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def shortcuts(request):
    """
    GET: List all custom shortcuts.
    POST: Create a new custom shortcut.
    """
    if request.method == "GET":
        shortcuts_list = CustomShortcut.objects.filter(user=request.user)
        serializer = CustomShortcutSerializer(shortcuts_list, many=True)
        return Response({"success": True, "data": serializer.data})

    elif request.method == "POST":
        serializer = CustomShortcutSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(
                {"success": True, "data": serializer.data},
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"success": False, "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# DELETE SHORTCUT (DELETE)
# ============================================================

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_shortcut(request, shortcut_id):
    """
    Delete a specific custom shortcut.
    """
    shortcut = get_object_or_404(CustomShortcut, id=shortcut_id, user=request.user)
    shortcut.delete()
    return Response({"success": True, "message": "Shortcut deleted."})


# ============================================================
# BLOCKED LANGUAGES (GET / POST)
# ============================================================

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def blocked_languages(request):
    """
    GET: List all blocked languages.
    POST: Block a new language.
    """
    if request.method == "GET":
        blocked_list = BlockedLanguage.objects.filter(user=request.user)
        serializer = BlockedLanguageSerializer(blocked_list, many=True)
        return Response({"success": True, "data": serializer.data})

    elif request.method == "POST":
        serializer = BlockedLanguageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(
                {"success": True, "data": serializer.data},
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {"success": False, "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# UNBLOCK LANGUAGE (DELETE)
# ============================================================

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def unblock_language(request, language_code):
    """
    Unblock a specific language.
    """
    try:
        blocked_obj = BlockedLanguage.objects.get(
            user=request.user, language_code=language_code
        )
        blocked_obj.delete()
        return Response({"success": True, "message": "Language unblocked."})
    except BlockedLanguage.DoesNotExist:
        return Response(
            {"success": False, "message": "Language not found in blocked list."},
            status=status.HTTP_404_NOT_FOUND,
        )