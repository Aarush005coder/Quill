import os

base = os.path.dirname(os.path.abspath(__file__))
users_dir = os.path.join(base, 'users')

print("Checking users/ folder...")
print(f"Path: {users_dir}")
print(f"Exists: {os.path.exists(users_dir)}")

if os.path.exists(users_dir):
    for item in sorted(os.listdir(users_dir)):
        path = os.path.join(users_dir, item)
        size = os.path.getsize(path) if os.path.isfile(path) else 'DIR'
        print(f"  {item} ({size} bytes)")

# Try importing
print("\nTrying to import users.models...")
try:
    import users.models
    print("  ✅ SUCCESS")
except Exception as e:
    print(f"  ❌ FAILED: {e}")