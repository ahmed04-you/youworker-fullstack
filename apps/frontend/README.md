# YouWorker.AI Frontend

A modern, beautiful Next.js 16 frontend for YouWorker.AI - an intelligent AI assistant powered by local LLMs.

## Features

- 🎨 **Modern UI/UX** with Tailwind CSS and shadcn/ui components
- 💬 **Real-time Chat** using WebSockets and ChatKit SDK
- 🎤 **Voice Input** with waveform visualization
- 📊 **Analytics Dashboard** with interactive charts
- 📚 **Document Ingestion** with drag-and-drop upload
- 📜 **Chat History** with search and filters
- 🌓 **Dark/Light Mode** with system preference support
- 📱 **Responsive Design** for mobile, tablet, and desktop
- ♿ **Accessibility** with ARIA labels and keyboard navigation
- 🔔 **Real-time Notifications** using Sonner

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui, Radix UI, ChatKit
- **State Management**: Zustand
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Theme**: next-themes

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Running backend API (see `apps/api/`)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local .env.local
# Edit .env.local with your API URLs

# Run development server
npm run dev
```

### Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001/ws
NEXT_PUBLIC_APP_NAME=YouWorker.AI
```

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
apps/frontend/
├── app/                    # Next.js App Router pages
│   ├── chat/              # Main chat interface
│   ├── history/           # Chat session history
│   ├── analytics/         # Analytics dashboard
│   ├── ingest/            # Document ingestion
│   ├── settings/          # User settings
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   ├── sidebar.tsx       # Navigation sidebar
│   └── header.tsx        # Top header bar
├── lib/                  # Utility functions and clients
│   ├── api-client.ts     # REST API client
│   ├── websocket-client.ts # WebSocket client
│   └── utils.ts          # Helper functions
└── public/               # Static assets
```

## Features in Detail

### Chat Interface
- Real-time streaming responses
- Message history persistence
- Tool execution visualization
- Voice input/output support
- Markdown rendering
- Code syntax highlighting

### Analytics Dashboard
- Session statistics
- Token usage tracking
- Tool usage metrics
- Interactive charts and graphs
- Date range filtering

### Document Ingestion
- Drag-and-drop file upload
- Multiple file format support (PDF, text, audio, web)
- Progress tracking
- Collection management
- Batch processing

### Settings
- Theme preferences (dark/light/system)
- API key management
- Model selection
- Voice settings
- Notification preferences

## Development

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for code formatting
- Component-first architecture

### Adding New Features

1. Create components in `components/`
2. Add pages in `app/`
3. Update API client in `lib/` if needed
4. Add types in component files or separate `.d.ts` files

## Contributing

See [CONTRIBUTING.md](../../docs/CONTRIBUTING.md) for guidelines.

## License

Proprietary - All rights reserved