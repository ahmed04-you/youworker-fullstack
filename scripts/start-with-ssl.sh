#!/bin/bash

# Script di avvio per YouWorker.AI con generazione certificati SSL
# Uso: ./scripts/start-with-ssl.sh [domain] [ip]

DOMAIN=${1:-localhost}
IP=${2:-127.0.0.1}

echo "🚀 Avvio YouWorker.AI con SSL per $DOMAIN (IP: $IP)"
echo "=================================================="

# 1. Genera certificati SSL
echo "📋 Generazione certificati SSL..."
./scripts/generate-ssl-cert.sh "$DOMAIN" "$IP"

# 2. Verifica file ambiente
if [ ! -f .env ]; then
    echo "⚠️  File .env non trovato, creazione da template..."
    cp .env.example .env
    echo "✅ File .env creato. Modificalo secondo le tue esigenze."
fi

# 3. Crea directory necessarie
echo "📁 Creazione directory dati..."
mkdir -p data/{postgres,qdrant,ollama,nginx/ssl,uploads,models}
mkdir -p examples/ingestion

# 4. Scarica modelli TTS se necessario
if [ ! -d "data/models/piper-voices" ]; then
    echo "🎵 Download modelli TTS Piper..."
    if [ -f "./ops/download-piper-models.sh" ]; then
        ./ops/download-piper-models.sh
    else
        echo "⚠️  Script download modelli TTS non trovato"
    fi
fi

# 5. Avvia i servizi
echo "🐳 Avvio servizi Docker Compose..."
docker compose -f ops/compose/docker-compose.yml up -d

# 6. Attendi che i servizi siano pronti
echo "⏳ Atteso avvio servizi..."
sleep 10

# 7. Verifica health check
echo "🔍 Verifica salute servizi..."
for i in {1..30}; do
    if curl -f http://localhost:8001/health >/dev/null 2>&1; then
        echo "✅ Servizi pronti!"
        break
    fi
    echo "⏳ Atteso servizi... ($i/30)"
    sleep 5
done

# 8. Mostra informazioni di accesso
echo ""
echo "🎉 YouWorker.AI è avviato!"
echo "=========================="
echo "🌐 Frontend: https://$DOMAIN:8000"
echo "🔧 API: https://$DOMAIN:8001"
echo "📚 Documentazione API: https://$DOMAIN:8001/docs"
echo ""
echo "⚠️  Il certificato è self-signed. Accetta l'avviso di sicurezza del browser."
echo ""
echo "📊 Comandi utili:"
echo "  - View log: docker compose -f ops/compose/docker-compose.yml logs -f"
echo "  - Stop: docker compose -f ops/compose/docker-compose.yml down"
echo "  - Restart: docker compose -f ops/compose/docker-compose.yml restart"