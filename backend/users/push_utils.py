import json
import logging
from pywebpush import webpush, WebPushException
from django.conf import settings

logger = logging.getLogger(__name__)

def send_push_notification(subscription_data, title, message, url=""):
    """
    Sends a web push notification to a specific subscription.
    """
    vapid_data = {
        "sub": settings.VAPID_ADMIN_EMAIL,
        "public_key": settings.VAPID_PUBLIC_KEY,
        "private_key": settings.VAPID_PRIVATE_KEY,
    }

    payload = json.dumps({
        "title": title,
        "body": message,
        "url": url,
        "icon": "/quill_logo.png" # Ensure this exists in your frontend public folder
    })

    try:
        webpush(
            subscription_info=subscription_data,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_ADMIN_EMAIL}
        )
        logger.info(f"✅ Push notification sent successfully.")
        return True
    except WebPushException as e:
        logger.error(f"❌ WebPush Exception: {e}")
        # If the subscription is expired/invalid (e.g., 410 Gone), the frontend should handle cleanup
        return False
    except Exception as e:
        logger.error(f"❌ Push notification failed: {e}")
        return False