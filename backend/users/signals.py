from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()


@receiver(post_save, sender=User)
def create_welcome_notification(sender, instance, created, **kwargs):
    """Send welcome notification when a new user registers."""
    if created:
        Notification.objects.create(
            user=instance,
            title='Welcome to quill! 🎉',
            message='Your account has been created successfully. Start translating now!',
            type='success',
            link='/translate'
        )


@receiver(post_save, sender=User)
def notify_plan_change(sender, instance, **kwargs):
    """Notify user when their subscription plan changes."""
    if not kwargs.get('created', False):
        # Check if plan was updated (simplified - in production use dirtyfields)
        pass  # Implement with django-dirtyfields if needed


@receiver(post_save, sender=User)
def auto_verify_social_user(sender, instance, created, **kwargs):
    """Auto-verify users who signed up via OAuth."""
    if created and instance.auth_provider in ['google', 'github']:
        instance.is_verified = True
        instance.save(update_fields=['is_verified'])