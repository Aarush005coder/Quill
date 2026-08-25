from django.urls import path

from .views import (
    language_list,
    TranslateView,
    DocumentPageTranslateView,
    SpeechToTextView,
    HistoryListView,
    toggle_favorite_history,
    delete_history,
    FavoriteListView,
    delete_favorite,
    SpeechProfileView,
)


urlpatterns = [

    # =========================================================
    # LANGUAGES
    # =========================================================

    path(
        "languages/",
        language_list,
        name="language-list",
    ),

    # =========================================================
    # NORMAL TEXT TRANSLATION
    #
    # POST:
    # /api/translation/translate/
    #
    # Existing endpoint.
    # Existing quota remains unchanged.
    # =========================================================

    path(
        "translate/",
        TranslateView.as_view(),
        name="translate",
    ),

    # =========================================================
    # DOCUMENT PAGE TRANSLATION
    #
    # POST:
    # /api/translation/document-page/
    #
    # Dedicated endpoint for DocumentsPage.
    # Documents get their own 50,000 character/month limit.
    # =========================================================

    path(
        "document-page/",
        DocumentPageTranslateView.as_view(),
        name="document-page-translate",
    ),

    # =========================================================
    # SPEECH
    #
    # POST:
    # /api/translation/speech-to-text/
    # =========================================================

    path(
        "speech-to-text/",
        SpeechToTextView.as_view(),
        name="speech-to-text",
    ),

    # =========================================================
    # SPEECH LEGACY ALIAS
    #
    # POST:
    # /api/translation/speech/
    #
    # Kept for backward compatibility.
    # =========================================================

    path(
        "speech/",
        SpeechToTextView.as_view(),
        name="speech",
    ),

    # =========================================================
    # HISTORY
    # =========================================================

    path(
        "history/",
        HistoryListView.as_view(),
        name="translation-history",
    ),

    path(
        "history/<uuid:pk>/favorite/",
        toggle_favorite_history,
        name="toggle-history-favorite",
    ),

    path(
        "history/<uuid:pk>/",
        delete_history,
        name="delete-history",
    ),

    # =========================================================
    # FAVORITES
    # =========================================================

    path(
        "favorites/",
        FavoriteListView.as_view(),
        name="favorite-list",
    ),

    path(
        "favorites/<uuid:pk>/",
        delete_favorite,
        name="delete-favorite",
    ),

    # =========================================================
    # SPEECH PROFILES
    # =========================================================

    path(
        "speech-profiles/",
        SpeechProfileView.as_view(),
        name="speech-profiles",
    ),
]