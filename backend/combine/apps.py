from django.apps import AppConfig

class CombineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'combine'

    def ready(self):
        # import combine.signals  <-- Is line ko comment kar dein ya delete kar dein
        pass
