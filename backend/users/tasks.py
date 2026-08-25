# backend/users/tasks.py

from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Sum
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
import logging

from translation.models import TranslationHistory

User = get_user_model()
logger = logging.getLogger(__name__)

@shared_task
def send_weekly_reports():
    """
    Calculates translation stats for the last 7 days and emails users 
    who have 'weekly_report' enabled.
    """
    logger.info(" Starting Weekly Report generation...")
    
    # 1. Get the date 7 days ago
    seven_days_ago = timezone.now() - timedelta(days=7)
    
    # 2. Get all users who want weekly reports
    users_to_notify = User.objects.filter(weekly_report=True, is_active=True)
    
    if not users_to_notify.exists():
        logger.info("No users found with weekly_report enabled.")
        return

    for user in users_to_notify:
        try:
            # 3. Calculate stats for this specific user
            history = TranslationHistory.objects.filter(
                user=user, 
                created_at__gte=seven_days_ago
            )
            
            total_translations = history.count()
            total_chars = history.aggregate(total=Sum('char_count'))['total'] or 0
            
            # Find most used target language
            most_used_lang = history.values('target_lang').annotate(
                count=Count('target_lang')
            ).order_by('-count').first()
            
            top_lang = most_used_lang['target_lang'].upper() if most_used_lang else "N/A"
            
            # 4. Send the email
            if total_translations > 0:
                subject = "quill - Your Weekly Translation Report 📊"
                body = (
                    f"Hi {user.get_full_name() or user.email.split('@')[0]},\n\n"
                    f"Here is your translation activity for the last 7 days:\n\n"
                    f"🔹 Total Translations: {total_translations}\n"
                    f"🔹 Characters Translated: {total_chars:,}\n"
                    f"🔹 Most Used Target Language: {top_lang}\n\n"
                    f"Keep up the great work! You can view your full history on your dashboard.\n\n"
                    f"Best,\nquill Team"
                )
                
                send_mail(
                    subject=subject,
                    message=body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                logger.info(f"✅ Weekly report sent to {user.email}")
                
        except Exception as e:
            logger.error(f" Failed to send report to {user.email}: {e}")
            
    logger.info(" Weekly Report generation completed.")