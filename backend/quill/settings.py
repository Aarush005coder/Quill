import os
import environ
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

# Load .env file
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = env('SECRET_KEY', default='django-insecure-change-me')
DEBUG = env.bool('DEBUG', default=True)
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# ─── EXPLICIT OAUTH VARS ───────────────────────────────────────
BACKEND_URL = env('BACKEND_URL', default='http://127.0.0.1:8000')
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:3000')

GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET', default='')
GITHUB_CLIENT_ID = env('GITHUB_CLIENT_ID', default='')
GITHUB_CLIENT_SECRET = env('GITHUB_CLIENT_SECRET', default='')

# ─── INSTALLED APPS ────────────────────────────────────────────

DJANGO_CORE_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
]

DJANGO_AUTH_APPS = [
    'django.contrib.auth',
    'django.contrib.admin',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.github',
    'django_otp',
    'django_otp.plugins.otp_totp',
    'celery',
    'django_celery_results',
]

LOCAL_APPS = [
    'users',
    'translation',
    'tools',
    'documents',
    'history',
    'combine.apps.CombineConfig',   # ← signals.py automatically load hoga
    'about',
    'settings_app',
]

INSTALLED_APPS = (
    DJANGO_CORE_APPS
    + DJANGO_AUTH_APPS
    + THIRD_PARTY_APPS
    + LOCAL_APPS
)

SITE_ID = 1

# ─── MIDDLEWARE ────────────────────────────────────────────────
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django_otp.middleware.OTPMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'quill.urls'
WSGI_APPLICATION = 'quill.wsgi.application'

# ─── TEMPLATES ─────────────────────────────────────────────────
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ─── DATABASE ──────────────────────────────────────────────────

DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'USER': env('DB_USER', default='postgres'),
            'PASSWORD': env('DB_PASSWORD', default='password'),
            'HOST': env('DB_HOST', default='localhost'),
            'PORT': env('DB_PORT', default='5432'),
        }
    }

# ─── CACHES ────────────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'django_cache_table',
    }
}

# ─── CELERY ────────────────────────────────────────────────────
import urllib.parse

# Safely encode the password to handle special characters like '@'
db_user = env('DB_USER', default='postgres')
db_password = urllib.parse.quote_plus(env('DB_PASSWORD', default='password'))
db_host = env('DB_HOST', default='localhost')
db_port = env('DB_PORT', default='5432')
db_name = env('DB_NAME', default='quill')

CELERY_BROKER_URL = f'sqla+postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'
CELERY_RESULT_BACKEND = f'db+postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

# ─── REST FRAMEWORK ────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '50/hour',
        'user': '1000/hour',
    },
}

# ─── JWT ───────────────────────────────────────────────────────

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),  # 2 hours se 12 hours
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),  # 7 days se 30 days
    'ROTATE_REFRESH_TOKENS': False,  # ⚠️ YEH FALSE KARO - Main fix!
    'BLACKLIST_AFTER_ROTATION': False,  # Rotation band karne se ye bhi false
    'UPDATE_LAST_LOGIN': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}

# ─── AUTHENTICATION ────────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

# AllAuth
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_EMAIL_VERIFICATION = 'optional'
ACCOUNT_ADAPTER = 'users.adapters.CustomAccountAdapter'

# Social Providers
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
        'APP': {
            'client_id': GOOGLE_CLIENT_ID,
            'secret': GOOGLE_CLIENT_SECRET,
        }
    },
    'github': {
        'SCOPE': ['user:email'],
        'APP': {
            'client_id': GITHUB_CLIENT_ID,
            'secret': GITHUB_CLIENT_SECRET,
        }
    }
}

# ─── EMAIL (BREVO SMTP) ────────────────────────────────────────

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp-relay.brevo.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env("BREVO_SMTP_LOGIN", default="")
EMAIL_HOST_PASSWORD = env("BREVO_SMTP_KEY", default="")
BREVO_API_KEY = env("BREVO_API_KEY", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="")
EMAIL_TIMEOUT = 10

# ─── EMAIL (CONSOLE - TEMPORARY FIX) ───────────────────────────

# EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
# DEFAULT_FROM_EMAIL = "Quill <khandelwalaarush2@gmail.com>"

# ─── STATIC & MEDIA ────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ─── INTERNATIONALIZATION ──────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── GROK AI ───────────────────────────────────────────────────
GROK_API_KEY = env('GROK_API_KEY', default='')

# ─── FILE UPLOAD LIMITS ────────────────────────────────────────
MAX_DOCUMENT_UPLOAD_SIZE = 250 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_DOCUMENT_UPLOAD_SIZE
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# ─── SESSION ───────────────────────────────────────────────────
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = False  # True in production with HTTPS

DEEPL_API_KEY = os.getenv("DEEPL_API_KEY", "")
MICROSOFT_TRANSLATOR_KEY = os.getenv("MICROSOFT_TRANSLATOR_KEY", "")
MICROSOFT_TRANSLATOR_REGION = os.getenv("MICROSOFT_TRANSLATOR_REGION", "eastus")


# ─── WEB PUSH (VAPID KEYS) ─────────────────────────────────────
# Generate your own for production: https://web-push-codelab.glitch.me/

# ─── WEB PUSH (VAPID KEYS) ─────────────────────────────────────

VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY", default="")
VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY", default="")
VAPID_ADMIN_EMAIL = env(
    "VAPID_ADMIN_EMAIL",
    default="mailto:khandelwalaarush2@gmail.com",
)

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    'quill-a52m.onrender.com',     
    'quill-aarush01.vercel.app',
    'quill-git-main-aarush01.vercel.app',
    '.onrender.com',
]

# ─── CORS ──────────────────────────────────────────────────────

# CORS settings
CORS_ALLOWED_ORIGINS = [
    "https://quill-aarush01.vercel.app",
    "https://quill-git-main-aarush01.vercel.app",
    "http://localhost:3000",
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True

# Explicitly allow all headers and methods
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]