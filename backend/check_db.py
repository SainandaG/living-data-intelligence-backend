import asyncio
import sys
import os

# Add the current directory to sys.path to import app
sys.path.append(os.getcwd())

from app.services.db_connector import db_connector

async def check():
    await db_connector.connect_all()
    if not db_connector.connections:
        print("No connections found")
        return
        
    conn_id = list(db_connector.connections.keys())[0]
    print(f"Checking connection: {conn_id}")
    
    tables = ['orders', 'transactions', 'users', 'products']
    for table in tables:
        try:
            res = await db_connector.query(conn_id, f"SELECT COUNT(*) as count FROM {table}")
            print(f"Table {table}: {res[0]['count']} rows")
            
            if table == 'orders':
                avg_res = await db_connector.query(conn_id, f"SELECT AVG(total_amount) as avg FROM {table}")
                print(f"Orders Avg Amount: {avg_res[0]['avg']}")
        except Exception as e:
            print(f"Error checking table {table}: {e}")

if __name__ == "__main__":
    asyncio.run(check())
