"""
╔═══════════════════════════════════════════════════════════════════╗
║  DEV-ONLY: RBAC User Seeder                                      ║
║  This script creates test accounts with password 'password123'.  ║
║  NEVER run in production. For local development only.            ║
╚═══════════════════════════════════════════════════════════════════╝

Usage:
    cd backend
    python scripts/seed_rbac_users.py
"""
import asyncio
import os
import ssl
import sys
import asyncpg
from passlib.hash import bcrypt
from datetime import datetime

# Safety guard: refuse to run in production
if os.getenv("APP_ENV", "development") == "production":
    print("ERROR: This script must not be run in production.")
    sys.exit(1)

# Manually load .env if it exists
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value

# --- CONFIGURATION ---
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "wezu_backend")
DB_USER = os.getenv("DB_USER", "neondb_owner")
DB_PASSWORD = os.getenv("DB_PASSWORD", "npg_gB1ZVP5UKblz")

# Common password for all test users
RAW_PASSWORD = "password123"
HASHED_PASSWORD = bcrypt.hash(RAW_PASSWORD)

TEST_USERS = [
    ("viewer@livingdata.ai", "viewer", "default"),
    ("editor@livingdata.ai", "editor", "default"),
    ("analyst@livingdata.ai", "analyst", "default"),
    ("admin@livingdata.ai", "admin", "default"),
    ("super@livingdata.ai", "super_admin", "default"),
]

async def seed():
    print(f"Connecting to {DB_HOST}/{DB_NAME}...")
    
    ssl_ctx = None
    if "neon.tech" in DB_HOST:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = True
        ssl_ctx.verify_mode = ssl.CERT_REQUIRED

    try:
        conn = await asyncpg.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            host=DB_HOST,
            port=DB_PORT,
            ssl=ssl_ctx
        )
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    print("Connected. Preparing schema...")

    # 1. Ensure the 'role' column exists in 'users'
    try:
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer'")
        print("   [+] Verified 'role' column in 'users'")
    except Exception as e:
        print(f"   [!] Failed to alter table: {e}")

    # 2. Identify the correct password column
    pwd_col = "password_hash"
    columns = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
    col_names = [c['column_name'] for c in columns]
    if "hashed_password" in col_names:
        pwd_col = "hashed_password"
    
    print(f"   [i] Using password column: {pwd_col}")

    # 3. Handle strict NOT NULL columns in this specific database
    required_defaults = {
        "is_active": True,
        "is_superuser": False,
        "consent_captured": True,
        "two_factor_enabled": False,
        "biometric_login_enabled": False,
        "two_factor_pending": False,
        "is_email_verified": True,
        "is_deleted": False,
        "kyc_status": "APPROVED",
        "status": "ACTIVE",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    # Filter only those that actually exist in the table
    active_defaults = {k: v for k, v in required_defaults.items() if k in col_names}
    cols = ["email", pwd_col, "role", "tenant_id"] + list(active_defaults.keys())
    placeholders = [f"${i+1}" for i in range(len(cols))]
    
    update_str = ", ".join([f"{c} = EXCLUDED.{c}" for c in cols if c != "email"])

    print("Seeding users...")

    for email, role, tenant in TEST_USERS:
        try:
            # Dynamically build the insert query
            vals = [email, HASHED_PASSWORD, role, tenant] + list(active_defaults.values())
            
            query = f"""
                INSERT INTO users ({", ".join(cols)})
                VALUES ({", ".join(placeholders)})
                ON CONFLICT (email) 
                DO UPDATE SET {update_str}
            """
            
            await conn.execute(query, *vals)
            print(f"   [+] Seeded: {email} ({role})")
        except Exception as e:
            print(f"   [!] Failed to seed {email}: {e}")

    await conn.close()
    print("\nSeeding complete! You can now log in with password 'password123'")

if __name__ == "__main__":
    asyncio.run(seed())
