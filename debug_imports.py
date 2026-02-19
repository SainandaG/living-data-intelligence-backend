
import sys
import os
import asyncio
import traceback

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("🚀 1. Importing DB Connector...")
from app.services.db_connector import db_connector
print("✅ DB Connector imported")

print("🚀 2. Importing Neural Core...")
from app.services.neural_core import neural_core
print("✅ Neural Core imported")

print("🚀 3. Importing Analysis Engine...")
from app.services.analysis_engine import analysis_engine
print("✅ Analysis Engine imported")

print("🚀 4. Importing Gravity Engine...")
from app.services.gravity_engine import gravity_engine
print("✅ Gravity Engine imported")

print("🚀 5. Importing Drill Down Service...")
from app.services.drill_down import drill_down_service
print("✅ Drill Down Service imported")

print("🎉 All imports successful. Exiting.")
