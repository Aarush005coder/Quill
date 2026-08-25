import calendar
from datetime import datetime, timedelta
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import (
    DailyUsageStats, WeeklyUsageStats, MonthlyUsageStats,
    LanguageUsageStats, UserActivityLog
)
from translation.models import TranslationHistory
from tools.models import ToolHistory
from documents.models import DocumentUpload
from combine.models import CombineOperation


# ═════════════════════════════════════════════════════════════════
# DASHBOARD OVERVIEW
# ═════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_overview(request):
    """Get overall dashboard stats for the user."""
    user = request.user
    
    # Total counts (all time)
    total_translations = TranslationHistory.objects.filter(user=user).count()
    total_tools = ToolHistory.objects.filter(user=user).count()
    total_documents = DocumentUpload.objects.filter(user=user).count()
    total_combine = CombineOperation.objects.filter(user=user).count()
    
    # This month
    today = timezone.now().date()
    month_start = today.replace(day=1)
    
    monthly_translations = TranslationHistory.objects.filter(
        user=user, created_at__date__gte=month_start
    ).count()
    
    monthly_chars = TranslationHistory.objects.filter(
        user=user, created_at__date__gte=month_start
    ).aggregate(total=Sum('char_count'))['total'] or 0
    
    # Usage limits
    char_limit = user.monthly_translation_limit
    char_used = user.monthly_translation_chars
    char_percent = min(100, round((char_used / char_limit) * 100)) if char_limit > 0 else 0
    
    doc_limit = user.monthly_document_limit
    doc_used = user.monthly_document_pages
    doc_percent = min(100, round((doc_used / doc_limit) * 100)) if doc_limit > 0 else 0
    
    # Recent activity
    recent_logs = UserActivityLog.objects.filter(user=user)[:10]
    recent_activity = [{
        'type': log.activity_type,
        'description': log.description,
        'time': log.created_at.isoformat()
    } for log in recent_logs]
    
    return Response({
        'success': True,
        'data': {
            'totals': {
                'translations': total_translations,
                'tools_used': total_tools,
                'documents': total_documents,
                'combine_operations': total_combine,
            },
            'this_month': {
                'translations': monthly_translations,
                'chars_translated': monthly_chars,
            },
            'usage': {
                'translation_chars': {
                    'used': char_used,
                    'limit': char_limit,
                    'percent': char_percent,
                    'remaining': max(0, char_limit - char_used)
                },
                'document_pages': {
                    'used': doc_used,
                    'limit': doc_limit,
                    'percent': doc_percent,
                    'remaining': max(0, doc_limit - doc_used)
                }
            },
            'plan': {
                'current': user.plan,
                'is_premium': user.is_premium,
                'expires_at': user.plan_expires_at.isoformat() if user.plan_expires_at else None
            },
            'recent_activity': recent_activity
        }
    })


# ═════════════════════════════════════════════════════════════════
# TRANSLATION ANALYTICS
# ═════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def translation_analytics(request):
    """Get translation usage analytics."""
    user = request.user
    period = request.query_params.get('period', '7d')  # 7d, 30d, 90d, 1y
    
    # Calculate date range
    days_map = {'7d': 7, '30d': 30, '90d': 90, '1y': 365}
    days = days_map.get(period, 7)
    start_date = timezone.now().date() - timedelta(days=days)
    
    # Daily breakdown
    daily_stats = DailyUsageStats.objects.filter(
        user=user, date__gte=start_date
    ).order_by('date')
    
    labels = []
    translation_data = []
    char_data = []
    
    for stat in daily_stats:
        labels.append(stat.date.strftime('%b %d'))
        translation_data.append(stat.translations_count)
        char_data.append(stat.translation_chars)
    
    # Mode distribution
    mode_stats = TranslationHistory.objects.filter(
        user=user, created_at__date__gte=start_date
    ).values('mode').annotate(count=Count('id'))
    
    mode_distribution = {
        item['mode']: item['count'] for item in mode_stats
    }
    
    # Top language pairs
    top_languages = LanguageUsageStats.objects.filter(
        user=user
    ).order_by('-usage_count')[:5]
    
    language_pairs = [{
        'source': lang.source_lang,
        'target': lang.target_lang,
        'count': lang.usage_count
    } for lang in top_languages]
    
    return Response({
        'success': True,
        'data': {
            'period': period,
            'labels': labels,
            'datasets': {
                'translations': translation_data,
                'characters': char_data
            },
            'mode_distribution': mode_distribution,
            'top_language_pairs': language_pairs,
            'total_in_period': sum(translation_data),
            'total_chars_in_period': sum(char_data)
        }
    })


# ═════════════════════════════════════════════════════════════════
# TOOLS ANALYTICS
# ═════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tools_analytics(request):
    """Get tools usage analytics."""
    user = request.user
    period = request.query_params.get('period', '30d')
    days = {'7d': 7, '30d': 30, '90d': 90, '1y': 365}.get(period, 30)
    start_date = timezone.now().date() - timedelta(days=days)
    
    # Tool type distribution
    tool_stats = ToolHistory.objects.filter(
        user=user, created_at__date__gte=start_date
    ).values('tool_type').annotate(count=Count('id'))
    
    tool_distribution = []
    for item in tool_stats:
        tool_distribution.append({
            'type': item['tool_type'],
            'count': item['count']
        })
    
    # Monthly trend
    monthly = MonthlyUsageStats.objects.filter(
        user=user,
        date__gte=start_date.replace(day=1) if hasattr(start_date, 'replace') else start_date
    ).order_by('year', 'month')[:12]
    
    monthly_labels = []
    monthly_values = []
    for m in monthly:
        monthly_labels.append(f"{calendar.month_abbr[m.month]} {m.year}")
        monthly_values.append(m.tools_usage_count)
    
    return Response({
        'success': True,
        'data': {
            'period': period,
            'tool_distribution': tool_distribution,
            'monthly_trend': {
                'labels': monthly_labels,
                'values': monthly_values
            },
            'total_tools_used': sum(t['count'] for t in tool_distribution)
        }
    })


# ═════════════════════════════════════════════════════════════════
# DOCUMENT ANALYTICS
# ═════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def document_analytics(request):
    """Get document upload and translation analytics."""
    user = request.user
    
    # Status breakdown
    status_stats = DocumentUpload.objects.filter(user=user).values('status').annotate(count=Count('id'))
    status_breakdown = {item['status']: item['count'] for item in status_stats}
    
    # File type distribution
    type_stats = DocumentUpload.objects.filter(user=user).values('file_type').annotate(count=Count('id'))
    file_types = [{ 'type': item['file_type'], 'count': item['count'] } for item in type_stats]
    
    # Total pages translated
    total_pages = DocumentUpload.objects.filter(user=user).aggregate(total=Sum('page_count'))['total'] or 0
    
    # Recent uploads
    recent = DocumentUpload.objects.filter(user=user).order_by('-uploaded_at')[:5]
    recent_docs = [{
        'name': doc.original_name,
        'status': doc.status,
        'pages': doc.page_count,
        'date': doc.uploaded_at.isoformat()
    } for doc in recent]
    
    return Response({
        'success': True,
        'data': {
            'status_breakdown': status_breakdown,
            'file_type_distribution': file_types,
            'total_pages_translated': total_pages,
            'recent_uploads': recent_docs
        }
    })


# ═════════════════════════════════════════════════════════════════
# COMBINE ANALYTICS
# ═════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def combine_analytics(request):
    """Get file combine/merge operation analytics."""
    user = request.user
    
    # Operation type distribution
    op_stats = CombineOperation.objects.filter(user=user).values('operation_type').annotate(count=Count('id'))
    operations = [{ 'type': item['operation_type'], 'count': item['count'] } for item in op_stats]
    
    # Success rate
    total = CombineOperation.objects.filter(user=user).count()
    completed = CombineOperation.objects.filter(user=user, status='completed').count()
    success_rate = round((completed / total) * 100, 1) if total > 0 else 0
    
    return Response({
        'success': True,
        'data': {
            'operation_distribution': operations,
            'total_operations': total,
            'completed': completed,
            'success_rate': success_rate
        }
    })


# ═════════════════════════════════════════════════════════════════
# ACTIVITY TIMELINE
# ═════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def activity_timeline(request):
    """Get detailed activity timeline."""
    user = request.user
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    
    logs = UserActivityLog.objects.filter(user=user).order_by('-created_at')
    total = logs.count()
    start = (page - 1) * page_size
    end = start + page_size
    
    activities = [{
        'id': str(log.id),
        'type': log.activity_type,
        'type_display': log.get_activity_type_display(),
        'description': log.description,
        'ip_address': log.ip_address,
        'time': log.created_at.isoformat(),
        'time_ago': get_time_ago(log.created_at)
    } for log in logs[start:end]]
    
    return Response({
        'success': True,
        'total': total,
        'page': page,
        'page_size': page_size,
        'data': activities
    })


def get_time_ago(dt):
    from django.utils.timesince import timesince
    return timesince(dt) + " ago"