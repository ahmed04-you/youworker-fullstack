"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import { UI_LANGUAGE_OPTIONS, useChatSettings } from "@/lib/mode"

const EN_MESSAGES = {
  "chat.title": "YouWorker.AI",
  "chat.empty.title": "Start a conversation",
  "chat.empty.description": "Ask a question or ingest a document to begin working together.",
  "chat.status.analyzing": "Analyzing your request to craft the best answer…",
  "chat.actions.copy": "Copy message",
  "chat.actions.more": "More actions",
  "chat.actions.copied": "Message copied to clipboard",
  "chat.actions.regenerate": "Regenerate reply",
  "chat.actions.edit": "Edit message",
  "chat.actions.error.no_user": "Unable to regenerate because no user prompt was found.",
  "chat.actions.error.clipboard": "Copy failed. Please copy manually.",
  "chat.error.busy": "A response is already running. Please wait for it to finish.",
  "chat.error.streaming": "Unable to start streaming the response.",
  "chat.actions.editing": "Editing previous message…",
  "chat.actions.cancel_edit": "Cancel edit",
  "chat.message.user": "User message",
  "chat.message.assistant": "Assistant message",
  "chat.placeholder.examples": "Try asking for a summary, an email draft or an analysis.",
  "chat.actions.hold_to_talk": "Hold to talk",
  "chat.actions.release_to_stop": "Release to stop",
  "chat.actions.stop": "Stop",
  "chat.actions.send": "Send",
  "composer.placeholder": "Type your message or use voice input…",
  "composer.voice.recording": "Listening… release to stop",
  "composer.voice.waiting": "Wait for the current reply to finish",
  "composer.voice.ready": "Hold the mic button and speak",
  "composer.voice.playing": "Playing audio response…",
  "composer.voice.error": "Voice request failed. Please try again.",
  "composer.voice.unavailable": "Voice input is not available right now.",
  "composer.voice.start_error": "Unable to start recording. Please try again.",
  "composer.voice.stop_error": "Error while stopping the recording.",
  "composer.voice.no_audio": "No audio recorded. Please try again.",
  "composer.processing": "Processing your request…",
  "composer.audio.enabled": "Audio reply enabled",
  "composer.audio.disabled": "Text-only reply",
  "error.boundary.title": "Something went wrong",
  "error.boundary.description": "An unexpected error occurred. Try again or reload the page.",
  "error.boundary.retry": "Try again",
  "history.empty.sessions.title": "No conversations yet",
  "history.empty.sessions.description": "Your recent conversations will appear here once you start chatting.",
  "history.empty.documents.title": "No documents ingested",
  "history.empty.documents.description": "Upload a file or URL from the Ingest page and it will show up here.",
  "history.empty.ingestion.title": "No ingestion runs",
  "history.empty.ingestion.description": "Track the ingestion history of your files and web sources in this section.",
  "history.title": "History",
  "history.subtitle": "Manage conversations, documents, and ingestion runs",
  "history.button.back": "Back to chat",
  "history.button.refresh": "Refresh",
  "history.tabs.sessions": "Sessions",
  "history.tabs.documents": "Documents",
  "history.tabs.ingestion": "Ingestions",
  "history.sessions.count": "{{count}} conversations",
  "history.documents.count": "{{count}} documents",
  "history.ingestion.count": "{{count}} ingestion runs",
  "nav.chat": "Chat",
  "nav.history": "History",
  "nav.analytics": "Analytics",
  "nav.settings": "Settings",
  "nav.ingest": "Ingest",
  "nav.new_chat": "New chat",
  "nav.upload": "Upload file",
  "nav.api_status.online": "API Online",
  "nav.api_status.offline": "API Offline",
  "mobile.nav.chat": "Chat",
  "mobile.nav.ingest": "Ingest",
  "mobile.nav.history": "History",
  "mobile.nav.analytics": "Analytics",
  "mobile.nav.settings": "Settings",
  "settings.language.interface": "Interface language",
  "settings.language.assistant": "Assistant language",
  "settings.language.interface_description": "Select the language used for the interface and UI labels.",
  "settings.language.assistant_description": "Choose the default language for assistant replies.",
  "settings.language.placeholder": "Select language",
  "settings.quick_title": "Quick settings",
  "settings.quick_description": "Manage the interface and essential tools for your workspace.",
  "settings.workspace": "Workspace",
  "settings.workspace.theme": "Theme",
  "settings.workspace.theme_hint": "Switch between light, dark or system mode.",
  "settings.workspace.theme_note": "The selected theme is saved and applied to active sessions.",
  "settings.history": "History",
  "settings.history.description": "Review recent conversations and documents without leaving this view.",
  "settings.history.open": "Open history",
  "settings.accessibility": "Accessibility",
  "settings.accessibility.description": "Animations follow your system preferences automatically.",
  "toast.copied": "Copied to clipboard",
  "toast.regenerating": "Regenerating reply…",
  "history.toast.session_deleted": "Conversation deleted",
  "history.toast.document_deleted": "Document deleted",
  "history.toast.ingestion_deleted": "Ingestion run deleted",
  "history.toast.delete_failed": "Deletion failed",
  "history.error.load_sessions": "Unable to load sessions",
  "history.error.load_documents": "Unable to load documents",
  "history.error.load_ingestion": "Unable to load ingestion runs",
  "history.table.title": "Title",
  "history.table.model": "Model",
  "history.table.type": "Type",
  "history.table.type_web": "Web",
  "history.table.type_file": "File",
  "history.table.source": "Source",
  "history.table.ingested": "Ingested",
  "history.table.created": "Created",
  "history.table.updated": "Updated",
  "history.table.actions": "Actions",
  "history.table.status": "Status",
  "history.table.size": "Size",
  "history.table.tags": "Tags",
  "history.table.files": "Files",
  "history.table.chunks": "Chunks",
  "history.table.not_available": "N/A",
  "history.table.unknown": "Unknown",
  "history.table.untitled": "Untitled",
  "history.status.success": "Success",
  "history.status.partial": "Partial",
  "history.status.error": "Error",
  "history.action.delete": "Delete",
  "history.action.open": "Open",
  "history.dialog.delete_title": "Delete item",
  "history.dialog.delete_description": "This operation cannot be undone.",
  "history.dialog.delete_body": "Are you sure you want to delete \"{{name}}\"? This action cannot be undone.",
  "history.dialog.cancel": "Cancel",
  "history.dialog.confirm": "Delete",
  "common.close": "Close"
} as const

const IT_MESSAGES: typeof EN_MESSAGES = {
  "chat.title": "YouWorker.AI",
  "chat.empty.title": "Inizia una conversazione",
  "chat.empty.description": "Fai una domanda o ingerisci un documento per iniziare a lavorare insieme.",
  "chat.status.analyzing": "Sto analizzando le informazioni per offrirti la risposta migliore…",
  "chat.actions.copy": "Copia messaggio",
  "chat.actions.more": "Azioni disponibili",
  "chat.actions.copied": "Messaggio copiato negli appunti",
  "chat.actions.regenerate": "Rigenera risposta",
  "chat.actions.edit": "Modifica messaggio",
  "chat.actions.error.no_user": "Impossibile rigenerare: nessun messaggio utente trovato.",
  "chat.actions.error.clipboard": "Copia non riuscita. Copia manualmente il testo.",
  "chat.error.busy": "Una risposta è già in corso. Attendi il completamento.",
  "chat.error.streaming": "Impossibile avviare lo streaming della risposta.",
  "chat.actions.editing": "Modifica del messaggio in corso…",
  "chat.actions.cancel_edit": "Annulla modifica",
  "chat.message.user": "Messaggio utente",
  "chat.message.assistant": "Messaggio assistente",
  "chat.placeholder.examples": "Prova a chiedere un riassunto, una email o un'analisi.",
  "chat.actions.hold_to_talk": "Tieni premuto per parlare",
  "chat.actions.release_to_stop": "Rilascia per fermare",
  "chat.actions.stop": "Interrompi",
  "chat.actions.send": "Invia",
  "composer.placeholder": "Scrivi il tuo messaggio o usa il pulsante vocale…",
  "composer.voice.recording": "Ascolto... rilascia per fermare",
  "composer.voice.waiting": "Attendi il completamento della risposta",
  "composer.voice.ready": "Tieni premuto il pulsante microfono e parla",
  "composer.voice.playing": "Riproduzione risposta audio...",
  "composer.voice.error": "Richiesta vocale non riuscita. Riprova.",
  "composer.voice.unavailable": "Input vocale non disponibile",
  "composer.voice.start_error": "Impossibile avviare la registrazione. Riprova.",
  "composer.voice.stop_error": "Errore durante la chiusura della registrazione.",
  "composer.voice.no_audio": "Nessun audio registrato. Riprova.",
  "composer.processing": "Elaborazione della richiesta...",
  "composer.audio.enabled": "Risposta con audio",
  "composer.audio.disabled": "Risposta solo testo",
  "error.boundary.title": "Qualcosa è andato storto",
  "error.boundary.description": "Si è verificato un errore imprevisto. Riprova o ricarica la pagina.",
  "error.boundary.retry": "Riprova",
  "history.empty.sessions.title": "Ancora nessuna conversazione",
  "history.empty.sessions.description": "Le conversazioni recenti appariranno qui appena inizi a chattare.",
  "history.empty.documents.title": "Nessun documento ingerito",
  "history.empty.documents.description": "Carica un file o un URL dalla pagina Ingest per vederlo in questo elenco.",
  "history.empty.ingestion.title": "Nessuna ingestione registrata",
  "history.empty.ingestion.description": "Tieni traccia qui delle operazioni di ingestione dei tuoi file e delle fonti web.",
  "history.title": "Cronologia",
  "history.subtitle": "Gestisci conversazioni, documenti e operazioni di ingestione",
  "history.button.back": "Torna alla chat",
  "history.button.refresh": "Aggiorna",
  "history.tabs.sessions": "Sessioni",
  "history.tabs.documents": "Documenti",
  "history.tabs.ingestion": "Ingestioni",
  "history.sessions.count": "{{count}} sessioni",
  "history.documents.count": "{{count}} documenti",
  "history.ingestion.count": "{{count}} ingestion registrate",
  "nav.chat": "Chat",
  "nav.history": "Cronologia",
  "nav.analytics": "Analisi",
  "nav.settings": "Impostazioni",
  "nav.ingest": "Ingest",
  "nav.new_chat": "Nuova chat",
  "nav.upload": "Carica file",
  "nav.api_status.online": "API Online",
  "nav.api_status.offline": "API Offline",
  "mobile.nav.chat": "Chat",
  "mobile.nav.ingest": "Ingest",
  "mobile.nav.history": "Cronologia",
  "mobile.nav.analytics": "Analisi",
  "mobile.nav.settings": "Impostazioni",
  "settings.language.interface": "Lingua interfaccia",
  "settings.language.assistant": "Lingua assistente",
  "settings.language.interface_description": "Seleziona la lingua usata per l'interfaccia e le etichette.",
  "settings.language.assistant_description": "Scegli la lingua predefinita delle risposte generate.",
  "settings.language.placeholder": "Seleziona lingua",
  "settings.quick_title": "Impostazioni rapide",
  "settings.quick_description": "Gestisci interfaccia e strumenti essenziali della workspace.",
  "settings.workspace": "Workspace",
  "settings.workspace.theme": "Tema",
  "settings.workspace.theme_hint": "Passa rapidamente tra modalità chiara, scura o automatica.",
  "settings.workspace.theme_note": "Il tema selezionato viene salvato e applicato a tutte le sessioni attive.",
  "settings.history": "Cronologia",
  "settings.history.description": "Consulta conversazioni e documenti inviati di recente senza lasciare questa finestra.",
  "settings.history.open": "Apri cronologia",
  "settings.accessibility": "Accessibilità",
  "settings.accessibility.description": "Adattiamo automaticamente animazioni e riduzione del movimento alle preferenze di sistema.",
  "toast.copied": "Copiato negli appunti",
  "toast.regenerating": "Rigenerazione in corso…",
  "history.toast.session_deleted": "Sessione eliminata",
  "history.toast.document_deleted": "Documento eliminato",
  "history.toast.ingestion_deleted": "Ingestione eliminata",
  "history.toast.delete_failed": "Eliminazione non riuscita",
  "history.error.load_sessions": "Impossibile caricare le sessioni",
  "history.error.load_documents": "Impossibile caricare i documenti",
  "history.error.load_ingestion": "Impossibile caricare le operazioni di ingestione",
  "history.table.title": "Titolo",
  "history.table.model": "Modello",
  "history.table.type": "Tipo",
  "history.table.type_web": "Web",
  "history.table.type_file": "File",
  "history.table.source": "Sorgente",
  "history.table.ingested": "Data ingestione",
  "history.table.created": "Creata",
  "history.table.updated": "Aggiornata",
  "history.table.actions": "Azioni",
  "history.table.status": "Stato",
  "history.table.size": "Dimensione",
  "history.table.tags": "Tag",
  "history.table.files": "File",
  "history.table.chunks": "Chunk",
  "history.table.not_available": "N/D",
  "history.table.unknown": "Sconosciuto",
  "history.table.untitled": "Senza titolo",
  "history.status.success": "Successo",
  "history.status.partial": "Parziale",
  "history.status.error": "Errore",
  "history.action.delete": "Elimina",
  "history.action.open": "Apri",
  "history.dialog.delete_title": "Elimina elemento",
  "history.dialog.delete_description": "Questa operazione non può essere annullata.",
  "history.dialog.delete_body": "Sei sicuro di voler eliminare \"{{name}}\"? Questa azione è irreversibile.",
  "history.dialog.cancel": "Annulla",
  "history.dialog.confirm": "Elimina",
  "common.close": "Chiudi"
}

const TRANSLATIONS = {
  en: EN_MESSAGES,
  it: IT_MESSAGES,
} as const

type SupportedLanguage = keyof typeof TRANSLATIONS
type TranslationKey = keyof typeof EN_MESSAGES

interface I18nContextValue {
  language: SupportedLanguage
  setLanguage: (language: SupportedLanguage) => void
  t: (key: TranslationKey, params?: Record<string, string | number>, fallback?: string) => string
  availableLanguages: typeof UI_LANGUAGE_OPTIONS
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function formatMessage(template: string, params?: Record<string, string | number>) {
  if (!params) return template
  return template.replace(/\{\{(.*?)\}\}/g, (_, token: string) => {
    const value = params[token.trim()]
    return value === undefined ? `{{${token}}}` : String(value)
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { uiLanguage, setUiLanguage } = useChatSettings()

  const value = useMemo<I18nContextValue>(() => {
    const lang: SupportedLanguage = (uiLanguage as SupportedLanguage) in TRANSLATIONS ? (uiLanguage as SupportedLanguage) : "en"

    const translate = (key: TranslationKey, params?: Record<string, string | number>, fallback?: string) => {
      const message = TRANSLATIONS[lang][key] ?? TRANSLATIONS.en[key] ?? fallback ?? key
      return formatMessage(message, params)
    }

    return {
      language: lang,
      setLanguage: (next) => setUiLanguage(next),
      t: translate,
      availableLanguages: UI_LANGUAGE_OPTIONS,
    }
  }, [uiLanguage, setUiLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return ctx
}

export type { TranslationKey }
