from django.urls import path

from . import views


urlpatterns = [
    # ========================================================
    # APP SETTINGS
    # ========================================================

    path(
        "",
        views.app_settings,
        name="app-settings",
    ),

    path(
        "reset/",
        views.reset_settings,
        name="reset-settings",
    ),

    # ========================================================
    # AUTO SAVE
    # ========================================================

    path(
        "autosave/",
        views.autosave_data,
        name="autosave-data",
    ),

    path(
        "autosave/<uuid:draft_id>/",
        views.delete_autosave,
        name="delete-autosave",
    ),

    # ========================================================
    # CUSTOM SHORTCUTS
    # ========================================================

    path(
        "shortcuts/",
        views.shortcuts,
        name="shortcuts",
    ),

    path(
        "shortcuts/<uuid:shortcut_id>/",
        views.delete_shortcut,
        name="delete-shortcut",
    ),

    # ========================================================
    # BLOCKED LANGUAGES
    # ========================================================

    path(
        "blocked-languages/",
        views.blocked_languages,
        name="blocked-languages",
    ),

    path(
        "blocked-languages/<str:language_code>/",
        views.unblock_language,
        name="unblock-language",
    ),
]