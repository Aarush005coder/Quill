import requests
import logging
import traceback

from django.conf import settings

logger = logging.getLogger(__name__)


def _send_email_via_brevo(to_email: str, subject: str, text_content: str, html_content: str = None):
    """
    Helper function to send emails using Brevo's HTTP API.
    Bypasses SMTP port blocks on cloud platforms like Render.
    """
    api_key = getattr(settings, 'BREVO_API_KEY', '')
    
    if not api_key:
        error_msg = "BREVO_API_KEY is missing in environment variables."
        logger.error(f"❌ {error_msg}")
        return False, error_msg

    url = "https://api.brevo.com/v3/smtp/email"
    
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }
    
    # Brevo verified sender email
    sender_email = "khandelwalaarush2@gmail.com" 
    
    payload = {
        "sender": {
            "name": "Quill",
            "email": sender_email
        },
        "to": [
            {
                "email": to_email
            }
        ],
        "subject": subject,
        "textContent": text_content,
    }

    # Add HTML content if provided for better email formatting
    if html_content:
        payload["htmlContent"] = html_content

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        response.raise_for_status()
        logger.info(f"✅ Email successfully sent to {to_email} via Brevo API")
        return True, None

    except requests.exceptions.RequestException as e:
        error_msg = str(e)
        logger.error(f"❌ Brevo API failed for {to_email}: {error_msg}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Brevo Error Details: {e.response.text}")
        return False, error_msg


def send_otp_email(to_email: str, otp_code: str, purpose: str = 'login', user_name: str = ''):
    """
    Send OTP email via Brevo HTTP API.
    Returns: (success: bool, error_message: str | None)
    """
    name = user_name or 'User'

    if purpose == 'register':
        subject = 'Quill - Verify Your Account'
        text_body = (
            f'Hi {name},\n\n'
            f'Welcome to Quill! Your OTP code is: {otp_code}\n\n'
            f'This code expires in 10 minutes.\n\n'
            f'If you did not create this account, please ignore this email.\n\n'
            f'- Quill Team'
        )
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #2563EB;">Hi {name},</h2>
            <p>Welcome to Quill! Your OTP code is:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; color: #2563EB; letter-spacing: 5px; font-size: 32px;">{otp_code}</h1>
            </div>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p>If you did not create this account, please ignore this email.</p>
            <br>
            <p>Best regards,<br><strong>The Quill Team</strong></p>
        </body>
        </html>
        """
        
    elif purpose == 'password_reset':
        subject = 'Quill - Password Reset OTP'
        text_body = (
            f'Hi {name},\n\n'
            f'You requested to reset your password for your Quill account.\n\n'
            f'Your OTP verification code is: {otp_code}\n\n'
            f'This code expires in 10 minutes. Do not share it with anyone.\n\n'
            f'If you did not request this, please ignore this email.\n\n'
            f'- Quill Team'
        )
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #2563EB;">Password Reset Request</h2>
            <p>Hi {name},</p>
            <p>You requested to reset your password. Your OTP verification code is:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; color: #2563EB; letter-spacing: 5px; font-size: 32px;">{otp_code}</h1>
            </div>
            <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
            <p>If you did not request this, please ignore this email.</p>
            <br>
            <p>Best regards,<br><strong>The Quill Team</strong></p>
        </body>
        </html>
        """

    elif purpose == '2fa_fallback':
        subject = 'Quill - Two-Factor Authentication Code'
        text_body = (
            f'Hi {name},\n\n'
            f'Your two-factor authentication fallback code is: {otp_code}\n\n'
            f'This code expires in 5 minutes. Do not share it with anyone.\n\n'
            f'- Quill Team'
        )
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #2563EB;">2FA Fallback Code</h2>
            <p>Hi {name},</p>
            <p>Your two-factor authentication fallback code is:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; color: #2563EB; letter-spacing: 5px; font-size: 32px;">{otp_code}</h1>
            </div>
            <p>This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
            <br>
            <p>Best regards,<br><strong>The Quill Team</strong></p>
        </body>
        </html>
        """

    else:
        # Default for 'login' or any other purpose
        subject = 'Quill - Your Login OTP'
        text_body = (
            f'Hi {name},\n\n'
            f'Your login OTP code is: {otp_code}\n\n'
            f'This code expires in 10 minutes. Do not share it with anyone.\n\n'
            f'- Quill Team'
        )
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #2563EB;">Your Login OTP</h2>
            <p>Hi {name},</p>
            <p>Your login OTP code is:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; color: #2563EB; letter-spacing: 5px; font-size: 32px;">{otp_code}</h1>
            </div>
            <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
            <br>
            <p>Best regards,<br><strong>The Quill Team</strong></p>
        </body>
        </html>
        """

    return _send_email_via_brevo(to_email, subject, text_body, html_body)


def send_translation_complete_email(to_email: str, user_name: str, char_count: int, source_lang: str, target_lang: str):
    """
    Send an email notification when a translation is completed via Brevo API.
    Returns: (success: bool, error_message: str | None)
    """
    name = user_name or 'User'
    source_display = source_lang.upper() if source_lang != "auto" else "Auto-Detected"
    target_display = target_lang.upper()

    subject = 'Quill - Your Translation is Complete! '
    
    text_body = (
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

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #2563EB;">Your Translation is Complete! 🎉</h2>
        <p>Hi {name},</p>
        <p>Great news! Your translation has been successfully completed.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Characters translated:</strong> {char_count}</p>
            <p style="margin: 5px 0;"><strong>Source Language:</strong> {source_display}</p>
            <p style="margin: 5px 0;"><strong>Target Language:</strong> {target_display}</p>
        </div>

        <p>You can view your full translation history anytime in your Quill dashboard.</p>
        <p>Happy Translating!</p>
        <br>
        <p>Best regards,<br><strong>The Quill Team</strong></p>
    </body>
    </html>
    """

    return _send_email_via_brevo(to_email, subject, text_body, html_body)