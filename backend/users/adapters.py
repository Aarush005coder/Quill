from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings


class CustomAccountAdapter(DefaultAccountAdapter):
    """Custom adapter to handle OAuth user creation and validation."""

    def is_open_for_signup(self, request):
        """Allow signups from both email and social providers."""
        return True

    def populate_username(self, request, user):
        """Generate username from email if not provided."""
        if not user.username and user.email:
            base_username = user.email.split('@')[0]
            user.username = base_username
        return super().populate_username(request, user)

    def save_user(self, request, user, form, commit=True):
        """Save user with additional fields."""
        user = super().save_user(request, user, form, commit=False)
        
        # Set auth provider if coming from social login
        if hasattr(request, 'auth_provider'):
            user.auth_provider = request.auth_provider
        
        if commit:
            user.save()
        return user

    def get_email_confirmation_url(self, request, emailconfirmation):
        """Custom email confirmation URL (if needed for frontend)."""
        return f"{settings.NEXTAUTH_URL}/verify-email?key={emailconfirmation.key}"

    def send_confirmation_mail(self, request, emailconfirmation, signup):
        """Override to use custom email template."""
        # You can customize the confirmation email here
        super().send_confirmation_mail(request, emailconfirmation, signup)