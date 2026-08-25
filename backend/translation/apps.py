from django.apps import AppConfig


class TranslationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'translation'
    verbose_name = 'Translation Services'

    def ready(self):
        pass