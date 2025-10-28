export type Language = "en" | "it";

interface TranslationTree {
  [key: string]: string | TranslationTree;
}

export const translations: Record<Language, TranslationTree> = {
  en: {
    common: {
      brand: "YouWorker.AI",
    },
    sidebar: {
      title: "YouWorker.AI",
      links: {
        chat: "Chat",
        documents: "Documents",
        sessions: "Sessions",
        analytics: "Analytics",
        settings: "Settings",
      },
      logout: "Logout",
    },
    theme: {
      aria: "Toggle theme",
      system: "System",
      light: "Light",
      dark: "Dark",
    },
    language: {
      title: "Language",
      description: "Choose the interface language for menus and settings.",
      english: "English",
      italian: "Italian",
      aria: "Switch language",
    },
    login: {
      title: "Authentication Required",
      description:
        "YouWorker normally signs you in automatically via Authentik. If this dialog appears, supply a valid API key to continue.",
      apiKeyLabel: "API Key",
      apiKeyPlaceholder: "Enter your API key",
      submit: "Login",
      submitting: "Authenticating...",
      errorFallback: "Login failed",
      footer:
        "Sessions are secured with HttpOnly cookies. Authentik-managed API keys never touch the client.",
    },
    settings: {
      hero: {
        eyebrow: "Control center",
        heading: "Personalize your YouWorker experience",
        description:
          "Manage authentication, learn how sessions are protected, and surface quick links for everyday workflows. Cream-forward visuals keep the experience calm, even when YouWorker is in crimson acceleration.",
        status: {
          loading: "Checking status…",
          authenticated: "Authenticated",
          guest: "Guest mode",
        },
        statusMessage: {
          authenticated: "Signed in as {username}.",
          guest: "Log in with your API key to unlock the full workspace.",
        },
      },
      authentication: {
        title: "Authentication",
        description: "Cookie-based access to every backend capability.",
        card: {
          statusBody:
            "YouWorker uses secure, HTTP-only cookies issued by the backend. Tokens refresh automatically so you stay connected during longer analysis sessions.",
          sessionCookiesTitle: "Session cookies",
          sessionCookiesBody:
            "JWT tokens are stored in HttpOnly cookies. Client-side code never sees raw keys.",
          continuousRefreshTitle: "Continuous refresh",
          continuousRefreshBody:
            "Tokens refresh a minute before expiry so long-running chats and analytics stay authorized.",
          logoutButton: "Sign out",
          logoutWorking: "Signing out…",
          logoutSuccess: "Signed out successfully.",
          logoutError: "Logout failed. Please retry.",
          unauthenticatedMessage:
            "Open the login dialog to authenticate with your API key. The form appears automatically when you’re not authenticated.",
        },
      },
      preferences: {
        title: "Workspace Preferences",
        description:
          "Tune environment defaults so the agent behaves exactly how your team expects.",
        theme: {
          title: "Theme adaptation",
          description: "Switch between light, dark, or system theme from here.",
        },
        language: {
          title: "Language preferences",
          description:
            "Pick your preferred language for system copy. Content remains in its original language.",
        },
        voice: {
          title: "Voice-ready UI",
          description:
            "Microphone controls live in the chat composer whenever you need push-to-talk.",
        },
        analytics: {
          title: "Analytics clarity",
          description:
            "Dashboards adopt cream + crimson, adapting to theme for easier scanning.",
        },
        sessions: {
          title: "Session insights",
          description:
            "Every conversation is stored with the originating model, tool usage, and timestamps.",
        },
      },
    },
  },
  it: {
    common: {
      brand: "YouWorker.AI",
    },
    sidebar: {
      title: "YouWorker.AI",
      links: {
        chat: "Chat",
        documents: "Documenti",
        sessions: "Sessioni",
        analytics: "Analisi",
        settings: "Impostazioni",
      },
      logout: "Esci",
    },
    theme: {
      aria: "Cambia tema",
      system: "Sistema",
      light: "Chiaro",
      dark: "Scuro",
    },
    language: {
      title: "Lingua",
      description: "Scegli la lingua dell'interfaccia per menu e impostazioni.",
      english: "Inglese",
      italian: "Italiano",
      aria: "Cambia lingua",
    },
    login: {
      title: "Autenticazione richiesta",
      description:
        "Di norma YouWorker ti riconosce automaticamente tramite Authentik. Se appare questa finestra, inserisci una API key valida per continuare.",
      apiKeyLabel: "API Key",
      apiKeyPlaceholder: "Inserisci la tua API key",
      submit: "Accedi",
      submitting: "Autenticazione in corso...",
      errorFallback: "Accesso non riuscito",
      footer:
        "Le sessioni sono protette con cookie HttpOnly. Le API key gestite da Authentik non arrivano mai al client.",
    },
    settings: {
      hero: {
        eyebrow: "Centro di controllo",
        heading: "Personalizza l'esperienza YouWorker",
        description:
          "Gestisci l'autenticazione, scopri come vengono protette le sessioni e attiva scorciatoie per i flussi di lavoro quotidiani. Una palette calma mantiene l'esperienza serena anche quando YouWorker accelera.",
        status: {
          loading: "Verifica dello stato…",
          authenticated: "Autenticato",
          guest: "Modalità ospite",
        },
        statusMessage: {
          authenticated: "Accesso effettuato come {username}.",
          guest: "Accedi con la tua API key per sbloccare l'intero workspace.",
        },
      },
      authentication: {
        title: "Autenticazione",
        description: "Accesso a tutte le funzionalità backend basato su cookie.",
        card: {
          statusBody:
            "YouWorker utilizza cookie sicuri e HTTP-only emessi dal backend. I token si aggiornano automaticamente per mantenerti connesso durante le sessioni più lunghe.",
          sessionCookiesTitle: "Cookie di sessione",
          sessionCookiesBody:
            "I token JWT sono conservati in cookie HttpOnly. Il codice client non vede mai le chiavi raw.",
          continuousRefreshTitle: "Aggiornamento continuo",
          continuousRefreshBody:
            "I token si rinnovano un minuto prima della scadenza così chat e analisi restano autorizzate.",
          logoutButton: "Esci",
          logoutWorking: "Uscita in corso…",
          logoutSuccess: "Disconnessione completata.",
          logoutError: "Disconnessione non riuscita. Riprova.",
          unauthenticatedMessage:
            "Apri la finestra di login per autenticarti con la tua API key. Il form appare automaticamente quando non sei autenticato.",
        },
      },
      preferences: {
        title: "Preferenze workspace",
        description:
          "Adatta i valori predefiniti così l'agente si comporta come il tuo team si aspetta.",
        theme: {
          title: "Adattamento tema",
          description:
            "Passa tra tema chiaro, scuro o sistema direttamente da qui.",
        },
        language: {
          title: "Preferenze lingua",
          description:
            "Imposta la lingua dell'interfaccia. I contenuti restano nella loro lingua originale.",
        },
        voice: {
          title: "Interfaccia pronta per la voce",
          description:
            "I controlli del microfono sono sempre nel composer della chat per il push-to-talk.",
        },
        analytics: {
          title: "Analisi leggibili",
          description:
            "Le dashboard usano crema e cremisi adattandosi al tema per facilitare la lettura.",
        },
        sessions: {
          title: "Insight sulle sessioni",
          description:
            "Ogni conversazione conserva modello di origine, strumenti utilizzati e timestamp.",
        },
      },
    },
  },
} as const;
