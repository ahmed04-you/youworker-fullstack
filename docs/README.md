# Documentazione YouWorker.AI

Benvenuto nella documentazione di YouWorker.AI, un assistente conversazionale AI con interazione vocale e testuale, ricerca semantica e integrazione estensibile di strumenti.

## Documenti Disponibili

### 📖 [Guida Utente](guida-utente.md)
Guida completa per l'utilizzo dell'applicazione YouWorker.AI. Include:
- Accesso e autenticazione
- Modalità di interazione (testuale e vocale)
- Gestione documenti e ricerca semantica
- Sessioni di chat e analytics
- Risoluzione problemi e best practices

**Destinata a**: Utenti finali dell'applicazione

### 🔧 [Guida per Sviluppatori](guida-sviluppatori.md)
Documentazione tecnica per sviluppatori che vogliono contribuire o estendere il progetto. Include:
- Setup ambiente di sviluppo
- Architettura dettagliata
- Sviluppo di nuove funzionalità
- Testing e debugging
- Deployment e best practices

**Destinata a**: Sviluppatori software e contributori

### 🏗️ [Documentazione Tecnica](tecnica.md)
Panoramica dell'architettura e dei componenti tecnici del sistema. Include:
- Architettura backend e frontend
- Sistema agent e MCP registry
- Integrazioni esterne (Ollama, Qdrant)
- Gestione documenti e pipeline audio
- Sicurezza e performance

**Destinata a**: Architetti software e tecnici

## Panoramica del Progetto

YouWorker.AI è un'applicazione full-stack che combina:

### 🎙️ **Doppia Modalità di Interazione**
- **Modalità Testo**: Risposte in streaming real-time con Server-Sent Events
- **Modalità Voce**: Input vocale push-to-talk con riconoscimento e sintesi vocale italiana

### 🤖 **Sistema Agente Intelligente**
- Alimentato da modelli Ollama locali (privacy-first)
- Scoperta dinamica degli strumenti via Model Context Protocol (MCP)
- Architettura single-tool stepper per comportamento affidabile
- Lingua configurabile (italiano/inglese)

### 📚 **Gestione della Conoscenza**
- Ingestione documenti da file e URL
- Ricerca semantica con embedding vettoriali
- Supporto per PDF, file di testo e contenuti web
- Database vettoriale Qdrant per ricerca rapida

### 🛠️ **Sistema Strumenti Estensibile**
- **Ricerca Web**: Recupero e riassunto contenuti web
- **Query Semantica**: Recupero documenti RAG-powered
- **Data e Ora**: Operazioni calendario con timezone
- **Conversione Unità**: Calcoli quantità fisiche
- **Strumenti Personalizzati**: Facile integrazione via MCP

## Stack Tecnologico

### Backend
- **Framework**: FastAPI con supporto asincrono
- **Database**: PostgreSQL per dati persistenti
- **Vector Store**: Qdrant per ricerca semantica
- **LLM**: Ollama per modelli linguistici locali
- **Audio**: Faster Whisper (STT) e Piper TTS

### Frontend
- **Framework**: Next.js 15 con React 19
- **Styling**: Tailwind CSS con componenti Radix UI
- **State Management**: Context API
- **Audio**: Web Audio API

### Infrastruttura
- **Containerizzazione**: Docker e Docker Compose
- **Monitoring**: Prometheus e Grafana
- **Protocol**: Model Context Protocol (MCP) per strumenti

## Avvio Rapido

### Prerequisiti
- Docker e Docker Compose
- GPU NVIDIA (opzionale, per modelli accelerati)

### Installazione
```bash
# Clona repository
git clone <repository-url>
cd youworker-fullstack

# Configura ambiente
cp .env.example .env

# Avvia tutti i servizi
make compose-up
```

### Accesso
- **Frontend**: http://localhost:8000
- **API**: http://localhost:8001
- **Documentazione API**: http://localhost:8001/docs
- **Analytics Dashboard**: http://localhost:8000/analytics

## Supporto e Contributi

### Segnalazione Problemi
- Apri una issue su GitHub per bug report
- Usa le discussioni per domande generali

### Contributi
- Segui la guida per sviluppatori
- Crea pull request con description dettagliata
- Rispetta le code style guidelines

### Licenza
Questo progetto è rilasciato sotto licenza privata. Vedi file LICENSE per dettagli.

---

**Costruito con ❤️ dal team YouWorker.AI**