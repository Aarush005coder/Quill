import os

# List of folders that need __init__.py
folders = [
    'quill',
    'users',
    'users/migrations',
    'translation',
    'tools',
    'documents',
    'combine',
    'about',
    'settings_app',
]

base_dir = os.path.dirname(os.path.abspath(__file__))

print("Creating __init__.py files...")
for folder in folders:
    init_file = os.path.join(base_dir, folder, '__init__.py')
    os.makedirs(os.path.dirname(init_file), exist_ok=True)
    
    if not os.path.exists(init_file):
        with open(init_file, 'w') as f:
            f.write(f'# {folder} package\n')
        print(f"  ✅ Created: {folder}/__init__.py")
    else:
        print(f"  ✓ Already exists: {folder}/__init__.py")

print("\nDone! Now try running Django commands.")