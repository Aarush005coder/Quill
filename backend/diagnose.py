import os
import sys

print("=" * 60)
print("DIAGNOSTIC: Checking backend structure")
print("=" * 60)

print(f"\nCurrent directory: {os.getcwd()}")
print(f"Python path: {sys.path[:3]}")

print("\n--- Files in current directory ---")
for item in sorted(os.listdir('.')):
    if os.path.isdir(item):
        print(f"  📁 {item}/")
    else:
        print(f"  📄 {item}")

print("\n--- Files in quill/ ---")
if os.path.exists('quill'):
    for item in sorted(os.listdir('quill')):
        if os.path.isdir(f'quill/{item}'):
            print(f"  📁 quill/{item}/")
        else:
            print(f"  📄 quill/{item}")
else:
    print("  ❌ quill/ folder NOT FOUND!")

print("\n--- Checking __init__.py content ---")
init_path = 'quill/__init__.py'
if os.path.exists(init_path):
    with open(init_path, 'r') as f:
        content = f.read()
    print(f"  Content: {repr(content)}")
    print(f"  File size: {os.path.getsize(init_path)} bytes")
else:
    print("  ❌ __init__.py NOT FOUND!")

print("\n--- Checking settings.py ---")
settings_path = 'quill/settings.py'
if os.path.exists(settings_path):
    print(f"  ✅ settings.py exists ({os.path.getsize(settings_path)} bytes)")
else:
    print("  ❌ settings.py NOT FOUND!")

print("\n" + "=" * 60)