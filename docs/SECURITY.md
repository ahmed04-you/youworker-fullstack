# Security Hardening Guide

## Overview

YouWorker.AI is an on-premise, offline-first AI assistant designed for secure deployment on client hardware. This guide covers security best practices, hardening procedures, and threat mitigation strategies.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Authentication & Authorization](#authentication--authorization)
3. [Network Security](#network-security)
4. [Secret Management](#secret-management)
5. [Input Validation & Sanitization](#input-validation--sanitization)
6. [Encryption](#encryption)
7. [Audit Logging](#audit-logging)
8. [Security Checklist](#security-checklist)
9. [Incident Response](#incident-response)

---

## Security Architecture

### Multi-Layer Security Model

```
┌─────────────────────────────────────────────┐
│ Layer 1: Network (IP Whitelist, Firewall)  │
├─────────────────────────────────────────────┤
│ Layer 2: TLS/SSL (Nginx Reverse Proxy)     │
├─────────────────────────────────────────────┤
│ Layer 3: Authentication (JWT + Cookies)     │
├─────────────────────────────────────────────┤
│ Layer 4: Authorization (User Permissions)   │
├─────────────────────────────────────────────┤
│ Layer 5: Input Validation (XSS Prevention)  │
├─────────────────────────────────────────────┤
│ Layer 6: Rate Limiting (DDoS Protection)    │
└─────────────────────────────────────────────┘
```

### Threat Model

**Protected Against:**
- ✅ Unauthorized network access (IP whitelisting)
- ✅ Man-in-the-middle attacks (TLS/SSL)
- ✅ Cross-site scripting (XSS sanitization)
- ✅ Brute force attacks (rate limiting)
- ✅ Session hijacking (HttpOnly cookies)
- ✅ CSRF attacks (SameSite cookies)
- ✅ Directory traversal (path validation)

**Limitations:**
- ⚠️ Physical access to server (implement disk encryption)
- ⚠️ Insider threats (implement audit logging)
- ⚠️ Zero-day vulnerabilities (keep dependencies updated)

---

## Authentication & Authorization

### Cookie-Based Authentication

The application uses **HttpOnly cookies** for authentication, providing protection against XSS attacks.

#### Flow:
1. Authentik authenticates the user and injects the API key header, or the client posts an API key to `/v1/auth/login`
2. Server validates the API key and returns a JWT in an HttpOnly cookie
3. Browser automatically sends the cookie with each request
4. Server validates the JWT from the cookie
5. Token auto-refreshes before expiration

#### Configuration:

**Cookie Security Attributes:**
```python
{
    "httponly": True,      # Not accessible via JavaScript
    "secure": True,        # HTTPS only (production)
    "samesite": "lax",     # CSRF protection
    "max_age": 1800,       # 30 minutes
}
```

**Token Rotation:**
- Access tokens expire after 30 minutes
- Frontend auto-refreshes 1 minute before expiry
- On refresh failure, user is logged out

### Authentik-Managed API Keys

When deployed behind Authentik, the reverse proxy injects a header (default `X-Authentik-Api-Key`) containing the per-user API key. The backend exchanges this header for a cookie by calling `/v1/auth/auto-login`. This keeps API keys off the client while still supporting browser-based access.

API keys remain available for programmatic access via:
- `X-API-Key` header
- `Authorization` header (raw key)

**Best Practice:** Prefer Authentik + cookie auth for browser clients; reserve direct API keys for server-to-server automation.

---

## Network Security

### IP Whitelisting

The application includes IP whitelisting middleware for production deployments.

#### Configuration:

**[.env](./../.env.example)**
```bash
APP_ENV=production
WHITELISTED_IPS=93.41.222.40,127.0.0.1
```

#### How It Works:
1. Middleware extracts client IP from headers (`X-Forwarded-For`, `X-Real-IP`)
2. Compares against whitelist
3. Returns `403 Forbidden` if IP not whitelisted
4. Disabled in development mode (`APP_ENV=development`)

#### Firewall Rules (Recommended):

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 93.41.222.40 to any port 8000
sudo ufw allow from 127.0.0.1 to any port 8000
sudo ufw enable

# iptables
iptables -A INPUT -s 93.41.222.40 -p tcp --dport 8000 -j ACCEPT
iptables -A INPUT -s 127.0.0.1 -p tcp --dport 8000 -j ACCEPT
iptables -A INPUT -p tcp --dport 8000 -j DROP
```

### TLS/SSL Configuration

**Self-Signed Certificate Generation:**
```bash
make ssl-setup
# or manually:
./scripts/generate-ssl-cert.sh yourdomain.com 95.110.228.79
```

**Nginx TLS Configuration:**
- TLSv1.2 and TLSv1.3 only
- Strong cipher suites
- HSTS enabled (max-age: 2 years)
- Perfect Forward Secrecy (PFS)

**Production Recommendation:** Use Let's Encrypt for trusted certificates:
```bash
certbot certonly --standalone -d yourdomain.com
```

### CORS Policy

**Configured Origins:**
```bash
FRONTEND_ORIGIN=https://95.110.228.79,https://yourdomain.com
```

**Validation:**
- Strict URL parsing (scheme + host only)
- No wildcards in production
- Path/query/fragment not allowed

---

## Secret Management

### Secret Generation

**Generate Strong Secrets:**
```bash
# ROOT_API_KEY (64 hex characters)
openssl rand -hex 32

# JWT_SECRET (different from ROOT_API_KEY!)
openssl rand -hex 32

# POSTGRES_PASSWORD
openssl rand -hex 32
```

### Secret Rotation

**Rotation Schedule:**
- ROOT_API_KEY: Every 90 days
- JWT_SECRET: Every 180 days
- POSTGRES_PASSWORD: Every 180 days

**Rotation Procedure:**

1. **Generate new secrets:**
   ```bash
   export NEW_ROOT_KEY=$(openssl rand -hex 32)
   export NEW_JWT_SECRET=$(openssl rand -hex 32)
   ```

2. **Update .env file:**
   ```bash
   sed -i "s/ROOT_API_KEY=.*/ROOT_API_KEY=$NEW_ROOT_KEY/" .env
   sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env
   ```

3. **Restart services:**
   ```bash
   make compose-down
   make compose-up
   ```

4. **Verify authentication:**
   ```bash
   curl -X POST https://95.110.228.79/v1/auth/login \
     -H "Content-Type: application/json" \
     -d "{\"api_key\": \"$NEW_ROOT_KEY\"}"
   ```

5. **Update client configurations** (provide new API key to users)

### Environment Security

**.gitignore (verify):**
```
.env
.env.local
.env.production
```

**File Permissions:**
```bash
chmod 600 .env
chown root:root .env
```

---

## Input Validation & Sanitization

### XSS Prevention

The application implements comprehensive XSS sanitization in [apps/api/auth/security.py](../apps/api/auth/security.py):

**Protected Against:**
- `<script>` tags
- `<iframe>`, `<object>`, `<embed>` tags
- JavaScript event handlers (`onclick`, `onerror`, etc.)
- `javascript:`, `data:`, `vbscript:` URIs
- Control characters (except whitespace)

**Example:**
```python
from apps.api.auth.security import sanitize_input

user_input = '<script>alert("XSS")</script>Hello'
safe_input = sanitize_input(user_input)
# Result: 'Hello'
```

### Path Traversal Prevention

**File Upload Validation:**
```python
from apps.api.auth.security import validate_file_path

# Only allows paths within:
# - /data/uploads

if validate_file_path(user_provided_path):
    # Safe to process
else:
    raise HTTPException(status_code=400, detail="Invalid path")
```

### Rate Limiting

**Default Limits:**
```python
# Global: 100 requests/minute
# Chat: 30 requests/minute
# Ingestion: 10 requests/minute
```

**Custom Rate Limiting:**
```python
@router.post("/endpoint")
@limiter.limit("20/minute")
async def endpoint():
    pass
```

---

## Encryption

### Data at Rest

**Currently Implemented:**
- ❌ Chat history: **NOT encrypted** (stored in plaintext PostgreSQL)
- ✅ TLS connections: Encrypted in transit
- ❌ Backups: **NOT encrypted**

**Recommended:**
1. **Database Encryption:**
   ```bash
   # PostgreSQL encryption at rest
   apt-get install postgresql-contrib
   ALTER SYSTEM SET ssl = on;
   ```

2. **Backup Encryption:**
   ```bash
   # Encrypt backups with GPG
   gpg --symmetric --cipher-algo AES256 backup.sql
   ```

### Data in Transit

- **Frontend ↔ Nginx:** HTTPS (TLS 1.2/1.3)
- **Nginx ↔ API:** HTTP (internal Docker network)
- **API ↔ Services:** HTTP (internal Docker network)

**Recommendation:** For high-security environments, enable TLS for internal communication using mTLS.

---

## Audit Logging

### Current Logging

**What's Logged:**
- Request correlation IDs
- Authentication attempts
- IP addresses
- Rate limit violations
- Error exceptions

**Log Format:**
```
2025-10-27 10:15:32 - app - INFO - [correlation-id] - Message
```

### Recommended Enhancements

**Add Structured Logging:**
```python
import json
logger.info(json.dumps({
    "event": "login_success",
    "user": username,
    "ip": client_ip,
    "timestamp": datetime.utcnow().isoformat(),
    "correlation_id": correlation_id
}))
```

**Log Retention:**
```bash
# Logrotate configuration
/var/log/youworker/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 root adm
}
```

**SIEM Integration:**
- Forward logs to centralized SIEM (Splunk, ELK, Graylog)
- Set up alerts for:
  - Multiple failed login attempts
  - Access from non-whitelisted IPs
  - Rate limit violations
  - 5xx errors (potential attacks)

---

## Security Checklist

### Pre-Deployment

- [ ] Generate unique secrets (`openssl rand -hex 32`)
- [ ] Update `.env` with production values
- [ ] Set `APP_ENV=production`
- [ ] Configure IP whitelist (`WHITELISTED_IPS`)
- [ ] Update CORS origins (`FRONTEND_ORIGIN`)
- [ ] Generate SSL certificates
- [ ] Test authentication flow
- [ ] Verify rate limiting works
- [ ] Review firewall rules
- [ ] Enable automated backups

### Post-Deployment

- [ ] Verify HTTPS works
- [ ] Test IP whitelisting (access from non-whitelisted IP should fail)
- [ ] Test login with correct/incorrect API key
- [ ] Verify cookie is HttpOnly and Secure
- [ ] Check CORS headers in browser DevTools
- [ ] Monitor logs for errors
- [ ] Set up log rotation
- [ ] Document secret rotation schedule
- [ ] Configure monitoring/alerting
- [ ] Perform security scan (OWASP ZAP, Nessus)

### Monthly Maintenance

- [ ] Review access logs for anomalies
- [ ] Update dependencies (`pip list --outdated`)
- [ ] Check for CVEs in dependencies
- [ ] Rotate secrets (quarterly)
- [ ] Test backup restoration
- [ ] Review and update firewall rules

---

## Incident Response

### Security Incident Types

1. **Unauthorized Access Attempt**
2. **Data Breach**
3. **Denial of Service (DoS)**
4. **Malware/Ransomware**
5. **Insider Threat**

### Response Procedure

#### 1. Detection
- Monitor logs for suspicious activity
- Set up alerts for:
  - Multiple 401/403 errors
  - Unusual traffic patterns
  - Access from unknown IPs

#### 2. Containment
```bash
# Immediately block suspicious IP
iptables -A INPUT -s SUSPICIOUS_IP -j DROP

# Rotate all secrets
./scripts/rotate-secrets.sh

# Restart services
make compose-down && make compose-up
```

#### 3. Investigation
```bash
# Review access logs
grep "SUSPICIOUS_IP" /var/log/nginx/access.log

# Check database for unauthorized changes
psql -U youworker -d youworker -c "SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT 100;"

# Review authentication attempts
grep "authentication" /var/log/youworker/api.log
```

#### 4. Recovery
- Restore from known-good backup
- Re-deploy with patched vulnerabilities
- Update firewall rules
- Notify stakeholders

#### 5. Post-Incident
- Document timeline and actions taken
- Update runbooks based on lessons learned
- Implement additional monitoring
- Schedule security audit

---

## Security Contacts

**Report Security Issues:**
- Email: security@youworker.ai
- GitHub Security Advisory: [Private reporting](https://github.com/youworker/youworker-fullstack/security/advisories/new)

**Do NOT report security issues in public GitHub issues.**

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/archive/2023/2023_top25_list.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)

---

**Last Updated:** 2025-10-27
**Version:** 1.0.0
