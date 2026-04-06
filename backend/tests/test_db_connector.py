"""
Tests for db_connector.py — foundation layer.

Coverage targets:
  - validate_identifier: valid names, invalid names (SQL injection attempts)
  - quote_identifier: PG vs MySQL quoting
  - connect / disconnect / get_connection
  - query: parameterized queries, empty result, error propagation
  - reconnect: in-place reconnect using stored config
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.db_connector import DatabaseConnector


class TestValidateIdentifier:
    def setup_method(self):
        self.db = DatabaseConnector()

    def test_valid_simple_name(self):
        assert self.db.validate_identifier("users") == "users"

    def test_valid_schema_dot_table(self):
        assert self.db.validate_identifier("public.users") == "public.users"

    def test_valid_underscore(self):
        assert self.db.validate_identifier("battery_health_log") == "battery_health_log"

    def test_rejects_sql_injection_drop(self):
        with pytest.raises(ValueError):
            self.db.validate_identifier("users; DROP TABLE users--")

    def test_rejects_single_quote(self):
        with pytest.raises(ValueError):
            self.db.validate_identifier("users' OR '1'='1")

    def test_rejects_space(self):
        with pytest.raises(ValueError):
            self.db.validate_identifier("user name")

    def test_empty_string_returns_empty(self):
        assert self.db.validate_identifier("") == ""


class TestQuoteIdentifier:
    def setup_method(self):
        self.db = DatabaseConnector()
        self.db.connections = {
            "pg_conn":    {"type": "postgresql"},
            "mysql_conn": {"type": "mysql"},
        }

    def test_pg_uses_double_quotes(self):
        assert self.db.quote_identifier("pg_conn", "orders") == '"orders"'

    def test_mysql_uses_backticks(self):
        assert self.db.quote_identifier("mysql_conn", "orders") == "`orders`"

    def test_invalid_identifier_raises(self):
        with pytest.raises(ValueError):
            self.db.quote_identifier("pg_conn", "bad name")


class TestGetConnection:
    def setup_method(self):
        self.db = DatabaseConnector()
        self.db.connections = {"c1": {"type": "postgresql", "client": MagicMock()}}

    def test_returns_existing_connection(self):
        conn = self.db.get_connection("c1")
        assert conn["type"] == "postgresql"

    def test_raises_for_missing_connection(self):
        with pytest.raises(Exception):
            self.db.get_connection("nonexistent")


class TestReconnect:
    def _make_db_with_pg_conn(self):
        db = DatabaseConnector()
        old_client = MagicMock()
        old_client.close = AsyncMock()
        db.connections = {
            "c1": {
                "id": "c1",
                "type": "neon",
                "client": old_client,
                "config": {"host": "host", "port": 5432, "database": "mydb"},
                "_reconnect_config": {
                    "db_type": "neon",
                    "host": "host",
                    "port": 5432,
                    "database": "mydb",
                    "username": "user",
                    "password": "pass",
                },
            }
        }
        return db, old_client

    @pytest.mark.asyncio
    async def test_reconnect_replaces_client(self):
        db, old_client = self._make_db_with_pg_conn()
        new_pool = MagicMock()

        with patch.object(db, "_connect_postgresql_async", new=AsyncMock(return_value=new_pool)):
            await db.reconnect("c1")

        assert db.connections["c1"]["client"] is new_pool
        old_client.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_reconnect_raises_without_config(self):
        db = DatabaseConnector()
        db.connections = {"c1": {"id": "c1", "type": "neon", "client": MagicMock()}}
        with pytest.raises(ValueError, match="No reconnect config"):
            await db.reconnect("c1")

    @pytest.mark.asyncio
    async def test_reconnect_raises_for_unknown_id(self):
        db = DatabaseConnector()
        with pytest.raises(ValueError):
            await db.reconnect("nonexistent")

    @pytest.mark.asyncio
    async def test_reconnect_raises_for_unsupported_db_type(self):
        db = DatabaseConnector()
        db.connections = {
            "c1": {
                "id": "c1",
                "type": "mongodb",
                "client": MagicMock(),
                "_reconnect_config": {"db_type": "mongodb", "host": "h", "database": "d"},
            }
        }
        with pytest.raises(ValueError, match="not supported"):
            await db.reconnect("c1")
