
import os
import ast
import sys
import glob

def check_syntax(directory):
    print(f"🔍 Starting Syntax Check in: {directory}")
    errors = []
    files_checked = 0
    
    for root, _, files in os.walk(directory):
        if "venv" in root or "__pycache__" in root:
            continue
            
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                files_checked += 1
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        source = f.read()
                    ast.parse(source)
                except SyntaxError as e:
                    errors.append(f"❌ SYNTAX ERROR in {path}: {e}")
                except Exception as e:
                    errors.append(f"⚠️ READ ERROR in {path}: {e}")

    print(f"✅ Checked {files_checked} files.")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    else:
        print("✨ No syntax errors found.")

if __name__ == "__main__":
    check_syntax("backend")
