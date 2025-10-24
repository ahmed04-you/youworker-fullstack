# YouWorker.AI v0.1.0-alpha

**Assistente conversazionale AI con interazione vocale e testuale, ricerca semantica e integrazione estensibile di strumenti.**

> **Nota**: Questo progetto è attualmente in fase di sviluppo attivo (versione alpha). La prima release stabile non è ancora disponibile.

YouWorker.AI è un'applicazione full-stack in sviluppo che combina tecnologie web moderne con modelli AI locali per offrire un'esperienza conversazionale potente e orientata alla privacy. Costruito con Next.js, FastAPI e il Model Context Protocol (MCP).

## 📚 Documentazione

Per informazioni dettagliate sull'utilizzo e lo sviluppo del progetto, consulta la documentazione completa nella cartella [`docs/`](docs/):

- **[Guida Utente](docs/guida-utente.md)** - Istruzioni complete per l'utilizzo dell'applicazione
- **[Guida per Sviluppatori](docs/guida-sviluppatori.md)** - Documentazione tecnica per contribuire al progetto
- **[Documentazione Tecnica](docs/tecnica.md)** - Architettura dettagliata del sistema
- **[README Documentazione](docs/README.md)** - Indice completo della documentazione

> Le impostazioni condivise dell'API e dei processi di ingestione vengono ora definite una sola volta in `packages/common/settings.py` ed esposte dall'API tramite `apps/api/config.py`.

## ✨ Caratteristiche Principali

### 🎙️ **Doppia Modalità di Interazione**
- **Modalità Testo**: Risposte in streaming real-time con Server-Sent Events
- **Streaming SSE ottimizzato**: flush iniziale ridotto e heartbeat periodici per connessioni stabili a bassa banda
- **Modalità Voce**: Input vocale push-to-talk con riconoscimento e sintesi vocale italiana

### 🤖 **Sistema Agente Intelligente**
- Alimentato da modelli Ollama locali (privacy-first, nessuna API esterna)
- Selezione modello per richiesta, sicura in presenza di più sessioni concorrenti
- Scoperta dinamica degli strumenti via Model Context Protocol (MCP)
- Architettura single-tool stepper per comportamento affidabile e prevedibile
- Risposte in streaming con feedback sull'esecuzione degli strumenti
- Lingua dell'assistente configurabile (italiano o inglese) direttamente dalle impostazioni

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
   ./scripts/download-piper-models.sh
   ```

4. **Avvia tutti i servizi**:
   ```bash
   make compose-up
   ```

   > ℹ️ L'API verifica automaticamente la presenza dei modelli Ollama richiesti (`CHAT_MODEL`, `EMBED_MODEL`).
   > Se mancano e `OLLAMA_AUTO_PULL=1`, verranno scaricati al primo avvio (il download può essere molto lungo).
   > Imposta `OLLAMA_AUTO_PULL=0` per gestire manualmente `ollama pull`.

5. **Accedi all'applicazione**:
   - **Frontend**: http://localhost:8000
   - **API**: http://localhost:8001
   - **Documentazione API**: http://localhost:8001/docs
   - **Analytics Dashboard**: http://localhost:8000/analytics
   - **Grafana** (opzionale): http://localhost:3001 (user: `admin`, password: `admin`)
   - Tutti i container sono eseguiti come utenti non-root e le immagini Docker sono versionate con tag stabili

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

## 📖 Guida all'Uso

Per istruzioni dettagliate sull'utilizzo dell'applicazione, consulta la **[Guida Utente](docs/guida-utente.md)**.

### Modalità Chat Testuale

1. Clicca il pulsante **"Testo"** nell'intestazione
2. Digita il tuo messaggio nel compositore
3. Premi Invio o clicca Invia
4. Osserva le risposte in streaming real-time e le esecuzioni degli strumenti

### Modalità Voce

1. Clicca il pulsante **"Voce"** nell'intestazione
2. **Tieni premuto** il pulsante microfono e parla
3. **Rilascia** quando hai finito di parlare
4. Ascolta la risposta vocale dell'AI

### Ingestione Documenti

1. Naviga alla pagina **Ingest**
2. Carica file o fornisci URL
3. Seleziona il tipo di documento (auto-rilevato per i file)
4. Clicca "Ingest" per elaborare

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

Per istruzioni dettagliate sullo sviluppo del progetto, consulta la **[Guida per Sviluppatori](docs/guida-sviluppatori.md)**.

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
