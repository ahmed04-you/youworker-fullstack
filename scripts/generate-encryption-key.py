#!/usr/bin/env python3
"""
Generate a Fernet encryption key for CHAT_MESSAGE_ENCRYPTION_SECRET.

This script generates a cryptographically secure encryption key for encrypting
chat messages in the YouWorker.AI database.

Usage:
    python scripts/generate-encryption-key.py

The generated key should be added to your .env file as:
    CHAT_MESSAGE_ENCRYPTION_SECRET=<generated_key>

IMPORTANT: Keep this key secure and backed up!
- Losing this key means you cannot decrypt existing messages
- Store it in a secure password manager or secrets vault
- Never commit it to version control
"""

from cryptography.fernet import Fernet


def main():
    print("Generating Fernet encryption key for chat messages...")
    print()

    # Generate key
    key = Fernet.generate_key().decode()

    print("=" * 70)
    print("CHAT MESSAGE ENCRYPTION KEY")
    print("=" * 70)
    print()
    print(f"  {key}")
    print()
    print("=" * 70)
    print()
    print("Add this to your .env file:")
    print()
    print(f"CHAT_MESSAGE_ENCRYPTION_SECRET={key}")
    print()
    print("⚠️  SECURITY WARNINGS:")
    print("  • Keep this key secret and secure")
    print("  • Back up this key in a secure location (password manager/vault)")
    print("  • Losing this key means you cannot decrypt existing messages")
    print("  • Do NOT commit this to version control (.env is in .gitignore)")
    print("  • Rotate this key periodically (requires message re-encryption)")
    print()


if __name__ == "__main__":
    main()
