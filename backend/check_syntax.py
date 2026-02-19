import os
import ast
import sys

def check_syntax(directory):
    print(f"Checking syntax for Python files in: {directory}")
    error_count = 0
    file_count = 0
    
    for root, dirs, files in os.walk(directory):
        # Skip common non-project directories
        if 'venv' in dirs:
            dirs.remove('venv')
        if '__pycache__' in dirs:
            dirs.remove('__pycache__')
        if '.git' in dirs:
            dirs.remove('.git')
            
        for file in files:
            if file.endswith(".py"):
                file_count += 1
                fullpath = os.path.join(root, file)
                try:
                    with open(fullpath, "r", encoding="utf-8") as f:
                        source = f.read()
                    ast.parse(source)
                except SyntaxError as e:
                    print(f"❌ Syntax Error in {fullpath}")
                    print(f"   Line {e.lineno}, Column {e.offset}: {e.msg}")
                    print(f"   Code: {e.text.strip() if e.text else 'N/A'}")
                    error_count += 1
                except Exception as e:
                    print(f"⚠️  Could not parse {fullpath}: {e}")
                    error_count += 1

    print(f"\nScanned {file_count} files.")
    if error_count == 0:
        print("✅ No syntax errors found.")
        sys.exit(0)
    else:
        print(f"❌ Found {error_count} errors.")
        sys.exit(1)

if __name__ == "__main__":
    check_syntax(os.getcwd())
