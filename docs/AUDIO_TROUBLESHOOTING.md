# Audio Recording Troubleshooting

**Date**: 2025-10-22
**Status**: Common Issues & Solutions

---

## Issue: "navigator.mediaDevices is undefined"

### Error Message:
```
can't access property "getUserMedia", navigator.mediaDevices is undefined
```

### Cause:
The `getUserMedia` API requires a **secure context** (HTTPS) to work, except for `localhost`.

### Requirements for Audio Recording:

#### ✅ Supported Environments:
1. **HTTPS (Production)**
   - `https://yourdomain.com` ✅
   - Any HTTPS URL ✅

2. **Localhost (Development)**
   - `http://localhost:8000` ✅
   - `http://127.0.0.1:8000` ✅

#### ❌ NOT Supported:
1. **HTTP (Non-localhost)**
   - `http://95.110.228.79:8000` ❌
   - `http://192.168.1.100:8000` ❌
   - Any non-localhost HTTP URL ❌

2. **Unsupported Browsers**
   - Internet Explorer ❌
   - Very old browsers ❌

---

## Solution 1: Access via Localhost (Development)

If developing locally, access the site via:
- `http://localhost:8000` ✅
- `http://127.0.0.1:8000` ✅

**Example**:
```bash
# Access via localhost
http://localhost:8000

# NOT via IP address
http://95.110.228.79:8000  # ❌ Will fail
```

---

## Solution 2: Enable HTTPS (Production)

For production deployment on remote servers, you MUST use HTTPS.

### Option A: Nginx with Let's Encrypt (Recommended)

1. Install Certbot:
```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

2. Obtain SSL certificate:
```bash
sudo certbot --nginx -d yourdomain.com
```

3. Configure Nginx:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

4. Reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Option B: Traefik with Let's Encrypt (Docker)

Add to `docker-compose.yml`:

```yaml
services:
  traefik:
    image: traefik:v2.10
    command:
      - --providers.docker=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.email=your@email.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt

  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

### Option C: Cloudflare (Free SSL)

1. Add your domain to Cloudflare
2. Set DNS records to point to your server
3. Enable "Full" SSL/TLS mode
4. Cloudflare provides free SSL certificate automatically

---

## Solution 3: SSH Tunnel (Quick Dev Workaround)

For testing on a remote server without HTTPS setup:

```bash
# On your local machine
ssh -L 8000:localhost:8000 user@95.110.228.79

# Then access via
http://localhost:8000  # ✅ Will work
```

This tunnels the remote port to your local machine, allowing `localhost` access.

---

## Solution 4: ngrok (Quick Testing)

For temporary testing with HTTPS:

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start tunnel
ngrok http 8000

# Access via the provided HTTPS URL
# Example: https://abc123.ngrok.io
```

---

## Browser Support

### ✅ Supported Browsers (with HTTPS or localhost):
- **Chrome/Edge**: 53+ ✅
- **Firefox**: 36+ ✅
- **Safari**: 11+ ✅
- **Opera**: 40+ ✅

### ❌ Not Supported:
- Internet Explorer (any version)
- Chrome/Firefox/Safari on HTTP (non-localhost)

---

## Error Handling in Application

The application now includes a check that provides a clear error message:

```typescript
// Check for mediaDevices support
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  throw new Error("Il tuo browser non supporta la registrazione audio. Usa HTTPS o prova un browser moderno.")
}
```

This will display an inline error message in Italian:
> ⚠️ Il tuo browser non supporta la registrazione audio. Usa HTTPS o prova un browser moderno.

Translation:
> ⚠️ Your browser doesn't support audio recording. Use HTTPS or try a modern browser.

---

## Testing Steps

### 1. Check Browser Support
Open browser console and run:
```javascript
console.log(navigator.mediaDevices)
// Should show: MediaDevices object

console.log(navigator.mediaDevices.getUserMedia)
// Should show: function getUserMedia()
```

If undefined, check:
1. Are you using HTTPS or localhost?
2. Is your browser up to date?

### 2. Check Microphone Permissions
```javascript
navigator.permissions.query({ name: 'microphone' })
  .then(result => console.log('Microphone permission:', result.state))
// Should show: "granted", "denied", or "prompt"
```

### 3. Test getUserMedia
```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log('Microphone works!', stream))
  .catch(err => console.error('Microphone error:', err))
```

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `navigator.mediaDevices is undefined` | Not HTTPS or localhost | Use HTTPS or access via localhost |
| `NotAllowedError: Permission denied` | User denied microphone access | Click mic icon in address bar to grant permission |
| `NotFoundError: Requested device not found` | No microphone connected | Connect a microphone |
| `NotReadableError: Could not start audio source` | Microphone in use by another app | Close other apps using microphone |
| `OverconstrainedError` | Requested sample rate not supported | Application uses 24000 Hz (should work on all devices) |

---

## Production Checklist

Before deploying to production:

- [ ] Domain name configured
- [ ] HTTPS certificate installed (Let's Encrypt, Cloudflare, etc.)
- [ ] HTTP → HTTPS redirect enabled
- [ ] CORS configured correctly
- [ ] Microphone permission prompt working
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices (iOS, Android)
- [ ] WebSocket connection working over WSS (secure WebSocket)

---

## Architecture Notes

### Current Setup:
```
Browser (http://95.110.228.79:8000)
  ↓ getUserMedia() → ❌ FAILS (not secure context)

Browser (http://localhost:8000)
  ↓ getUserMedia() → ✅ WORKS (localhost exception)

Browser (https://yourdomain.com)
  ↓ getUserMedia() → ✅ WORKS (HTTPS)
```

### Required for Production:
```
User → HTTPS (443) → Nginx/Traefik
                       ↓
                     Frontend (8000)
                       ↓
                     API (8001)
                       ↓
                     MCP Audio (7006)
```

---

## Contact & Support

If you continue experiencing issues:

1. Check browser console for detailed error messages
2. Verify you're accessing via HTTPS or localhost
3. Test in a different browser
4. Check firewall/antivirus settings
5. Review [MDN getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

---

## Summary

**TL;DR**: Audio recording requires HTTPS (except localhost).

**Quick fix for development**: Access via `http://localhost:8000` instead of IP address.

**Production fix**: Set up HTTPS with Let's Encrypt, Cloudflare, or similar.
