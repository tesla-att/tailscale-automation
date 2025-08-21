#!/usr/bin/env python3

import os
import sys

# Test database connection
def test_connection():
    try:
        # Test psycopg2 import
        import psycopg2
        print("✓ psycopg2 imported successfully")
        
        # Test SQLAlchemy connection
        from sqlalchemy import create_engine
        
        # Use same connection string as alembic
        DATABASE_URL = "postgresql+psycopg2://postgres:postgres@db:5432/tailscale_mgr"
        
        print(f"Testing connection to: {DATABASE_URL}")
        
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute("SELECT version();")
            version = result.fetchone()[0]
            print(f"✓ Database connection successful")
            print(f"PostgreSQL version: {version}")
            
        return True
        
    except ImportError as e:
        print(f"✗ Import error: {e}")
        print("Run: pip install psycopg2-binary")
        return False
        
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        print("Make sure database is running: docker-compose up db")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
