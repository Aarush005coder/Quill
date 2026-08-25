from django.urls import path
from . import views

urlpatterns = [
    # ─── Dashboard ───────────────────────────────────────────────
    path('dashboard/', views.dashboard_overview, name='analytics-dashboard'),
    
    # ─── Detailed Analytics ──────────────────────────────────────
    path('translations/', views.translation_analytics, name='translation-analytics'),
    path('tools/', views.tools_analytics, name='tools-analytics'),
    path('documents/', views.document_analytics, name='document-analytics'),
    path('combine/', views.combine_analytics, name='combine-analytics'),
    
    # ─── Activity ────────────────────────────────────────────────
    path('activity/', views.activity_timeline, name='activity-timeline'),
]