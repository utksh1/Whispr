# Whispr — Core Features

## Must-Have Features
1. **User authentication**
   - Secure signup and login
   - Session handling

2. **Device keypair generation**
   - Public/private keypair generated on the client
   - Public key shared with backend
   - Private key never leaves the device in plaintext

3. **End-to-end encrypted one-to-one messaging**
   - Messages encrypted before leaving sender device
   - Messages decrypted only on receiver device

4. **Encrypted message storage**
   - Backend stores only ciphertext
   - Plaintext never written to server database

5. **Message integrity**
   - Detect tampering or corruption
   - Ensure receiver gets authentic data

6. **Secure key exchange**
   - Sender retrieves receiver public key
   - Session/message key established safely

7. **Real-time delivery**
   - WebSocket or Socket.IO based live messaging
   - Offline users can fetch encrypted messages later

## Good-to-Have Features
- Disappearing messages
- Read receipts with privacy-safe design
- Encrypted file attachments
- QR-based key verification
- Multi-device support
- Key rotation
- Secure notifications with minimal leakage

## Demo-Friendly Features
- “Compromised server” admin panel showing ciphertext only
- Side-by-side plaintext on client vs ciphertext in database
- Message tampering demo showing verification failure
