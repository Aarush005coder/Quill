#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input

# Cache table banao (agar nahi hai toh)
python manage.py createcachetable || true

python manage.py migrate