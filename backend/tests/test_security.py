from datetime import timedelta

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_roundtrip():
    hashed = hash_password("correct horse")
    assert hashed != "correct horse"
    assert verify_password("correct horse", hashed)
    assert not verify_password("wrong", hashed)


def test_token_roundtrip():
    token = create_access_token("abc-123")
    assert decode_access_token(token) == "abc-123"


def test_expired_token_rejected():
    token = create_access_token("abc-123", expires_delta=timedelta(seconds=-1))
    assert decode_access_token(token) is None


def test_garbage_token_rejected():
    assert decode_access_token("not-a-token") is None
