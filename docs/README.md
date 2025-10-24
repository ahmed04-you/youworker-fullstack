# YouWorker.AI v0.1.0-alpha

**Assistente conversazionale AI con interazione vocale e testuale, ricerca semantica e integrazione estensibile di strumenti.**

> **Nota**: Questo progetto è attualmente in fase di sviluppo attivo (versione alpha). La prima release stabile non è ancora disponibile.

YouWorker.AI è una piattaforma AI in sviluppo che combina tecnologie web moderne con modelli linguistici locali per fornire un'esperienza conversazionale potente, sicura e orientata alla privacy. L'architettura basata su Next.js, FastAPI e Model Context Protocol (MCP) offre un'integrazione senza soluzione di continuità tra interfaccia utente moderna e capacità AI avanzate.

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

## 🚀 Inizia Subito

### Primo Avvio (5 minuti)

Il modo più semplice per iniziare con YouWorker.AI:

```bash
# Clona e avvia tutto automaticamente
git clone <url-repository>
cd youworker-fullstack
make setup-full
```

Questo comando:
- ✅ Configura l'ambiente automaticamente
- ✅ Genera certificati SSL sicuri
- ✅ Avvia tutti i servizi necessari
- ✅ Scarica i modelli AI richiesti

### Accesso Immediato

Una volta avviato, accedi a:

🌐 **Applicazione**: https://95.110.228.79:8000
📚 **Guida Utente**: [docs/GUIDA_UTENTE.md](GUIDA_UTENTE.md)
🔧 **Documentazione API**: https://95.110.228.79:8001/docs

> **Nota**: L'applicazione è accessibile pubblicamente all'indirizzo https://95.110.228.79:8000

### Cosa Aspettarsi

- **⏱️ 2-3 minuti**: Avvio servizi base
- **⏱️ 5-10 minuti**: Download modelli AI (solo al primo avvio)
- **🎯 Pronto all'uso**: Interfaccia intuitiva pronta per le tue domande

### Requisiti Minimi

- **Docker** e **Docker Compose** (per installazione automatica)
- **4GB RAM** (8GB consigliati per performance ottimali)
- **Spazio disco**: 10GB per modelli AI e dati
- **GPU NVIDIA** (opzionale, per risposte più veloci)

---

## 💡 La Tua Prima Conversazione

### Modalità Testo - Ideale per Iniziare

1. **Apri** https://localhost:8000 nel tuo browser
2. **Clicca** sul pulsante "Testo" in alto
3. **Scrivi** la tua prima domanda, ad esempio:
   - "Cosa puoi fare per me?"
   - "Aiutami a organizzare la mia giornata"
   - "Splica l'intelligenza artificiale in modo semplice"
4. **Invia** e osserva la risposta apparire in tempo reale

### Modalità Voce - Conversazioni Naturali

1. **Clicca** sul pulsante "Voce" in alto
2. **Tieni premuto** il grande pulsante del microfono
3. **Parla** naturalmente in italiano
4. **Rilascia** e ascolta la risposta vocale

### Cosa Puoi Chiedere

🔍 **Informazioni**: "Qual è l'ultima notizia sul cambiamento climatico?"
📊 **Analisi**: "Analizza questo documento PDF" (caricandolo)
🗓️ **Organizzazione**: "Aiutami a pianificare una riunione per domani"
🌐 **Ricerca**: "Trova informazioni sulle migliori pratiche di sviluppo software"
📝 **Creazione**: "Scrivi una email professionale per richiedere un appuntamento"

---

## 🛠️ Personalizzazione e Configurazione

---

## 🎯 Guida Rapida Utente

### Interfaccia Intuitiva

YouWorker.AI è progettato per essere immediato:

- **🎨 Design pulito**: Nessuna complicazione, solo conversazioni naturali
- **📱 Perfetto su ogni dispositivo**: Computer, tablet o smartphone
- **🔄 Risposte in tempo reale**: Vedi l'AI pensare e rispondere istantaneamente

### Due Modalità, Infinite Possibilità

#### 📝 **Modalità Testo**
- Ideata per conversazioni dettagliate e complesse
- Perfetta per lunghe analisi e documentazione
- Supporta copia/incolla e file allegati

#### 🎙️ **Modalità Voce**
- Conversazioni naturali come con un assistente reale
- Riconoscimento vocale italiano di alta precisione
- Risposte vocali naturali e chiare

### Consigli per Iniziare

1. **Sii specifico**: Invece di "parlami di marketing", prova "come creare una campagna marketing per un prodotto locale"
2. **Usa il contesto**: Fai domande di follow-up basate sulle risposte precedenti
3. **Sperimenta**: Prova domande creative, analisi documenti, ricerche web

---

## ⚙️ Configurazione Avanzata

### Personalizzazione Base

La configurazione di base funziona subito, ma puoi personalizzare:

| Impostazione | A Cosa Serve | Valore Consigliato |
|--------------|--------------|-------------------|
| `CHAT_MODEL` | Intelligenza dell'AI | `gpt-oss:20b` |
| `ROOT_API_KEY` | Sicurezza accessi | Genera una chiave unica |
| `JWT_SECRET` | Firma dei token JWT | Imposta un segreto distinto |
| `TTS_VOICE` | Tipo di voce vocale | `it_IT-paola-medium` |

### Configurazione Vocale Avanzata

| Impostazione | Descrizione | Default |
|-----------|-------------|---------|
| `STT_MODEL` | Precisione riconoscimento vocale | `small` |
| `STT_LANGUAGE` | Lingua di riconoscimento | `it` |
| `TTS_PROVIDER` | Motore sintesi vocale | `piper` |

### Configurazione Sicurezza

| Variabile | Scopo | Raccomandazione |
|-----------|-------|-----------------|
| `ROOT_API_KEY` | Chiave master | Usa una chiave forte in produzione |
| `JWT_SECRET` | Firma dei token JWT | Mantieni un valore diverso dal ROOT_API_KEY |
| `FRONTEND_ORIGIN` | Domini permessi | Limita ai tuoi domini |
| `NEXT_PUBLIC_API_KEY` | Chiave frontend | Uguale a ROOT_API_KEY |

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
