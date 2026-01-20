import asyncio
import aiohttp
import time

async def test_connect():
    async with aiohttp.ClientSession() as session:
        payload = {
            "db_type": "postgresql",
            "host": "8.8.8.8", # Bogus IP to cause hang
            "port": 5432,
            "database": "postgres",
            "username": "postgres",
            "password": "password"
        }
        print(f"[{time.strftime('%H:%M:%S')}] Sending connection request...")
        try:
            async with session.post("http://localhost:8001/api/connect", json=payload, timeout=20) as resp:
                print(f"[{time.strftime('%H:%M:%S')}] Status: {resp.status}")
                data = await resp.json()
                print(f"[{time.strftime('%H:%M:%S')}] Data: {data}")
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_connect())
