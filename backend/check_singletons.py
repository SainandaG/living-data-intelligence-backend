import sys
import os

def check_modules():
    print(f"Checking sys.path: {sys.path}")
    db_modules = {k: v for k, v in sys.modules.items() if 'db_connector' in k}
    print(f"Found {len(db_modules)} db_connector related modules:")
    for name, mod in db_modules.items():
        if mod:
            print(f"  {name}: {mod} (ID: {id(mod)})")
            if hasattr(mod, 'db_connector'):
                print(f"    db_connector instance ID: {id(mod.db_connector)}")
        else:
            print(f"  {name}: None")

if __name__ == "__main__":
    # Add backend to path if not there
    backend_path = os.path.abspath("backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    check_modules()
