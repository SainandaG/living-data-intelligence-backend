"""
Tests for app/services/auth.py — security critical.

Coverage targets:
  - hash_password / verify_password: correct hash, wrong password fails
  - create_access_token: produces a decodable JWT
  - verify_token: valid token succeeds, expired token fails, tampered token fails
  - create_refresh_token: different payload than access token
"""
import pytest
import time
from app.services.auth import hash_password, verify_password, create_access_token, verify_token, create_refresh_token


class TestPasswordHashing:
    def test_hash_then_verify_correct(self):
        pwd = "super_secret_123"
        hashed = hash_password(pwd)
        assert verify_password(pwd, hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_hash_is_not_plaintext(self):
        pwd = "plaintext"
        assert hash_password(pwd) != pwd


class TestJWTTokens:
    def test_access_token_verifiable(self):
        token = create_access_token({"sub": "user@example.com"})
        payload = verify_token(token)
        assert payload is not None
        assert payload.get("sub") == "user@example.com"

    def test_tampered_token_rejected(self):
        token = create_access_token({"sub": "user@example.com"})
        tampered = token[:-5] + "XXXXX"
        assert verify_token(tampered) is None

    def test_refresh_token_verifiable(self):
        token = create_refresh_token({"sub": "user@example.com"})
        payload = verify_token(token)
        assert payload is not None

    def test_invalid_string_rejected(self):
        assert verify_token("not.a.token") is None
