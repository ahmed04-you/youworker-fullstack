# YouWorker.AI Documentation

Complete technical documentation for YouWorker.AI - an AI conversational assistant with voice/text interaction, semantic search, and extensible tool integration.

## Documentation Index

### Getting Started
- **[Setup Guide](SETUP.md)** - Complete installation and configuration guide
- **[Quick Start](../README.md)** - Get up and running in 5 minutes
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions

### Architecture & Design
- **[System Architecture](ARCHITECTURE.md)** - High-level system design and components
- **[API Documentation](API.md)** - REST and WebSocket API reference
- **[Frontend Guide](FRONTEND.md)** - Frontend architecture and components
- **[MCP Servers](MCP_SERVERS.md)** - Model Context Protocol server documentation

### Development
- **[Development Guide](DEVELOPMENT.md)** - Local development setup and workflows
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project
- **[Testing Guide](TESTING.md)** - Testing strategy and practices

## Project Overview

YouWorker.AI is a full-stack conversational AI application that combines:

- **Real-time Communication**: WebSocket-based chat with streaming responses
- **Voice Capabilities**: Speech-to-text (Whisper) and text-to-speech (Piper)
- **Knowledge Management**: Document ingestion with semantic search via Qdrant
- **Extensible Tools**: Dynamic tool discovery through MCP protocol
- **Modern UI**: Next.js 15 frontend with responsive design

## Technology Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **Ollama** - Local LLM inference (gpt-oss:20b)
- **PostgreSQL** - Relational database for sessions and analytics
- **Qdrant** - Vector database for semantic search
- **Faster Whisper** - Speech-to-text transcription
- **Piper TTS** - Text-to-speech synthesis

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components

### Infrastructure
- **Docker Compose** - Containerized deployment
- **Nginx** - Reverse proxy and SSL termination
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization

## Key Features

### Chat & Voice
- Real-time text chat with streaming responses
- Push-to-talk voice input with transcription
- Voice output with natural-sounding speech synthesis
- Message history and session management

### Knowledge Base
- Multi-format document ingestion (PDF, text, audio, web)
- Semantic search across ingested documents
- Automatic chunking and embedding
- GPU-accelerated processing

### Agent Capabilities
- Dynamic tool discovery and execution
- Web search and scraping
- Date/time operations
- Unit conversions
- Custom tool integration via MCP

### Analytics
- Token usage tracking
- Tool execution metrics
- Session analytics
- Performance monitoring

## Quick Links

- [Main Repository](../)
- [API Endpoint Documentation](API.md#endpoints)
- [WebSocket Protocol](API.md#websocket-protocol)
- [Environment Variables](SETUP.md#environment-variables)
- [Troubleshooting](DEPLOYMENT.md#troubleshooting)

## Support

For issues, questions, or contributions, please see the [Contributing Guide](CONTRIBUTING.md).

## License

This project is licensed under the terms specified in the main repository.