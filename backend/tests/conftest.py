
import pytest
import asyncio
import sys
import os

# Add backend to path so imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.neural_core import NeuralCore

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def neural_core():
    """Returns a fresh instance of NeuralCore for each test"""
    return NeuralCore()

@pytest.fixture
def mock_schema():
    """Returns a standard mock schema for testing"""
    return {
        "tables": [
            {
                "name": "users",
                "row_count": 1000,
                "columns": [{"name": "id"}, {"name": "name"}, {"name": "email"}, {"name": "created_at"}],
                "foreign_keys": []
            },
            {
                "name": "orders",
                "row_count": 5000,
                "columns": [{"name": "id"}, {"name": "user_id"}, {"name": "total"}],
                "foreign_keys": [{"referenced_table": "users", "column": "user_id"}]
            },
            {
                "name": "logs",
                "row_count": 100000,
                "columns": [{"name": "id"}, {"name": "user_id"}, {"name": "msg"}],
                "foreign_keys": [{"referenced_table": "users", "column": "user_id"}]
            },
            {
                "name": "settings",
                "row_count": 1,
                "columns": [{"name": "id"}, {"name": "key"}, {"name": "val"}],
                "foreign_keys": []
            }
        ]
    }
