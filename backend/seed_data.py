#!/usr/bin/env python
"""
Run this to create migrations, migrate database, and seed initial data.
Usage: python seed_data.py
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quill.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup Django
django.setup()

from django.core.management import call_command


def main():
    print("=" * 60)
    print("  quill - Database Setup & Seed")
    print("=" * 60)

    # 1. Make migrations for all apps
    print("\n[1/5] Creating migrations...")
    apps = ['users', 'translation', 'tools', 'documents', 'combine', 'analytics', 'settings_app']
    for app in apps:
        try:
            call_command('makemigrations', app, verbosity=0)
            print(f"   ✓ {app}")
        except Exception as e:
            print(f"   ✗ {app}: {e}")

    # 2. Migrate
    print("\n[2/5] Applying migrations...")
    call_command('migrate', verbosity=1)

    # 3. Create cache table (for database cache backend)
    print("\n[3/5] Creating cache table...")
    try:
        call_command('createcachetable', verbosity=0)
        print("   ✓ Cache table created")
    except Exception as e:
        print(f"   ✓ Cache table may already exist: {e}")

    # 4. Seed languages
    print("\n[4/5] Seeding languages...")
    from translation.models import Language
    languages = [
        ('en', 'English', 'English', '🇺🇸', True),
        ('es', 'Spanish', 'Español', '🇪🇸', True),
        ('fr', 'French', 'Français', '🇫🇷', True),
        ('de', 'German', 'Deutsch', '🇩🇪', True),
        ('it', 'Italian', 'Italiano', '🇮🇹', True),
        ('pt', 'Portuguese', 'Português', '🇵🇹', True),
        ('ru', 'Russian', 'Русский', '🇷🇺', True),
        ('zh', 'Chinese', '中文', '🇨🇳', True),
        ('ja', 'Japanese', '日本語', '🇯🇵', True),
        ('ko', 'Korean', '한국어', '🇰🇷', True),
        ('ar', 'Arabic', 'العربية', '🇸🇦', True),
        ('hi', 'Hindi', 'हिन्दी', '🇮🇳', True),
        ('tr', 'Turkish', 'Türkçe', '🇹🇷', False),
        ('pl', 'Polish', 'Polski', '🇵🇱', False),
        ('nl', 'Dutch', 'Nederlands', '🇳🇱', False),
        ('sv', 'Swedish', 'Svenska', '🇸🇪', False),
        ('uk', 'Ukrainian', 'Українська', '🇺🇦', False),
        ('vi', 'Vietnamese', 'Tiếng Việt', '🇻🇳', False),
        ('th', 'Thai', 'ไทย', '🇹🇭', False),
        ('id', 'Indonesian', 'Bahasa Indonesia', '🇮🇩', False),
    ]

    created_count = 0
    for code, name, native, flag, popular in languages:
        obj, created = Language.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'native_name': native,
                'flag_emoji': flag,
                'is_popular': popular,
                'sort_order': languages.index((code, name, native, flag, popular))
            }
        )
        if created:
            created_count += 1

    print(f"   ✓ {created_count} languages seeded")

    # 5. Create superuser (optional)
    print("\n[5/5] Checking superuser...")
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    if not User.objects.filter(is_superuser=True).exists():
        print("   No superuser found. Create one with:")
        print("   python manage.py createsuperuser")
    else:
        print("   ✓ Superuser exists")

    print("\n" + "=" * 60)
    print("  Setup Complete! Run the server:")
    print("  python manage.py runserver")
    print("=" * 60)


if __name__ == '__main__':
    main()