# Whispr — Threat Model

## Security Assumption
The backend may be compromised.

## Attacker Capabilities
The attacker may:
- read the database
- read stored messages
- inspect backend logs
- access message queues
- control the server application
- attempt replay or tampering

## What the Attacker Should Not Be Able to Do
- read message plaintext
- recover private keys stored safely on user devices
- silently alter messages without detection
- impersonate users if signing/verification is implemented correctly

## Out of Scope
- full device compromise on sender or receiver side
- hardware side-channel attacks
- nation-state level endpoint malware
- full anonymous metadata protection

## Threats Considered
- backend data breach
- malicious database dump
- message tampering
- replay attempts
- weak key storage
- poor secret handling
- insecure attachment handling

## Mitigations
- client-side encryption
- authenticated encryption
- private key isolation
- signed or integrity-protected payloads
- nonce management
- secure session design
- rate limiting and audit logging
