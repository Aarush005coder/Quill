from django.urls import path
from . import views

urlpatterns = [
    # ─── Upload & List ───────────────────────────────────────────
    path('upload/', views.DocumentUploadView.as_view(), name='document-upload'),
    path('list/', views.DocumentListView.as_view(), name='document-list'),
    path('<uuid:pk>/', views.DocumentDetailView.as_view(), name='document-detail'),
    
    # ─── Downloads ───────────────────────────────────────────────
    path('<uuid:pk>/download/', views.download_document, name='document-download'),
    path('<uuid:pk>/download-original/', views.download_original, name='document-download-original'),
    
    # ─── Delete ──────────────────────────────────────────────────
    path('<uuid:pk>/delete/', views.delete_document, name='document-delete'),
    
    # ─── Templates ───────────────────────────────────────────────
    path('templates/', views.DocumentTemplateView.as_view(), name='document-templates'),
    path('templates/<uuid:pk>/delete/', views.delete_template, name='delete-template'),
]