# backend/users/email_utils.py

from django.core.mail import send_mail
from django.conf import settings
import logging
import traceback

logger = logging.getLogger(__name__)


def send_otp_email(to_email: str, otp_code: str, purpose: str = 'login', user_name: str = ''):
    """
    Send OTP email via Brevo SMTP using Django send_mail.
    Returns: (success: bool, error_message: str | None)
    """
    name = user_name or 'User'

    if purpose == 'register':
        subject = 'Quill - Verify Your Account'
        body = (
            f'Hi {name},\n\n'
            f'Welcome to Quill! Your OTP code is: {otp_code}\n\n'
            f'This code expires in 10 minutes.\n\n'
            f'If you did not create this account, please ignore this email.\n\n'
            f'- Quill Team'
        )
    elif purpose == 'password_reset':
        subject = 'Quill - Password Reset OTP'
        body = (
            f'Hi {name},\n\n'
            f'You requested to reset your password for your Quill account.\n\n'
            f'Your OTP verification code is: {otp_code}\n\n'
            f'This code expires in 10 minutes. Do not share it with anyone.\n\n'
            f'If you did not request this, please ignore this email.\n\n'
            f'- Quill Team'
        )
    elif purpose == '2fa_fallback':
        subject = 'Quill - Two-Factor Authentication Code'
        body = (
            f'Hi {name},\n\n'
            f'Your two-factor authentication fallback code is: {otp_code}\n\n'
            f'This code expires in 5 minutes. Do not share it with anyone.\n\n'
            f'- Quill Team'
        )
    else:
        # Default for 'login' or any other purpose
        subject = 'Quill - Your Login OTP'
        body = (
            f'Hi {name},\n\n'
            f'Your login OTP code is: {otp_code}\n\n'
            f'This code expires in 10 minutes. Do not share it with anyone.\n\n'
            f'- Quill Team'
        )

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info(f"✅ Email sent successfully to {to_email} for purpose: {purpose}")
        return True, None

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Email failed for {to_email}: {error_msg}")
        traceback.print_exc()  # Yeh terminal mein exact error dikhayega
        return False, error_msg


def send_translation_complete_email(to_email: str, user_name: str, char_count: int, source_lang: str, target_lang: str):
    """
    Send an email notification when a translation is completed.
    Returns: (success: bool, error_message: str | None)
    """
    name = user_name or 'User'
    source_display = source_lang.upper() if source_lang != "auto" else "Auto-Detected"
    target_display = target_lang.upper()

    subject = 'Quill - Your Translation is Complete! 🎉'
    body = (
        f'Hi {name},\n\n'
        f'Great news! Your translation has been successfully completed.\n\n'
        f'Translation Details:\n'
        f'• Characters translated: {char_count}\n'
        f'• Source Language: {source_display}\n'
        f'• Target Language: {target_display}\n\n'
        f'You can view your full translation history anytime in your Quill dashboard.\n\n'
        f'Happy Translating!\n'
        f'- Quill Team'
    )

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info(f"✅ Translation complete email sent to {to_email}")
        return True, None

    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ Translation email failed for {to_email}: {error_msg}")
        traceback.print_exc()
        return False, error_msg