# Guida Utente - YouWorker.AI

## Introduzione

YouWorker.AI è un assistente conversazionale AI che supporta interazioni testuali e vocali, con capacità di ricerca semantica e integrazione con strumenti esterni. Questa guida ti aiuterà a utilizzare al meglio tutte le funzionalità del sistema.

## Accesso all'Applicazione

### Avvio
1. Assicurati che tutti i servizi siano attivi (vedi Guida Sviluppatori)
2. Apri il browser e naviga a `http://localhost:8000`
3. L'applicazione si caricherà con l'interfaccia principale

### Autenticazione
- Per l'uso locale, l'applicazione si autentica automaticamente
- In produzione, potrebbe essere richiesta una chiave API

## Modalità di Interazione

YouWorker.AI offre due modalità principali di interazione:

### Modalità Testo
La modalità testuale permette conversazioni fluide con risposte in tempo reale.

**Come utilizzare:**
1. Clicca sul pulsante **"Testo"** nell'intestazione
2. Digita il tuo messaggio nell'area di composizione
3. Premi Invio o clicca sul pulsante di invio
4. Visualizza le risposte mentre vengono generate in streaming

**Funzionalità disponibili:**
- Risposte in streaming real-time
- Esecuzione automatica strumenti quando necessario
- Contesto conversazionale mantenuto
- Opzione per riproduzione audio delle risposte

### Modalità Voce
La modalità vocale offre un'interazione naturale tramite input vocale e risposte audio.

**Come utilizzare:**
1. Clicca sul pulsante **"Voce"** nell'intestazione
2. Tieni premuto il pulsante del microfono mentre parli
3. Rilascia il pulsante quando hai finito di parlare
4. Ascolta la trascrizione e la risposta vocale dell'AI

**Funzionalità disponibili:**
- Trascrizione automatica dell'italiano
- Visualizzazione del livello audio in tempo reale
- Risposte vocali naturali con sintesi italiana
- Indicatore di confidenza della trascrizione

## Funzionalità Principali

### Conversazioni Contestuali
YouWorker.AI mantiene il contesto della conversazione:
- Ricorda i messaggi precedenti nella stessa sessione
- Fa riferimento a informazioni condivise in precedenza
- Fornisce risposte coerenti basate sulla cronologia

### Esecuzione Strumenti
L'assistente può utilizzare automaticamente vari strumenti:
- **Ricerca Web**: Trova informazioni aggiornate online
- **Query Semantica**: Cerca nei documenti ingeriti
- **Data e Ora**: Operazioni con fusi orari
- **Conversione Unità**: Calcoli tra diverse unità di misura

Quando uno strumento viene utilizzato, vedrai un'indicazione nella risposta con il risultato dell'operazione.

### Lingua delle Risposte
Puoi configurare la lingua delle risposte dell'assistente:
1. Clicca sull'icona delle impostazioni (⚙️)
2. Seleziona "Italiano" o "Inglese" per le risposte
3. L'assistente risponderà nella lingua selezionata

## Gestione Documenti

### Ingestione Documenti
Puoi arricchire la conoscenza dell'AI ingerendo documenti:

**Formati supportati:**
- Documenti PDF
- File di testo (.txt)
- Pagine web (tramite URL)

**Come ingerire documenti:**
1. Naviga alla pagina **Ingest** dal menu laterale
2. Carica file o fornisci URL di pagine web
3. Seleziona il tipo di documento (auto-rilevato per i file)
4. Aggiungi tag opzionali per organizzazione
5. Clicca "Ingest" per elaborare

Una volta ingeriti, i documenti saranno disponibili per la ricerca semantica durante le conversazioni.

### Ricerca nei Documenti
Durante una conversazione, puoi chiedere all'assistente di cercare informazioni nei documenti ingeriti:
- "Cerca informazioni su [argomento] nei documenti"
- "Trova documenti che parlano di [argomento]"
- "Riassumi i documenti su [argomento]"

## Sessioni di Chat

### Gestione Sessioni
Le tue conversazioni sono organizzate in sessioni:
- Ogni conversazione crea una nuova sessione
- Puoi continuare conversazioni esistenti
- Le sessioni mantengono la cronologia completa

### Visualizzazione Sessioni
1. Clicca sull'icona della cronologia (📋) nel menu laterale
2. Visualizza l'elenco delle sessioni precedenti
3. Clicca su una sessione per riprenderla
4. Usa il menu contestuale per rinominare o eliminare sessioni

## Analytics e Monitoraggio

### Dashboard Analytics
Puoi visualizzare statistiche sull'utilizzo:
1. Clicca sull'icona Analytics (📊) nella barra laterale
2. Esplora le diverse visualizzazioni disponibili:
   - Utilizzo token nel tempo
   - Performance strumenti
   - Statistiche ingestione documenti
   - Attività sessioni

### Metriche Disponibili
- Token di input/output utilizzati
- Success rate degli strumenti
- Latenza di esecuzione
- Numero di documenti ingeriti
- Sessioni attive

## Risoluzione Problemi

### Problemi Comuni

**La modalità voce non funziona:**
- Verifica di aver concesso i permessi al microfono
- Assicurati di usare HTTPS o localhost
- Controlla che il microfono sia collegato e funzionante

**Le risposte sono lente:**
- Controlla lo stato dei servizi backend
- Verifica il carico sulla macchina
- Prova a ridurre la complessità della richiesta

**La ricerca nei documenti non trova risultati:**
- Verifica che i documenti siano stati ingeriti correttamente
- Controlla di usare termini di ricerca appropriati
- Prova con parole chiave diverse

### Feedback e Supporto
Per problemi o suggerimenti:
- Controlla i log del browser per errori
- Verifica lo stato dei servizi nella dashboard di health
- Riavvia i servizi se necessario

## Best Practices

### Per Ottenere Risposte Migliori
- Sii specifico nelle tue richieste
- Fornisci contesto quando necessario
- Usa la modalità voce per domande complesse
- Sfrutta la ricerca semantica per informazioni specifiche

### Per Gestire Documenti
- Usa tag descrittivi per organizzare i documenti
- Ingesta documenti di qualità e pertinenti
- Evita documenti troppo lunghi o complessi
- Aggiorna regolarmente i documenti obsoleti

### Per Sessioni Efficaci
- Usa sessioni separate per argomenti diversi
- Rinomina le sessioni per identificarle facilmente
- Elimina sessioni non più necessarie
- Sfrutta il contesto conversazionale

## Privacy e Sicurezza

### Dati Personali
- I dati delle conversazioni sono memorizzati localmente
- Nessuna API esterna viene contattata per le conversazioni
- I documenti ingeriti rimangono nel sistema locale

### Sicurezza
- Le comunicazioni sono crittografate
- L'accesso è controllato tramite chiavi API
- I dati utente sono isolati tra loro