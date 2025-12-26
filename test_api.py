import requests
import json

url = "http://localhost:8000/api/connect"
payload = {
    "db_type": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "f1",
    "username": "root",
    "password": ""
}

try:
    print(f"Sending POST to {url}...")
    response = requests.post(url, json=payload, timeout=5)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
