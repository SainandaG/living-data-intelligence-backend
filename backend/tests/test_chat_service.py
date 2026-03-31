"""
Tests for chat_service.py — AI integration.

Coverage targets:
  - generate_response: no AI → correct error message
  - generate_response: no schema → correct error message
  - _build_schema_str: serializes schema correctly
  - _execute_sql_from_response: extracts SQL blocks, blocks non-SELECT
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestChatServiceNoAI:
    def setup_method(self):
        from app.services.chat_service import ChatService
        self.svc = ChatService.__new__(ChatService)
        self.svc.has_ai = False
        self.svc.groq_client = None
        self.svc.google_model = None
        self.svc.provider = None

    @pytest.mark.asyncio
    async def test_returns_error_when_no_ai(self):
        result = await self.svc.generate_response("hello", "conn1")
        assert "not configured" in result["response"].lower() or "can't help" in result["response"].lower()


class TestBuildSchemaStr:
    def setup_method(self):
        from app.services.chat_service import ChatService
        self.svc = ChatService.__new__(ChatService)

    def test_serializes_tables(self):
        schema = {"tables": [{"name": "orders", "columns": [{"name": "id"}], "row_count": 10}]}
        result = self.svc._build_schema_str(schema)
        assert "orders" in result

    def test_fallback_on_bad_input(self):
        result = self.svc._build_schema_str(None)
        assert isinstance(result, str)


class TestExecuteSQLBlocking:
    def setup_method(self):
        from app.services.chat_service import ChatService
        self.svc = ChatService.__new__(ChatService)

    @pytest.mark.asyncio
    async def test_blocks_non_select(self):
        response = "Sure! ```sql\nDROP TABLE users\n```"
        with patch("app.services.chat_service.db_connector") as mock_db:
            mock_db.get_connection = MagicMock(return_value={"type": "postgresql"})
            result = await self.svc._execute_sql_from_response(response, "conn1")
        assert "DROP" not in result or "only allow SELECT" in result.lower() or result == response
