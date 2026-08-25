# backend/quill/celery.py

import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quill.settings')

app = Celery('quill')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ✅ Schedule the weekly report to run every Monday at 9:00 AM
app.conf.beat_schedule = {
    'send-weekly-reports-every-monday': {
        'task': 'users.tasks.send_weekly_reports',
        'schedule': crontab(hour=9, minute=0, day_of_week=1), # Monday at 9 AM
    },
}