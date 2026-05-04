import sys
import os

# Set encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("--- Testing API Module Imports ---")
modules = [
    'app.api.intelligence',
    'app.api.agent',
    'app.api.recommendation',
    'app.api.root_cause',
    'app.api.auth',
    'app.api.vitals',
    'app.api.patterns',
    'app.api.diagnostics',
    'app.api.admin'
]

success_count = 0
for mod_name in modules:
    try:
        __import__(mod_name)
        print(f"[OK] {mod_name} imported successfully")
        success_count += 1
    except Exception as e:
        print(f"[FAIL] {mod_name} failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

print(f"\nSummary: {success_count}/{len(modules)} core API modules loaded.")

if success_count == len(modules):
    print("\nSYSTEM IS STABLE")
else:
    print("\nSYSTEM HAS ISSUES")
