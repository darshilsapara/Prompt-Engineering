"""
SQLAlchemy engine, session, and Base configuration.
Uses SQLite database stored at the project root.
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Path to the SQLite database file (project root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DB_NAME = "test_racer_game.db" if "test" in sys.argv else "racer_game.db"
DB_PATH = os.path.join(BASE_DIR, _DB_NAME)

# Create the SQLAlchemy engine
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)

# Session factory
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Declarative base for models
Base = declarative_base()


def get_db():
    """Dependency: yields a database session and ensures it is closed after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables defined via Base.metadata."""
    # Import all models so metadata knows about them
    from game import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
