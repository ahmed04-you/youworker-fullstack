#!/bin/bash

# Verification script for YouWorker.AI backups
# This script tests backup integrity without performing restore

set -e

# Configuration
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Function to log with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to verify encrypted backup
verify_backup() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi

    log "Verifying backup: $backup_file"

    # Check file size
    FILE_SIZE=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file" 2>/dev/null)
    if [ "$FILE_SIZE" -lt 100 ]; then
        log "ERROR: Backup file too small: $FILE_SIZE bytes"
        return 1
    fi
    log "  Size: $FILE_SIZE bytes ✓"

    # Test decryption if encrypted
    if [[ "$backup_file" == *.enc ]]; then
        if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
            log "ERROR: Backup is encrypted but BACKUP_ENCRYPTION_KEY not set"
            return 1
        fi

        log "  Testing decryption..."
        if openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -pass env:BACKUP_ENCRYPTION_KEY 2>/dev/null | head -c 1 >/dev/null; then
            log "  Decryption test: ✓"
        else
            log "ERROR: Decryption failed - wrong key or corrupted file"
            return 1
        fi

        # Decrypt to temp file for compression test
        TEMP_FILE=$(mktemp)
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$TEMP_FILE" \
            -pass env:BACKUP_ENCRYPTION_KEY

        backup_file="$TEMP_FILE"
    fi

    # Test compression
    if [[ "$backup_file" == *.gz ]] || [[ "$backup_file" == *.tar.gz ]]; then
        log "  Testing compression..."
        if gzip -t "$backup_file" 2>/dev/null; then
            log "  Compression test: ✓"
        elif tar -tzf "$backup_file" >/dev/null 2>&1; then
            log "  Compression test: ✓"
        else
            log "ERROR: Compressed file is corrupted"
            [ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE"
            return 1
        fi
    fi

    # Cleanup temp file
    [ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE"

    log "✓ Backup verification successful"
    return 0
}

# Main function
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <backup-file> [backup-file2 ...]"
        echo ""
        echo "Verifies integrity of backup files without restoring."
        echo ""
        echo "Environment variables:"
        echo "  BACKUP_ENCRYPTION_KEY  Required for encrypted backups (.enc files)"
        echo ""
        exit 1
    fi

    SUCCESS=true

    for backup_file in "$@"; do
        echo ""
        if ! verify_backup "$backup_file"; then
            SUCCESS=false
        fi
    done

    echo ""
    if [ "$SUCCESS" = true ]; then
        log "✓ All backups verified successfully"
        exit 0
    else
        log "✗ Some backups failed verification"
        exit 1
    fi
}

# Run main function
main "$@"
