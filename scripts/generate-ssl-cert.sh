#!/bin/bash

# Script per generare certificati SSL self-signed per YouWorker.AI
# Uso: ./scripts/generate-ssl-cert.sh [domain] [ip]

DOMAIN=${1:-95.110.228.79}
IP=${2:-95.110.228.79}
SSL_DIR="data/nginx/ssl"

# Crea directory SSL se non esiste
mkdir -p "$SSL_DIR"

# Genera certificato se non esiste
if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
    echo "Generazione certificati SSL per $DOMAIN (IP: $IP)..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=IT/ST=State/L=City/O=YouWorker/OU=IT/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,IP:$IP"
    
    # Imposta permessi corretti
    chmod 600 "$SSL_DIR/key.pem"
    chmod 644 "$SSL_DIR/cert.pem"
    
    echo "Certificati generati con successo in $SSL_DIR/"
    echo "Certificato: $SSL_DIR/cert.pem"
    echo "Chiave: $SSL_DIR/key.pem"
else
    echo "Certificati SSL già esistenti in $SSL_DIR/"
fi

# Mostra informazioni sul certificato
echo ""
echo "Informazioni certificato:"
openssl x509 -in "$SSL_DIR/cert.pem" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After:)"