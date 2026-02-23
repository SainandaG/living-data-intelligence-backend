import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

try:
    print("Attempting to import app.api.intelligence...")
    import app.api.intelligence
    print("✅ Success! app.api.intelligence imported correctly.")
except Exception as e:
    print(f"❌ Failed to import app.api.intelligence:")
    import traceback
    traceback.print_exc()
