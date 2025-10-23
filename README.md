# YouWorker.AI

**Assistente conversazionale AI con interazione vocale e testuale, ricerca semantica e integrazione estensibile di strumenti.**

YouWorker.AI è un'applicazione full-stack che combina tecnologie web moderne con modelli AI locali per offrire un'esperienza conversazionale potente e orientata alla privacy. Costruito con Next.js, FastAPI e il Model Context Protocol (MCP).

---

## ✨ Caratteristiche Principali

### 🎙️ **Doppia Modalità di Interazione**
- **Modalità Testo**: Risposte in streaming real-time con Server-Sent Events
- **Modalità Voce**: Input vocale push-to-talk con riconoscimento e sintesi vocale italiana

### 🤖 **Sistema Agente Intelligente**
- Alimentato da modelli Ollama locali (privacy-first, nessuna API esterna)
- Scoperta dinamica degli strumenti via Model Context Protocol (MCP)
- Architettura single-tool stepper per comportamento affidabile e prevedibile
- Risposte in streaming con feedback sull'esecuzione degli strumenti

### 📚 **Gestione della Conoscenza**
- Ingestione documenti da file e URL
- Ricerca semantica con embedding vettoriali
- Supporto per PDF, file di testo e contenuti web
- Database vettoriale Qdrant per ricerca rapida per similarità

### 🛠️ **Sistema Strumenti Estensibile**
- **Ricerca Web**: Recupero e riassunto contenuti web in tempo reale
- **Query Semantica**: Recupero documenti RAG-powered
- **Data e Ora**: Operazioni calendario con timezone
- **Conversione Unità**: Calcoli quantità fisiche
- **Strumenti Personalizzati**: Facile integrazione via protocollo MCP

### 🎨 **UI/UX Moderna**
- Interfaccia pulita e responsive costruita con Next.js 15 e Tailwind CSS
- Visualizzazione real-time esecuzione strumenti
- Indicatori livello audio e controlli riproduzione
- Design mobile-friendly

---

## 🚀 Avvio Rapido

### Prerequisiti

- **Docker** e **Docker Compose** (consigliato)
- **GPU NVIDIA** (opzionale, per modelli accelerati)
- **Python 3.11+** e **Node.js 20+** (per sviluppo locale)

### Installazione con Docker (Consigliato)

1. **Clona il repository**:
   ```bash
   git clone <url-repository>
   cd youworker-fullstack
   ```

2. **Configura l'ambiente**:
   ```bash
   cp .env.example .env
   # Modifica .env con le tue preferenze
   ```

3. **Scarica i modelli TTS** (per modalità voce):
   ```bash
   ./ops/download-piper-models.sh
   ```

4. **Avvia tutti i servizi**:
   ```bash
   make compose-up
   ```

5. **Accedi all'applicazione**:
   - **Frontend**: http://localhost:8000
   - **API**: http://localhost:8001
   - **Documentazione API**: http://localhost:8001/docs

### Sequenza di Avvio

Lo stack Docker Compose avvia i servizi in questo ordine:

1. **PostgreSQL** - Storage sessioni e dati utente
2. **Qdrant** - Database vettoriale per ricerca semantica
3. **Ollama** - Server modelli linguistici locali
4. **Server MCP** - Fornitori di strumenti (web, semantic, datetime, ingest, units)
5. **API** - Backend FastAPI
6. **Frontend** - Applicazione web Next.js

**Il primo avvio può richiedere 5-10 minuti** mentre Ollama scarica i modelli richiesti (gpt-oss, embeddinggemma).

---

## ⚙️ Configurazione

### Variabili d'Ambiente Essenziali

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `CHAT_MODEL` | Modello chat Ollama | `gpt-oss:latest` |
| `EMBED_MODEL` | Modello embedding | `embeddinggemma:300m` |
| `ROOT_API_KEY` | Chiave autenticazione API | `dev-root-key` |
| `OLLAMA_BASE_URL` | URL servizio Ollama | `http://ollama:11434` |
| `QDRANT_URL` | URL servizio Qdrant | `http://qdrant:6333` |
| `DATABASE_URL` | Connessione PostgreSQL | Auto-configurato |

### Configurazione Vocale

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `STT_MODEL` | Dimensione modello Whisper | `small` |
| `STT_DEVICE` | Dispositivo compute | `cuda` |
| `STT_LANGUAGE` | Lingua riconoscimento vocale | `it` |
| `TTS_VOICE` | Modello voce Piper | `it_IT-paola-medium` |
| `TTS_PROVIDER` | Motore TTS | `piper` |

### Configurazione Frontend

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `NEXT_PUBLIC_API_KEY` | Chiave API browser | Deve corrispondere a `ROOT_API_KEY` |
| `NEXT_PUBLIC_API_PORT` | Porta API | `8000` |

---

## 📖 Guida all'Uso

### Modalità Chat Testuale

1. Clicca il pulsante **"Testo"** nell'intestazione
2. Digita il tuo messaggio nel compositore
3. Premi Invio o clicca Invia
4. Osserva le risposte in streaming real-time e le esecuzioni degli strumenti

**Funzionalità**:
- Streaming token in tempo reale
- Visualizzazione esecuzione strumenti
- Risposte contestuali
- Riproduzione audio opzionale (attiva icona altoparlante)

### Modalità Voce

1. Clicca il pulsante **"Voce"** nell'intestazione
2. **Tieni premuto** il pulsante microfono e parla
3. **Rilascia** quando hai finito di parlare
4. Ascolta la risposta vocale dell'AI

**Funzionalità**:
- Registrazione push-to-talk
- Visualizzazione livello audio in tempo reale
- Trascrizione automatica italiana
- Risposte text-to-speech naturali

**Nota**: La modalità voce richiede HTTPS in produzione (i browser limitano l'accesso al microfono ai contesti sicuri). Usa `localhost` per lo sviluppo.

### Ingestione Documenti

1. Naviga alla pagina **Ingest**
2. Carica file o fornisci URL
3. Seleziona il tipo di documento (auto-rilevato per i file)
4. Clicca "Ingest" per elaborare

**Formati supportati**:
- Documenti PDF
- File di testo
- Pagine web (via URL)

---

## 🛠️ Strumenti Disponibili

### Ricerca Web
- `fetch_url`: Scarica e analizza pagine web
- `search_duckduckgo`: Cerca sul web
- `http_request`: Richieste HTTP personalizzate

### Query Semantica
- `semantic_search`: Trova documenti rilevanti per significato
- `list_collections`: Sfoglia collezioni documenti
- `get_collection_stats`: Visualizza metadati collezione

### Data e Ora
- `get_current_datetime`: Ottieni ora corrente in qualsiasi timezone
- `convert_timezone`: Converti tra timezone
- `calculate_time_difference`: Calcola differenze temporali

### Ingestione Documenti
- `ingest_file`: Carica ed elabora documenti
- `ingest_url`: Elabora contenuti web
- `list_ingested_documents`: Visualizza file elaborati

### Conversione Unità
- `convert_units`: Converti tra unità (lunghezza, massa, temperatura, ecc.)

---

## 🧪 Sviluppo

### Setup Sviluppo Locale

#### Backend
```bash
# Crea ambiente virtuale
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Installa dipendenze
pip install -r requirements.txt

# Avvia server sviluppo
uvicorn apps.api.main:app --reload --port 8001
```

#### Frontend
```bash
cd apps/frontend

# Installa dipendenze
npm install

# Avvia server sviluppo
npm run dev
```

Accedi al server di sviluppo su http://localhost:3000

### Esecuzione Test

```bash
# Esegui tutti i test
pytest

# Esegui con coverage
pytest --cov=apps --cov=packages --cov-report=html

# Esegui suite test specifica
pytest tests/unit/
pytest tests/integration/
```

---

## 📁 Struttura Progetto

```
youworker-fullstack/
├── apps/
│   ├── api/                    # Backend FastAPI
│   ├── frontend/               # Applicazione Next.js
│   └── mcp_servers/            # Servizi fornitori strumenti
├── packages/
│   ├── agent/                  # Orchestrazione agente
│   ├── llm/                    # Client Ollama
│   ├── mcp/                    # Client protocollo MCP
│   ├── ingestion/              # Pipeline documenti
│   ├── vectorstore/            # Wrapper Qdrant
│   ├── db/                     # Modelli database
│   └── common/                 # Utility condivise
├── ops/
│   ├── docker/                 # Dockerfile
│   └── compose/                # Configurazioni Docker Compose
├── docs/                       # Documentazione
├── tests/                      # Suite test
└── data/                       # Dati persistenti (git-ignored)
```

---

## 🔒 Sicurezza

- **Autenticazione API**: Tutti gli endpoint richiedono autenticazione con chiave API
- **Rate Limiting**: Limitazione integrata su endpoint sensibili
- **Validazione Input**: Validazione completa richieste con Pydantic
- **Configurazione CORS**: Whitelist origini stretta
- **Prevenzione SQL Injection**: Query parametrizzate via SQLAlchemy
- **Protezione Path Traversal**: Percorsi file validati
- **Gestione Segreti**: Configurazione basata su variabili d'ambiente

---

## 🤝 Contribuire

Leggi [CONTRIBUTING.md](CONTRIBUTING.md) per le linee guida.

### Flusso di Lavoro Sviluppo

1. Crea un branch per la funzionalità
2. Apporta le modifiche e aggiungi test
3. Esegui la suite di test (`pytest`)
4. Esegui il commit delle modifiche
5. Apri una Pull Request

---

## 📄 Licenza

Questo progetto è concesso in licenza MIT - vedi il file [LICENSE](LICENSE) per i dettagli.

---

## 🙏 Ringraziamenti

- **Ollama** - Hosting LLM locale
- **Piper TTS** - Sintesi vocale di alta qualità
- **Faster Whisper** - Riconoscimento vocale efficiente
- **Model Context Protocol** - Framework integrazione strumenti
- **Qdrant** - Ricerca similarità vettoriale
- **Next.js** - Framework React
- **FastAPI** - Framework web Python moderno

---

**Costruito con ❤️ dal team YouWorker.AI**
