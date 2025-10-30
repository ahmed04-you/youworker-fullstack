# CORS Security Configuration Guide

## Overview

This document describes the Cross-Origin Resource Sharing (CORS) security configuration for YouWorker. Proper CORS configuration is critical to prevent unauthorized cross-origin requests while allowing legitimate frontend access.

## Security Architecture

YouWorker implements **strict CORS validation** with multiple security layers:

1. **Origin Validation**: Only explicitly allowed origins can make cross-origin requests
2. **Format Validation**: Origins must conform to strict URL format requirements
3. **Middleware Enforcement**: CORS checks applied at the FastAPI middleware level
4. **Credential Support**: Credentials (cookies, authorization headers) allowed only for whitelisted origins

## Configuration

### Environment Variables

```bash
# .env
FRONTEND_ORIGIN=https://youworker.example.com,http://localhost:3000
```

**Format Requirements:**
- Comma-separated list of allowed origins
- Each origin must be a full URL: `scheme://host[:port]`
- Scheme must be `http` or `https`
- No path, query, or fragment components allowed
- Whitespace is automatically stripped

**Valid Examples:**
```
https://app.youworker.com
http://localhost:3000
https://youworker.com:8080
```

**Invalid Examples:**
```
youworker.com                    # Missing scheme
https://youworker.com/app        # Contains path
https://youworker.com?test=1     # Contains query
http://*.youworker.com           # Wildcards not supported
*                                # Wildcard not supported
```

### Validation Implementation

The application performs strict validation in `apps/api/middleware/cors_validation.py`:

```python
from packages.common.validators import validate_cors_origin

def validate_cors_origins(origins_str: str) -> list[str]:
    """
    Validate and parse CORS origins from comma-separated string.

    Security checks:
    - DNS format validation
    - No wildcards or regex patterns
    - No path/query/fragment components
    - Proper scheme (http/https only)

    Raises:
        ValueError: If any origin fails validation
    """
    origins = []
    for origin in origins_str.split(","):
        origin = origin.strip()
        if not origin:
            continue

        if not validate_cors_origin(origin):
            raise ValueError(f"Invalid CORS origin: {origin}")

        origins.append(origin)

    return origins
```

### FastAPI Middleware Setup

```python
from fastapi.middleware.cors import CORSMiddleware

# Validate and parse origins at startup
allowed_origins = validate_cors_origins(settings.frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Explicit whitelist only
    allow_credentials=True,          # Allow cookies/auth headers
    allow_methods=["*"],             # Allow all HTTP methods
    allow_headers=["*"],             # Allow all headers
    expose_headers=["X-Request-ID"], # Expose correlation ID header
)
```

## Security Considerations

### 1. Production Deployment

**DO:**
- Use HTTPS-only origins in production
- Limit origins to your actual frontend domains
- Use specific domains (not wildcards)
- Validate SSL/TLS certificates

**DON'T:**
- Use `http://` origins in production
- Use wildcard origins (`*`)
- Include multiple test/dev origins in production
- Allow `localhost` or `127.0.0.1` in production

**Example Production Configuration:**
```bash
# Production .env
FRONTEND_ORIGIN=https://youworker.example.com
```

### 2. Development Environment

For local development, you can safely include `localhost`:

```bash
# Development .env
FRONTEND_ORIGIN=https://staging.youworker.com,http://localhost:3000,http://localhost:5173
```

### 3. Multi-Environment Setup

Use environment-specific configuration:

```bash
# .env.production
FRONTEND_ORIGIN=https://youworker.example.com

# .env.staging
FRONTEND_ORIGIN=https://staging.youworker.example.com,http://localhost:3000

# .env.development
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000
```

## Common CORS Issues and Solutions

### Issue 1: CORS Error in Browser Console

**Error:**
```
Access to fetch at 'https://api.youworker.com/v1/chat' from origin
'https://app.youworker.com' has been blocked by CORS policy
```

**Solution:**
1. Verify `https://app.youworker.com` is in `FRONTEND_ORIGIN`
2. Restart API server after changing environment variables
3. Check browser DevTools Network tab for actual origin being sent
4. Ensure frontend is making requests to correct API URL

### Issue 2: Credentials Not Sent

**Error:**
```
Request header field authorization is not allowed by Access-Control-Allow-Headers
```

**Solution:**
- Ensure `allow_credentials=True` in CORS middleware
- Frontend must set `credentials: 'include'` in fetch options
- Origin must match exactly (including port)

**Frontend Example:**
```typescript
fetch('https://api.youworker.com/v1/chat', {
  method: 'POST',
  credentials: 'include',  // Required for cookies/auth
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(data),
})
```

### Issue 3: Preflight Request Failed

**Error:**
```
Response to preflight request doesn't pass access control check
```

**Solution:**
- CORS middleware handles OPTIONS requests automatically
- Verify origin is in whitelist
- Check that custom headers are properly configured
- Ensure API endpoint doesn't have additional auth requirements for OPTIONS

## Testing CORS Configuration

### Manual Testing

```bash
# Test from allowed origin
curl -X OPTIONS https://api.youworker.com/v1/chat \
  -H "Origin: https://youworker.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v

# Should return:
# Access-Control-Allow-Origin: https://youworker.com
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Methods: *
# Access-Control-Allow-Headers: *
```

```bash
# Test from disallowed origin (should fail)
curl -X OPTIONS https://api.youworker.com/v1/chat \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should NOT return Access-Control-Allow-Origin header
```

### Automated Testing

```python
# tests/test_cors.py
import pytest
from fastapi.testclient import TestClient

def test_cors_allowed_origin(client: TestClient):
    """Test that allowed origins can make requests."""
    response = client.options(
        "/v1/chat",
        headers={"Origin": "https://youworker.com"}
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://youworker.com"
    assert response.headers["access-control-allow-credentials"] == "true"

def test_cors_blocked_origin(client: TestClient):
    """Test that disallowed origins are blocked."""
    response = client.options(
        "/v1/chat",
        headers={"Origin": "https://evil.com"}
    )
    # Should not include CORS headers
    assert "access-control-allow-origin" not in response.headers

def test_cors_invalid_format():
    """Test that invalid origin formats are rejected at startup."""
    with pytest.raises(ValueError):
        validate_cors_origins("not-a-url,https://valid.com")
```

## Security Best Practices

### 1. Principle of Least Privilege

Only allow origins that absolutely need access:

```python
# Good - Specific origins only
FRONTEND_ORIGIN=https://app.youworker.com,https://admin.youworker.com

# Bad - Too permissive
FRONTEND_ORIGIN=*
```

### 2. Fail-Fast Validation

The application validates CORS configuration at startup and refuses to start with invalid configuration:

```python
# In main.py
try:
    allowed_origins = validate_cors_origins(settings.frontend_origin)
except ValueError as e:
    logger.error(f"Invalid CORS configuration: {e}")
    raise SystemExit(1)
```

### 3. Audit CORS Changes

When modifying CORS configuration:

1. Document the reason for changes
2. Review with security team for production
3. Test thoroughly in staging environment
4. Use audit logs to track configuration changes

### 4. Monitor CORS Violations

Add logging for blocked CORS requests:

```python
@app.middleware("http")
async def log_cors_violations(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in allowed_origins:
        logger.warning(
            "CORS violation detected",
            extra={
                "origin": origin,
                "path": request.url.path,
                "method": request.method,
                "ip": request.client.host,
            }
        )
    return await call_next(request)
```

## Additional Resources

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP CORS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html)
- [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/)

## Related Configuration

- [Authentication Configuration](./AUTHENTIK.md)
- [API Documentation](./API.md)
- [Security Architecture](./ARCHITETTURA.md)
