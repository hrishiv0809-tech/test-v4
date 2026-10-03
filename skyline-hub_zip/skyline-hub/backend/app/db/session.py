import pymysql
from urllib.parse import urlparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

def ensure_database_exists():
    url = urlparse(settings.DATABASE_URL)
    db_name = url.path.lstrip('/')
    user = url.username or 'root'
    password = url.password or ''
    host = url.hostname or 'localhost'
    port = url.port or 3306

    try:
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            port=port
        )
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.close()
    except Exception as e:
        print(f"Warning: Could not automatically ensure database exists: {e}")

ensure_database_exists()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
