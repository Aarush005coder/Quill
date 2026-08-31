#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input

# Migrate mat chalao — db.sqlite3 already ready hai
# python manage.py migrate