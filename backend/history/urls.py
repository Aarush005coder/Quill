from django.urls import path
from . import views

urlpatterns = [
    # Unified history
    path("", views.unified_history, name="unified-history"),

    # History statistics
    path("stats/", views.history_stats, name="history-stats"),

    # Delete single history item
    path(
        "<uuid:item_id>/",
        views.delete_history_item,
        name="delete-history-item",
    ),

    # Delete all history
    path(
        "delete-all/",
        views.delete_all_history,
        name="delete-all-history",
    ),
]