from django.apps import AppConfig


class HistoryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'history'
    verbose_name = 'Unified History'

    def ready(self):
        pass