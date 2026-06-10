# ResumeAI ATS — Testing Guide

This document lists the top-priority functions and components requiring automated unit tests,
along with suggested test cases and the recommended testing stack.

---

## Recommended Stack

| Layer | Tool |
|---|---|
| Python backend | `pytest` + `pytest-asyncio` |
| Database mock | `psycopg2` with a test PostgreSQL DB or `unittest.mock.patch` |
| FastAPI routes | `fastapi.testclient.TestClient` |
| Frontend components | `vitest` + `@testing-library/react` |

---

## Priority 1: `backend/services/auth.py`

**Why:** Authentication is the security foundation. A bug here exposes every endpoint.

### Test Cases
- `hash_password` + `verify_password` — assert correct hash round-trip
- `verify_password` — assert False for wrong password
- `create_token` + `decode_token` — assert payload fields survive round-trip
- `decode_token` — assert `HTTPException 401` raised for expired token
- `decode_token` — assert `HTTPException 401` raised for tampered token
- `require_role('hr')` — assert `HTTPException 403` when role is `'candidate'`

```python
# Example: pytest test
def test_password_round_trip():
    hashed = hash_password("mysecurepass")
    assert verify_password("mysecurepass", hashed) is True
    assert verify_password("wrongpass", hashed) is False
```

---

## Priority 2: `backend/services/database.py` — `get_pending_emails_by_job`

**Why:** This function had a critical bug (only returning 'approved') that caused rejection emails to never send.
A regression test must lock in the correct behaviour.

### Test Cases
- Assert that an approved application is returned (email_sent=FALSE)
- Assert that a **rejected** application is also returned (email_sent=FALSE) — regression test
- Assert that applications with `email_sent=TRUE` are **not** returned
- Assert that applications from other jobs are not included

---

## Priority 3: `backend/routers/auth.py` — `RegisterRequest` Pydantic validators

**Why:** Input validation is the first line of defence against malformed data reaching the DB.

### Test Cases
- `validate_email` — reject `"notanemail"`, accept `"user@example.com"`
- `validate_password` — reject `"short"` (< 8 chars), accept `"validpass"`
- `validate_name` — reject empty string `""`, reject name longer than 100 chars
- Full POST `/api/register` integration test with `TestClient`

```python
# Example: FastAPI TestClient
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_register_invalid_email():
    response = client.post("/api/register", json={
        "email": "notvalid", "password": "password123", "name": "Test", "role": "candidate"
    })
    assert response.status_code == 422
```

---

## Priority 4: `backend/services/security.py`

**Why:** Fernet encryption protects stored SMTP passwords. Key mismatch must be handled gracefully.

### Test Cases
- `encrypt_password` + `decrypt_password` — assert correct round-trip
- `decrypt_password` — assert `ValueError` raised for corrupted ciphertext
- `decrypt_password("")` — assert returns `""` without error
- `encrypt_password("")` — assert returns `""` without error

---

## Priority 5: `frontend/src/context/AuthContext.jsx`

**Why:** Auth context wraps the entire app. Broken login/register affects all users.

### Test Cases
- `login` — assert throws with message for invalid email format
- `login` — assert throws with message for password < 8 chars
- `register` — assert throws for empty name
- `register` — assert throws for name > 100 chars
- `authFetch` — assert Authorization header is correctly set
- `logout` — assert `sessionStorage` is cleared and user state is null

```jsx
// Example: vitest
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

test('login throws for invalid email', async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await expect(act(() => result.current.login('bademail', 'password123'))).rejects.toThrow('valid email');
});
```

---

## Running Tests

```bash
# Backend
cd backend
pytest tests/ -v

# Frontend
cd frontend
npx vitest run
```
