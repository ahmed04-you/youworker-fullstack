# Integrazione AUTHENTIK con YouWorker

Questa guida descrive come configurare AUTHENTIK per l'autenticazione e la gestione delle API key di YouWorker.

---

## Panoramica

**AUTHENTIK** è una soluzione Identity Provider (IdP) open-source che gestisce:

- Autenticazione utenti (SSO, LDAP, OAuth, SAML)
- Gestione identità centralizzata
- Generazione e validazione API key
- Proxy forwarding con header injection
- Policy di accesso basate su gruppi e attributi

**YouWorker** delega completamente ad AUTHENTIK:
- **Login/logout**: Nessun sistema di password interno
- **API key**: Generate da AUTHENTIK, validate da YouWorker
- **User provisioning**: Creazione automatica utenti al primo accesso
- **Authorization**: Policy e gruppi gestiti in AUTHENTIK

---

## Architettura di Integrazione

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. Accesso a https://youworker.azienda.it
       ▼
┌──────────────────────────────────────┐
│       AUTHENTIK PROXY OUTPOST        │
│  - Intercetta richieste              │
│  - Verifica autenticazione           │
│  - Inietta header X-Authentik-Api-Key│
└──────┬───────────────────────────────┘
       │
       │ 2. Request + Header
       ▼
┌──────────────────────────────────────┐
│           NGINX (YouWorker)          │
│  - Reverse proxy                     │
│  - Forward header a backend          │
└──────┬───────────────────────────────┘
       │
       │ 3. Request + X-Authentik-Api-Key
       ▼
┌──────────────────────────────────────┐
│         FastAPI Backend              │
│  - Estrae header                     │
│  - Valida API key                    │
│  - Carica/crea utente                │
│  - Genera JWT session                │
└──────────────────────────────────────┘
```

---

## Prerequisiti

1. **AUTHENTIK installato e funzionante**
   - Versione: 2023.10 o superiore
   - URL: `https://auth.azienda.it`
   - Accesso admin

2. **Certificati SSL**
   - AUTHENTIK e YouWorker devono usare HTTPS
   - Certificati validi (non autofirmati in produzione)

3. **Network**
   - AUTHENTIK deve poter raggiungere YouWorker
   - YouWorker deve poter ricevere header da AUTHENTIK

---

## Configurazione AUTHENTIK

### Passo 1: Creare un Provider

1. Accedi ad AUTHENTIK come admin
2. Vai su **Applications** → **Providers**
3. Clicca **Create**
4. Seleziona **Proxy Provider**

**Configurazione Provider:**

```yaml
Name: YouWorker Proxy
Authorization flow: default-provider-authorization-implicit-consent
Type: Forward auth (single application)
External host: https://youworker.azienda.it
```

**Advanced settings:**

```yaml
# Header forwarding
Send HTTP-Basic Username: ❌ (disabilitato)
Send HTTP-Basic Password: ❌ (disabilitato)

# Custom header (IMPORTANTE)
Additional scopes: email,profile,openid

# Token settings
Token validity: 30 minutes
```

5. Salva il provider

---

### Passo 2: Creare l'Applicazione

1. Vai su **Applications**
2. Clicca **Create**

**Configurazione:**

```yaml
Name: YouWorker
Slug: youworker
Provider: YouWorker Proxy (appena creato)
Launch URL: https://youworker.azienda.it
Group: Applicazioni Interne (opzionale)
```

**Policy engine mode:**
- Seleziona `any` se vuoi che tutti gli utenti possano accedere
- Seleziona policy specifiche per limitare l'accesso

3. Salva l'applicazione

---

### Passo 3: Configurare l'Outpost

L'outpost è il proxy che intercetta le richieste.

1. Vai su **Outposts**
2. Seleziona l'outpost esistente o crea uno nuovo

**Configurazione Outpost:**

```yaml
Name: YouWorker Proxy Outpost
Type: Proxy
Authentik Host: https://auth.azienda.it
Token: <generato automaticamente>

Applications:
  - ☑ YouWorker

Configuration:
  authentik_host: https://auth.azienda.it
  log_level: info
  docker_labels: null
  docker_network: null
  docker_map_ports: true
  container_image: null
  kubernetes_replicas: 1
  kubernetes_ingress_annotations: {}
  kubernetes_ingress_secret_name: authentik-outpost-tls
```

**Advanced:**

```yaml
# Custom headers
Custom Headers:
  X-Authentik-Api-Key: "%(ak_token)s"
```

Questo è **CRITICO**: l'header `X-Authentik-Api-Key` deve contenere il token dell'utente.

---

### Passo 4: Deployment Outpost

L'outpost può essere deployato come:

#### Opzione A: Docker Compose (consigliato)

Aggiungi al tuo `docker-compose.yml`:

```yaml
services:
  authentik-outpost:
    image: ghcr.io/goauthentik/proxy:2023.10
    container_name: authentik-outpost-youworker
    environment:
      AUTHENTIK_HOST: https://auth.azienda.it
      AUTHENTIK_INSECURE: false
      AUTHENTIK_TOKEN: <token-from-authentik-outpost-settings>
    ports:
      - "9000:9000"  # Outpost proxy port
    networks:
      - youworker-network
    restart: unless-stopped
```

#### Opzione B: Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: authentik-outpost-youworker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: authentik-outpost
  template:
    metadata:
      labels:
        app: authentik-outpost
    spec:
      containers:
      - name: proxy
        image: ghcr.io/goauthentik/proxy:2023.10
        env:
        - name: AUTHENTIK_HOST
          value: "https://auth.azienda.it"
        - name: AUTHENTIK_TOKEN
          valueFrom:
            secretKeyRef:
              name: authentik-outpost-token
              key: token
        ports:
        - containerPort: 9000
```

---

### Passo 5: Configurare Policy di Accesso

Per limitare l'accesso a YouWorker solo a utenti specifici:

1. Vai su **Flows & Stages** → **Policies**
2. Crea una nuova **Expression Policy**

**Esempio: Solo gruppo "YouWorker Users"**

```python
# Policy name: youworker-access-policy
return ak_is_group_member(request.user, name="YouWorker Users")
```

**Esempio: Solo utenti con attributo "department=IT"**

```python
return request.user.attributes.get("department") == "IT"
```

3. Vai su **Applications** → **YouWorker** → **Policy Bindings**
4. Aggiungi la policy creata
5. Ordine: Prima delle policy di default

---

### Passo 6: Generare API Key per Utenti

AUTHENTIK non genera API key statiche di default. Ecco due approcci:

#### Approccio A: Utilizzare Token OIDC

Questo è l'approccio **raccomandato** per YouWorker.

**Configurazione:**

1. L'outpost invia il token OIDC dell'utente nell'header `X-Authentik-Api-Key`
2. YouWorker valida il token usando JWKS di AUTHENTIK
3. Al primo accesso, YouWorker crea un utente interno mappato all'utente AUTHENTIK

**YouWorker `.env`:**

```bash
AUTHENTIK_ENABLED=true
AUTHENTIK_HEADER_NAME=X-Authentik-Api-Key
AUTHENTIK_JWKS_URL=https://auth.azienda.it/application/o/youworker/.well-known/jwks.json
AUTHENTIK_ISSUER=https://auth.azienda.it/application/o/youworker/
```

**Flusso:**

```
1. Utente accede a YouWorker
2. AUTHENTIK autentica → Genera token OIDC
3. Outpost inietta header: X-Authentik-Api-Key: <token>
4. YouWorker riceve header
5. Valida token con JWKS
6. Estrae claims (sub, email, groups)
7. Cerca utente interno con sub=<authentik-user-id>
8. Se non esiste, crea utente
9. Genera JWT session interna
10. Utente è loggato
```

#### Approccio B: API Key Statiche (Legacy)

Per compatibilità, puoi usare API key statiche.

**Generazione:**

1. In AUTHENTIK, vai su **Directory** → **Tokens & App passwords**
2. Crea un **App password** per l'utente
3. Configura l'outpost per inviare l'app password nell'header

**Limitazioni:**
- Gestione manuale delle chiavi
- Nessuna rotazione automatica
- Difficile revoca

**NON RACCOMANDATO** per nuove installazioni.

---

## Configurazione YouWorker

### File `.env`

```bash
# ===========================
# AUTHENTIK INTEGRATION
# ===========================

# Abilita integrazione AUTHENTIK
AUTHENTIK_ENABLED=true

# Nome header che contiene il token/API key
AUTHENTIK_HEADER_NAME=X-Authentik-Api-Key

# URL JWKS per validazione token OIDC
AUTHENTIK_JWKS_URL=https://auth.azienda.it/application/o/youworker/.well-known/jwks.json

# Issuer del token (deve coincidere con claim "iss")
AUTHENTIK_ISSUER=https://auth.azienda.it/application/o/youworker/

# URL di logout (opzionale)
AUTHENTIK_LOGOUT_URL=https://auth.azienda.it/application/o/youworker/end-session/

# Mapping attributi utente
AUTHENTIK_USERNAME_CLAIM=preferred_username
AUTHENTIK_EMAIL_CLAIM=email
AUTHENTIK_GROUPS_CLAIM=groups

# Auto-provisioning utenti
AUTHENTIK_AUTO_CREATE_USERS=true

# ===========================
# ALTRI SETTINGS
# ===========================

# Origine frontend (IMPORTANTE)
FRONTEND_ORIGIN=https://youworker.azienda.it

# Cookie settings
COOKIE_DOMAIN=.azienda.it
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
```

### Middleware di Autenticazione

YouWorker include middleware per validare token AUTHENTIK.

**File:** `apps/api/middleware/auth.py`

```python
async def get_current_user_from_authentik(
    request: Request,
    header_name: str = settings.AUTHENTIK_HEADER_NAME
) -> User:
    """
    Estrae e valida token AUTHENTIK dall'header.
    Crea utente se non esiste (auto-provisioning).
    """
    token = request.headers.get(header_name)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication header"
        )

    # Valida token OIDC usando JWKS
    try:
        claims = await validate_oidc_token(
            token=token,
            jwks_url=settings.AUTHENTIK_JWKS_URL,
            issuer=settings.AUTHENTIK_ISSUER
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {e}"
        )

    # Estrai info utente da claims
    authentik_user_id = claims.get("sub")
    username = claims.get(settings.AUTHENTIK_USERNAME_CLAIM)
    email = claims.get(settings.AUTHENTIK_EMAIL_CLAIM)
    groups = claims.get(settings.AUTHENTIK_GROUPS_CLAIM, [])

    # Carica o crea utente interno
    user = await db.users.get_by_external_id(authentik_user_id)

    if not user and settings.AUTHENTIK_AUTO_CREATE_USERS:
        user = await db.users.create(
            username=username,
            email=email,
            external_id=authentik_user_id,
            external_provider="authentik",
            groups=groups
        )
        logger.info(f"Auto-created user {username} from AUTHENTIK")
    elif not user:
        raise HTTPException(
            status_code=403,
            detail="User not authorized"
        )

    return user
```

---

## Testing dell'Integrazione

### Test 1: Verifica Outpost

```bash
# Verifica che l'outpost sia online
curl http://localhost:9000/outpost.goauthentik.io/ping
# Risposta attesa: {"version": "2023.10.x", "mode": "proxy"}
```

### Test 2: Accesso Web

1. Apri browser in incognito
2. Naviga a `https://youworker.azienda.it`
3. Dovresti essere rediretto ad AUTHENTIK
4. Effettua login con utente autorizzato
5. Dovresti essere rediretto a YouWorker loggato

**Se fallisce:**
- Controlla log AUTHENTIK outpost: `docker logs authentik-outpost-youworker`
- Controlla log YouWorker API: `docker logs youworker-api`
- Verifica che l'header `X-Authentik-Api-Key` sia presente (DevTools → Network)

### Test 3: Validazione Token

```bash
# Estrai token dall'header dopo il login
TOKEN="<token-from-browser-devtools>"

# Valida token manualmente
curl -H "X-Authentik-Api-Key: $TOKEN" \
     https://youworker.azienda.it:8000/v1/auth/me

# Risposta attesa:
{
  "username": "mario.rossi",
  "email": "mario.rossi@azienda.it",
  "is_root": false,
  "created_at": "2025-01-15T10:00:00Z"
}
```

### Test 4: Revoca Accesso

1. In AUTHENTIK, rimuovi l'utente dal gruppo autorizzato
2. L'utente dovrebbe perdere accesso immediatamente
3. Verifica che riceva errore 403

---

## Troubleshooting

### Problema: Header non ricevuto da YouWorker

**Sintomo:**
```
ERROR: Missing authentication header X-Authentik-Api-Key
```

**Soluzione:**

1. Verifica configurazione outpost:
   - Custom headers: `X-Authentik-Api-Key: "%(ak_token)s"`

2. Verifica NGINX forwarda l'header:

```nginx
# ops/docker/nginx/nginx.conf
location /v1/ {
    proxy_pass http://api:8001;
    proxy_set_header X-Authentik-Api-Key $http_x_authentik_api_key;
    # ... altri header
}
```

3. Debug header ricevuti:

```python
# Aggiungi in middleware
logger.debug(f"All headers: {dict(request.headers)}")
```

---

### Problema: Token non valido

**Sintomo:**
```
ERROR: Invalid token: Signature verification failed
```

**Cause possibili:**

1. **JWKS URL errato**
   - Verifica: `curl https://auth.azienda.it/application/o/youworker/.well-known/jwks.json`
   - Deve ritornare JSON con chiavi pubbliche

2. **Issuer non coincide**
   - Il claim `iss` nel token deve coincidere con `AUTHENTIK_ISSUER`
   - Decodifica token: `jwt.io`

3. **Token scaduto**
   - Verifica claim `exp` nel token
   - Aumenta token validity in AUTHENTIK se necessario

---

### Problema: Utente non creato automaticamente

**Sintomo:**
```
ERROR: User not authorized
```

**Soluzione:**

1. Verifica `AUTHENTIK_AUTO_CREATE_USERS=true` in `.env`

2. Controlla claim nel token:
```python
# Decodifica token e stampa claims
import jwt
token = "..."
claims = jwt.decode(token, options={"verify_signature": False})
print(claims)
```

3. Verifica mapping claim:
```bash
AUTHENTIK_USERNAME_CLAIM=preferred_username  # Deve esistere nel token
AUTHENTIK_EMAIL_CLAIM=email                  # Deve esistere nel token
```

---

### Problema: Redirect loop

**Sintomo:**
Browser continua a fare redirect tra AUTHENTIK e YouWorker.

**Soluzione:**

1. **Cookie domain errato:**
```bash
# Deve essere un dominio comune
COOKIE_DOMAIN=.azienda.it
```

2. **SameSite policy:**
```bash
COOKIE_SAMESITE=lax  # Non "strict"
```

3. **HTTPS richiesto:**
```bash
COOKIE_SECURE=true
# E verifica che sia HTTPS su entrambi i servizi
```

---

## Best Practices

### Sicurezza

1. **Usa sempre HTTPS**: Mai HTTP in produzione
2. **Valida issuer**: Previene token injection
3. **Verifica firma token**: Usa JWKS, non secret condivisi
4. **Rotazione chiavi**: AUTHENTIK ruota chiavi automaticamente
5. **Audit logs**: Abilita logging dettagliato in AUTHENTIK e YouWorker
6. **IP whitelisting**: Limita accesso AUTHENTIK solo da network aziendale

### Performance

1. **Cache JWKS**: Cache chiavi pubbliche per 1 ora
2. **Token validity**: 30 min è un buon compromesso
3. **Session cookie**: Usa HttpOnly cookie interne per evitare validazione token ad ogni richiesta
4. **Connection pooling**: Riutilizza connessioni HTTP

### Operazioni

1. **Monitoring**: Monitora health outpost e validazione token
2. **Backup**: Backup configurazione AUTHENTIK regolare
3. **Disaster recovery**: Documenta procedura ripristino
4. **Staging environment**: Testa modifiche prima di produzione

---

## FAQ

### Q: Posso usare più applicazioni con lo stesso outpost?

**A:** Sì, ma ogni applicazione deve avere il suo provider. L'outpost può gestire multiple applicazioni.

### Q: Come gestisco utenti guest/anonimi?

**A:** AUTHENTIK supporta flussi anonimi. Configura un provider OAuth2 separato per guest.

### Q: Posso integrare con Active Directory?

**A:** Sì, AUTHENTIK supporta LDAP/Active Directory come source. Configura in **Directory** → **Federation & Social login**.

### Q: Come rotare le API key?

**A:** Con token OIDC, la rotazione è automatica (scadenza token). Con API key statiche, revoca e genera nuova chiave in AUTHENTIK.

### Q: Supporto per MFA?

**A:** Sì, AUTHENTIK supporta TOTP, WebAuthn, SMS. Configura stage MFA nel flusso di autenticazione.

### Q: Come debuggare problemi di autenticazione?

**A:**
1. Log AUTHENTIK: Admin → System → System Tasks → Logs
2. Log outpost: `docker logs authentik-outpost-youworker`
3. Log YouWorker: `docker logs youworker-api | grep auth`
4. Browser DevTools: Verifica redirect e header

---

## Riferimenti

- **AUTHENTIK Docs**: https://goauthentik.io/docs/
- **Proxy Provider**: https://goauthentik.io/docs/providers/proxy/
- **Outpost**: https://goauthentik.io/docs/outposts/
- **OIDC**: https://openid.net/specs/openid-connect-core-1_0.html
- **JWT**: https://jwt.io/

---

## Supporto

Per problemi di integrazione AUTHENTIK:

**YouCo Support:**
- Email: support@youco.it
- Telefono: +39 02 1234 5678

**AUTHENTIK Community:**
- Discord: https://goauthentik.io/discord
- GitHub: https://github.com/goauthentik/authentik

---

**Versione documento:** 1.0
**Ultima modifica:** Gennaio 2025
