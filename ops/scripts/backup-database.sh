#!/bin/bash

# Automated backup script for YouWorker.AI database
# This script creates backups of PostgreSQL and Qdrant databases

set -e  # Exit on any error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/youworker/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-youworker}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
QDRANT_HOST="${QDRANT_HOST:-qdrant}"
QDRANT_PORT="${QDRANT_PORT:-6333}"
QDRANT_COLLECTION="${QDRANT_COLLECTION:-documents}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
S3_REGION="${S3_REGION:-us-east-1}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"  # REQUIRED for encrypted backups
ENCRYPT_BACKUPS="${ENCRYPT_BACKUPS:-true}"  # Enable encryption by default

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to encrypt backup file
encrypt_backup() {
    local input_file="$1"
    local output_file="${input_file}.enc"

    if [ "$ENCRYPT_BACKUPS" = "true" ]; then
        if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
            log "ERROR: BACKUP_ENCRYPTION_KEY not set but encryption enabled"
            log "Generate key with: openssl rand -base64 32"
            return 1
        fi

        log "Encrypting backup: $input_file"

        # Encrypt using AES-256-CBC
        if openssl enc -aes-256-cbc -salt -pbkdf2 \
            -in "$input_file" \
            -out "$output_file" \
            -pass env:BACKUP_ENCRYPTION_KEY; then

            # Remove unencrypted file
            rm -f "$input_file"
            log "Backup encrypted: $output_file"
            echo "$output_file"
            return 0
        else
            log "ERROR: Encryption failed"
            return 1
        fi
    else
        log "Encryption disabled, keeping plaintext backup"
        echo "$input_file"
        return 0
    fi
}

# Function to verify encryption key is set
verify_encryption_key() {
    if [ "$ENCRYPT_BACKUPS" = "true" ] && [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        log "ERROR: Encryption is enabled but BACKUP_ENCRYPTION_KEY is not set"
        log "Set it in .env or generate with: openssl rand -base64 32"
        exit 1
    fi
}

# Function to create PostgreSQL backup
backup_postgres() {
    log "Starting PostgreSQL backup..."
    
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/postgres_backup_$TIMESTAMP.sql"
    COMPRESSED_FILE="$BACKUP_FILE.gz"
    
    # Create backup
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=custom \
        > "$BACKUP_FILE"
    
    # Compress backup
    gzip "$BACKUP_FILE"

    log "PostgreSQL backup completed: $COMPRESSED_FILE"

    # Encrypt backup
    if ENCRYPTED_FILE=$(encrypt_backup "$COMPRESSED_FILE"); then
        FINAL_FILE="$ENCRYPTED_FILE"
    else
        log "ERROR: Encryption failed for PostgreSQL backup"
        return 1
    fi

    # Upload to S3 if configured
    if [ -n "$S3_BUCKET" ] && command_exists aws; then
        log "Uploading PostgreSQL backup to S3..."
        aws s3 cp "$FINAL_FILE" "s3://$S3_BUCKET/postgres-backups/"
        log "PostgreSQL backup uploaded to S3"
    fi

    echo "$FINAL_FILE"
}

# Function to create Qdrant backup
backup_qdrant() {
    log "Starting Qdrant backup..."

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_DIR_QDRANT="$BACKUP_DIR/qdrant_$TIMESTAMP"
    COMPRESSED_FILE="$BACKUP_DIR/qdrant_backup_$TIMESTAMP.tar.gz"

    # Create backup directory
    mkdir -p "$BACKUP_DIR_QDRANT"

    # Export all collections using Qdrant snapshot API
    if command_exists curl && command_exists jq; then
        # Get list of collections
        log "Fetching Qdrant collections list..."
        COLLECTIONS=$(curl -s "http://$QDRANT_HOST:$QDRANT_PORT/collections" | jq -r '.result.collections[].name' 2>/dev/null)

        if [ -n "$COLLECTIONS" ]; then
            # Export each collection
            for COLLECTION in $COLLECTIONS; do
                log "Creating snapshot for Qdrant collection: $COLLECTION"

                # Create snapshot via API
                SNAPSHOT_NAME=$(curl -s -X POST "http://$QDRANT_HOST:$QDRANT_PORT/collections/$COLLECTION/snapshots" \
                    -H "Content-Type: application/json" \
                    -d '{}' | jq -r '.result.name' 2>/dev/null)

                if [ -n "$SNAPSHOT_NAME" ] && [ "$SNAPSHOT_NAME" != "null" ]; then
                    log "Snapshot created: $SNAPSHOT_NAME"

                    # Wait for snapshot to complete
                    sleep 2

                    # Download snapshot
                    log "Downloading snapshot for collection: $COLLECTION"
                    curl -s -o "$BACKUP_DIR_QDRANT/${COLLECTION}_${SNAPSHOT_NAME}" \
                        "http://$QDRANT_HOST:$QDRANT_PORT/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME"

                    # Verify download succeeded
                    if [ -f "$BACKUP_DIR_QDRANT/${COLLECTION}_${SNAPSHOT_NAME}" ]; then
                        log "Snapshot downloaded successfully: ${COLLECTION}_${SNAPSHOT_NAME}"
                    else
                        log "ERROR: Failed to download snapshot for $COLLECTION"
                    fi
                else
                    log "ERROR: Failed to create snapshot for collection: $COLLECTION"
                fi
            done
        else
            log "WARNING: No Qdrant collections found or unable to fetch list"
        fi
    else
        log "ERROR: curl or jq not found, cannot backup Qdrant"
        return 1
    fi

    # Compress backup
    if [ -n "$(ls -A "$BACKUP_DIR_QDRANT" 2>/dev/null)" ]; then
        log "Compressing Qdrant backup..."
        tar -czf "$COMPRESSED_FILE" -C "$BACKUP_DIR" "qdrant_$TIMESTAMP"

        # Remove temporary directory
        rm -rf "$BACKUP_DIR_QDRANT"

        log "Qdrant backup completed: $COMPRESSED_FILE"

        # Encrypt backup
        if ENCRYPTED_FILE=$(encrypt_backup "$COMPRESSED_FILE"); then
            FINAL_FILE="$ENCRYPTED_FILE"
        else
            log "ERROR: Encryption failed for Qdrant backup"
            return 1
        fi

        # Upload to S3 if configured
        if [ -n "$S3_BUCKET" ] && command_exists aws; then
            log "Uploading Qdrant backup to S3..."
            aws s3 cp "$FINAL_FILE" "s3://$S3_BUCKET/qdrant-backups/"
            log "Qdrant backup uploaded to S3"
        fi

        echo "$FINAL_FILE"
    else
        log "ERROR: No Qdrant snapshots created"
        rm -rf "$BACKUP_DIR_QDRANT"
        return 1
    fi
}

# Function to clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."

    # Clean up PostgreSQL backups (both encrypted and unencrypted)
    find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz.enc" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

    # Clean up Qdrant backups (both encrypted and unencrypted)
    find "$BACKUP_DIR" -name "qdrant_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "qdrant_backup_*.tar.gz.enc" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

    log "Local backup cleanup completed"
    
    # Clean up S3 backups if configured
    if [ -n "$S3_BUCKET" ] && command_exists aws; then
        log "Cleaning up S3 backups older than $RETENTION_DAYS days..."
        
        # Clean up PostgreSQL backups
        aws s3 ls "s3://$S3_BUCKET/postgres-backups/" --recursive | while read -r line; do
            CREATE_DATE=$(echo "$line" | awk '{print $1" "$2}')
            FILE_NAME=$(echo "$line" | awk '{print $4}')
            
            # Convert date to timestamp and compare
            FILE_DATE=$(date -d"$CREATE_DATE" +%s)
            CURRENT_DATE=$(date +%s)
            AGE_DAYS=$(( (CURRENT_DATE - FILE_DATE) / 86400 ))
            
            if [ $AGE_DAYS -gt $RETENTION_DAYS ]; then
                aws s3 rm "s3://$S3_BUCKET/postgres-backups/$FILE_NAME"
                log "Deleted old PostgreSQL backup from S3: $FILE_NAME"
            fi
        done
        
        # Clean up Qdrant backups
        aws s3 ls "s3://$S3_BUCKET/qdrant-backups/" --recursive | while read -r line; do
            CREATE_DATE=$(echo "$line" | awk '{print $1" "$2}')
            FILE_NAME=$(echo "$line" | awk '{print $4}')
            
            # Convert date to timestamp and compare
            FILE_DATE=$(date -d"$CREATE_DATE" +%s)
            CURRENT_DATE=$(date +%s)
            AGE_DAYS=$(( (CURRENT_DATE - FILE_DATE) / 86400 ))
            
            if [ $AGE_DAYS -gt $RETENTION_DAYS ]; then
                aws s3 rm "s3://$S3_BUCKET/qdrant-backups/$FILE_NAME"
                log "Deleted old Qdrant backup from S3: $FILE_NAME"
            fi
        done
    fi
    
    log "Backup cleanup completed"
}

# Function to verify backup integrity
verify_backup() {
    local file="$1"
    local type="$2"
    
    log "Verifying $type backup: $file"
    
    if [ ! -f "$file" ]; then
        log "Error: Backup file not found: $file"
        return 1
    fi
    
    # Check file size
    FILE_SIZE=$(stat -c%s "$file")
    if [ "$FILE_SIZE" -lt 100 ]; then
        log "Error: Backup file too small: $FILE_SIZE bytes"
        return 1
    fi
    
    # Verify compressed file
    if [[ "$file" == *.gz ]]; then
        if ! gzip -t "$file" 2>/dev/null; then
            log "Error: Compressed backup file is corrupted: $file"
            return 1
        fi
    fi
    
    # Verify tar file
    if [[ "$file" == *.tar.gz ]]; then
        if ! tar -tzf "$file" >/dev/null 2>&1; then
            log "Error: Tar backup file is corrupted: $file"
            return 1
        fi
    fi
    
    log "Backup verification successful: $file"
    return 0
}

# Function to send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Send notification via webhook if configured
    if [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" \
            2>/dev/null || log "Warning: Failed to send webhook notification"
    fi
    
    # Send email if configured (requires mail command)
    if [ -n "$NOTIFICATION_EMAIL" ] && command_exists mail; then
        echo "$message" | mail -s "YouWorker.AI Backup $status" "$NOTIFICATION_EMAIL" \
            2>/dev/null || log "Warning: Failed to send email notification"
    fi
}

# Main backup function
main() {
    log "Starting YouWorker.AI database backup..."

    # Verify encryption configuration
    verify_encryption_key

    # Track backup success
    SUCCESS=true
    BACKUP_FILES=()
    
    # Create PostgreSQL backup
    if POSTGRES_BACKUP=$(backup_postgres); then
        if verify_backup "$POSTGRES_BACKUP" "PostgreSQL"; then
            BACKUP_FILES+=("$POSTGRES_BACKUP")
        else
            SUCCESS=false
        fi
    else
        SUCCESS=false
    fi
    
    # Create Qdrant backup
    if QDRANT_BACKUP=$(backup_qdrant); then
        if verify_backup "$QDRANT_BACKUP" "Qdrant"; then
            BACKUP_FILES+=("$QDRANT_BACKUP")
        else
            SUCCESS=false
        fi
    else
        SUCCESS=false
    fi
    
    # Clean up old backups
    cleanup_old_backups
    
    # Send notification
    if [ "$SUCCESS" = true ]; then
        MESSAGE="Backup completed successfully. Files: ${BACKUP_FILES[*]}"
        log "$MESSAGE"
        send_notification "SUCCESS" "$MESSAGE"
    else
        MESSAGE="Backup completed with errors. Check logs for details."
        log "ERROR: $MESSAGE"
        send_notification "FAILURE" "$MESSAGE"
        exit 1
    fi
    
    log "Backup process completed"
}

# Run main function
main "$@"