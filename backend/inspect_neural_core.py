
import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())
# Also add the backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.neural_core import neural_core
from app.services.db_connector import db_connector
from dotenv import load_dotenv

load_dotenv('backend/.env')

async def inspect_neural_core():
    print("🧠 Inspecting Neural Core In-Memory State...")
    
    # Check gravity stores
    print(f"\nGravity Stores Keys (Connections): {list(neural_core.gravity_stores.keys())}")
    
    for conn_id, store in neural_core.gravity_stores.items():
        print(f"\n--- Connection: {conn_id} ---")
        if 'organization_social_links' in store:
            print(f"❌ Found ghost reference 'organization_social_links' in gravity_store!")
        else:
            print("✅ 'organization_social_links' NOT in gravity_store.")
            
        # Check in_degrees
        in_deg = neural_core.in_degrees.get(conn_id, {})
        if 'organization_social_links' in in_deg:
            print(f"❌ Found ghost reference 'organization_social_links' in in_degrees!")
            
        # Check out_degrees
        out_deg = neural_core.out_degrees.get(conn_id, {})
        if 'organization_social_links' in out_deg:
            print(f"❌ Found ghost reference 'organization_social_links' in out_degrees!")
            
        # Check snapshots
        snap = neural_core.snapshots.get(conn_id, {})
        if 'tables' in snap:
            ghost = next((t for t in snap['tables'] if t.get('name') == 'organization_social_links'), None)
            if ghost:
                 print(f"❌ Found ghost reference 'organization_social_links' in snapshot!")

    # Check if ANY connection has it
    print("\nSearching ALL internal structures for 'organization_social_links'...")
    found = False
    for conn_id in neural_core.gravity_stores:
        if 'organization_social_links' in neural_core.gravity_stores[conn_id]: found = True
        if 'organization_social_links' in neural_core.in_degrees.get(conn_id, {}): found = True
        if 'organization_social_links' in neural_core.out_degrees.get(conn_id, {}): found = True
    
    if found:
        print("🚨 GHOST REFERENCE DETECTED in neural_core memory!")
    else:
        print("🤷 No ghost reference found in current neural_core memory.")

if __name__ == "__main__":
    asyncio.run(inspect_neural_core())
