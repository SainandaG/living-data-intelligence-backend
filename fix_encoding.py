
import os

files_to_fix = [
    "verify_simple.py",
    "verify_drilldown.py",
    "backend/app/services/db_connector.py",
    "backend/app/services/schema_analyzer.py",
    "backend/app/services/ai_classifier.py",
    "backend/app/services/analysis_engine.py",
    "backend/app/services/gravity_engine.py",
    "backend/app/services/drill_down.py"
]

def fix_file(path):
    print(f"Fixing {path}...")
    try:
        if not os.path.exists(path):
            print(f"⚠️ File not found: {path}")
            return
            
        # Read content
        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                content = f.read()
        except:
             with open(path, "r", encoding="latin-1") as f:
                content = f.read()

        # Check if already present
        if "# -*- coding: utf-8 -*-" in content:
            print(f"ℹ️ already has encoding declaration: {path}")
            # Ensure it is at the top?
            return

        # Add declaration
        new_content = "# -*- coding: utf-8 -*-\n" + content.replace('\ufeff', '') # Strip BOM too
        
        # Write content 
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
            
        print(f"✅ Fixed {path}")
    except Exception as e:
        print(f"❌ Failed to fix {path}: {e}")

if __name__ == "__main__":
    for f in files_to_fix:
        fix_file(f)
