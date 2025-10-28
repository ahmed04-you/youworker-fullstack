#!/bin/bash

# Restore script for YouWorker.AI database backups
# This script restores encrypted backups of PostgreSQL and Qdrant

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
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Function to log with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to decrypt backup
decrypt_backup() {
    local encrypted_file="$1"
    local decrypted_file="${encrypted_file%.enc}"

    if [[ "$encrypted_file" == *.enc ]]; then
        if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
            log "ERROR: BACKUP_ENCRYPTION_KEY not set but backup is encrypted"
            log "Set it in your environment to decrypt backups"
            exit 1
        fi

        log "Decrypting backup: $encrypted_file"

        if openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$encrypted_file" \
            -out "$decrypted_file" \
            -pass env:BACKUP_ENCRYPTION_KEY; then

            log "Backup decrypted: $decrypted_file"
            echo "$decrypted_file"
            return 0
        else
            log "ERROR: Decryption failed - check your BACKUP_ENCRYPTION_KEY"
            exit 1
        fi
    else
        # Not encrypted
        echo "$encrypted_file"
        return 0
    fi
}

# Function to restore PostgreSQL backup
restore_postgres() {
    local backup_file="$1"

    log "Restoring PostgreSQL backup: $backup_file"

    # Decrypt if needed
    if DECRYPTED_FILE=$(decrypt_backup "$backup_file"); then
        # Decompress
        DECOMPRESSED_FILE="${DECRYPTED_FILE%.gz}"
        gunzip -c "$DECRYPTED_FILE" > "$DECOMPRESSED_FILE"

        # Restore using pg_restore
        log "Restoring database..."
        PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            --verbose \
            --clean \
            --if-exists \
            "$DECOMPRESSED_FILE" || log "WARNING: Some restore errors (may be expected)"

        # Cleanup
        rm -f "$DECOMPRESSED_FILE"
        if [[ "$backup_file" == *.enc ]]; then
            rm -f "$DECRYPTED_FILE"
        fi

        log "PostgreSQL restore completed"
        return 0
    else
        log "ERROR: Failed to decrypt PostgreSQL backup"
        return 1
    fi
}

# Function to restore Qdrant backup
restore_qdrant() {
    local backup_file="$1"

    log "Restoring Qdrant backup: $backup_file"

    # Decrypt if needed
    if DECRYPTED_FILE=$(decrypt_backup "$backup_file"); then
        # Extract archive
        TEMP_DIR="$BACKUP_DIR/restore_temp_$$"
        mkdir -p "$TEMP_DIR"

        log "Extracting Qdrant backup..."
        tar -xzf "$DECRYPTED_FILE" -C "$TEMP_DIR"

        # Find the extracted directory
        EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "qdrant_*" | head -1)

        if [ -z "$EXTRACTED_DIR" ]; then
            log "ERROR: Could not find extracted Qdrant directory"
            rm -rf "$TEMP_DIR"
            return 1
        fi

        # Restore each collection snapshot
        for SNAPSHOT_FILE in "$EXTRACTED_DIR"/*; do
            if [ -f "$SNAPSHOT_FILE" ]; then
                FILENAME=$(basename "$SNAPSHOT_FILE")
                # Extract collection name (format: collectionname_snapshotid)
                COLLECTION=$(echo "$FILENAME" | cut -d'_' -f1)

                log "Restoring Qdrant collection: $COLLECTION"

                # Upload snapshot to Qdrant
                curl -X PUT "http://$QDRANT_HOST:$QDRANT_PORT/collections/$COLLECTION/snapshots/upload" \
                    -H "Content-Type: application/octet-stream" \
                    --data-binary "@$SNAPSHOT_FILE"

                # Recover from snapshot
                SNAPSHOT_NAME=$(echo "$FILENAME" | cut -d'_' -f2-)
                curl -X PUT "http://$QDRANT_HOST:$QDRANT_PORT/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME/recover" \
                    -H "Content-Type: application/json"

                log "Qdrant collection $COLLECTION restored from snapshot"
            fi
        done

        # Cleanup
        rm -rf "$TEMP_DIR"
        if [[ "$backup_file" == *.enc ]]; then
            rm -f "$DECRYPTED_FILE"
        fi

        log "Qdrant restore completed"
        return 0
    else
        log "ERROR: Failed to decrypt Qdrant backup"
        return 1
    fi
}

# Function to list available backups
list_backups() {
    log "Available backups in $BACKUP_DIR:"
    echo ""
    echo "PostgreSQL backups:"
    ls -lh "$BACKUP_DIR"/postgres_backup_* 2>/dev/null || echo "  No PostgreSQL backups found"
    echo ""
    echo "Qdrant backups:"
    ls -lh "$BACKUP_DIR"/qdrant_backup_* 2>/dev/null || echo "  No Qdrant backups found"
    echo ""
}

# Main function
main() {
    local postgres_backup=""
    local qdrant_backup=""
    local list_only=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --postgres)
                postgres_backup="$2"
                shift 2
                ;;
            --qdrant)
                qdrant_backup="$2"
                shift 2
                ;;
            --list)
                list_only=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--postgres <file>] [--qdrant <file>] [--list]"
                echo ""
                echo "Options:"
                echo "  --postgres <file>  Restore PostgreSQL from specified backup file"
                echo "  --qdrant <file>    Restore Qdrant from specified backup file"
                echo "  --list             List available backups"
                echo "  --help             Show this help message"
                echo ""
                echo "Environment variables:"
                echo "  BACKUP_ENCRYPTION_KEY  Required for encrypted backups"
                echo ""
                exit 0
                ;;
            *)
                log "ERROR: Unknown option: $1"
                exit 1
                ;;
        esac
    done

    if [ "$list_only" = true ]; then
        list_backups
        exit 0
    fi

    # Confirmation prompt
    if [ -n "$postgres_backup" ] || [ -n "$qdrant_backup" ]; then
        echo "⚠️  WARNING: This will OVERWRITE current data!"
        echo ""
        if [ -n "$postgres_backup" ]; then
            echo "  PostgreSQL: $postgres_backup"
        fi
        if [ -n "$qdrant_backup" ]; then
            echo "  Qdrant: $qdrant_backup"
        fi
        echo ""
        read -p "Continue with restore? (type 'yes' to confirm): " -r
        if [[ ! $REPLY == "yes" ]]; then
            log "Restore cancelled"
            exit 0
        fi
    else
        log "ERROR: No backup files specified"
        echo "Use --list to see available backups"
        echo "Use --help for usage information"
        exit 1
    fi

    # Perform restore
    SUCCESS=true

    if [ -n "$postgres_backup" ]; then
        if ! restore_postgres "$postgres_backup"; then
            SUCCESS=false
        fi
    fi

    if [ -n "$qdrant_backup" ]; then
        if ! restore_qdrant "$qdrant_backup"; then
            SUCCESS=false
        fi
    fi

    if [ "$SUCCESS" = true ]; then
        log "✓ Restore completed successfully"
        exit 0
    else
        log "✗ Restore completed with errors"
        exit 1
    fi
}

# Run main function
main "$@"
