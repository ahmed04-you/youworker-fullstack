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
    
    # Upload to S3 if configured
    if [ -n "$S3_BUCKET" ] && command_exists aws; then
        log "Uploading PostgreSQL backup to S3..."
        aws s3 cp "$COMPRESSED_FILE" "s3://$S3_BUCKET/postgres-backups/"
        log "PostgreSQL backup uploaded to S3"
    fi
    
    echo "$COMPRESSED_FILE"
}

# Function to create Qdrant backup
backup_qdrant() {
    log "Starting Qdrant backup..."
    
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_DIR_QDRANT="$BACKUP_DIR/qdrant_$TIMESTAMP"
    COMPRESSED_FILE="$BACKUP_DIR/qdrant_backup_$TIMESTAMP.tar.gz"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR_QDRANT"
    
    # Export all collections
    if command_exists curl && command_exists jq; then
        # Get list of collections
        COLLECTIONS=$(curl -s "http://$QDRANT_HOST:$QDRANT_PORT/collections" | jq -r '.result.collections[].name')
        
        # Export each collection
        for COLLECTION in $COLLECTIONS; do
            log "Exporting Qdrant collection: $COLLECTION"
            curl -s -X POST "http://$QDRANT_HOST:$QDRANT_PORT/collections/$COLLECTION/snapshots" \
                -H "Content-Type: application/json" \
                -d '{}' | jq -r '.result.name' > "$BACKUP_DIR_QDRANT/${COLLECTION}_snapshot.info"
            
            # Download snapshot (this would need to be implemented based on Qdrant's API)
            # For now, we'll export the collection data as JSON
            curl -s -X POST "http://$QDRANT_HOST:$QDRANT_PORT/collections/$COLLECTION/points/scroll" \
                -H "Content-Type: application/json" \
                -d '{"limit": 1000, "with_payload": true, "with_vector": true}' \
                > "$BACKUP_DIR_QDRANT/${COLLECTION}_points.json"
        done
    else
        log "Warning: curl or jq not found, skipping Qdrant collection export"
    fi
    
    # Copy Qdrant storage data
    if [ -d "/data/qdrant" ]; then
        log "Copying Qdrant storage data..."
        cp -r /data/qdrant "$BACKUP_DIR_QDRANT/storage"
    fi
    
    # Compress backup
    tar -czf "$COMPRESSED_FILE" -C "$BACKUP_DIR" "qdrant_$TIMESTAMP"
    
    # Remove temporary directory
    rm -rf "$BACKUP_DIR_QDRANT"
    
    log "Qdrant backup completed: $COMPRESSED_FILE"
    
    # Upload to S3 if configured
    if [ -n "$S3_BUCKET" ] && command_exists aws; then
        log "Uploading Qdrant backup to S3..."
        aws s3 cp "$COMPRESSED_FILE" "s3://$S3_BUCKET/qdrant-backups/"
        log "Qdrant backup uploaded to S3"
    fi
    
    echo "$COMPRESSED_FILE"
}

# Function to clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Clean up PostgreSQL backups
    find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # Clean up Qdrant backups
    find "$BACKUP_DIR" -name "qdrant_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    
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