import os
import sys
from dotenv import load_dotenv

# Ensure we can import from services
sys.path.append(os.path.join(os.path.dirname(__file__), 'services'))

from database import get_conn, init_db

def reset_db():
    print("Connecting to PostgreSQL database to reset schema...")
    try:
        conn = get_conn()
        c = conn.cursor()
        
        # Drop tables in dependent order
        print("Dropping tables...")
        c.execute("DROP TABLE IF EXISTS login_logs CASCADE;")
        c.execute("DROP TABLE IF EXISTS applications CASCADE;")
        c.execute("DROP TABLE IF EXISTS jobs CASCADE;")
        c.execute("DROP TABLE IF EXISTS users CASCADE;")
        
        conn.commit()
        conn.close()
        print("Tables dropped successfully.")
        
        # Re-initialize the database schema
        print("Re-initializing database schema...")
        init_db()
        print("Database schema reset and initialized successfully.")
    except Exception as e:
        print(f"Error resetting database: {e}")

if __name__ == "__main__":
    reset_db()
