from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [

    path(
        "admin/",
        admin.site.urls,
    ),

    # =========================================================
    # AUTH
    # =========================================================

    path(
        "api/auth/",
        include("users.urls"),
    ),

    # =========================================================
    # TRANSLATION
    # =========================================================

    path(
        "api/translation/",
        include("translation.urls"),
    ),

    # =========================================================
    # OTHER APPS
    # =========================================================

    path(
        "api/tools/",
        include("tools.urls"),
    ),

    path(
        "api/documents/",
        include("documents.urls"),
    ),

    path(
        "api/history/",
        include("history.urls"),
    ),

    path(
        "api/combine/",
        include("combine.urls"),
    ),

    path(
        "api/about/",
        include("about.urls"),
    ),

    path(
        "api/settings/",
        include("settings_app.urls"),
    ),
]


# =============================================================
# MEDIA FILES — DEVELOPMENT
# =============================================================

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
