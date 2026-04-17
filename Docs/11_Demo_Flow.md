# Whispr — Demo Flow

This document describes the implemented demo script for the current MVP.

## Demo Goal
Show that the system remains private even when the backend is compromised.

## Demo Script

### Step 1 — User Setup
- Open `/demo`
- Register or log in two users, such as Alice and Bob
- Generate or restore local keypairs in each browser lane
- Upload both public keys and mention that private keys never leave the browser

### Step 2 — Send Message
- Select the active sender
- Send a message from Alice to Bob
- Explain that encryption happens on Alice's device before the payload crosses the network

### Step 3 — Show Backend View
- Point to the built-in compromised backend panel on the right
- Show sender, receiver, nonce, and ciphertext only

### Step 4 — Receive Message
- Bob receives ciphertext
- Bob decrypts locally and sees plaintext

### Step 5 — Compromised Backend Scenario
- Describe the backend as a hostile blind relay
- Show that an attacker inspecting the backend panel still cannot recover plaintext or private keys

### Step 6 — Tamper Test
- Use the `Tamper latest ciphertext` control
- Show the client-side integrity failure after the stored payload is corrupted

## Supporting Surface

The `/app` route provides the same authenticated APIs through a more conventional single-user chat interface. Use it when you want to show that the demo flow is not a one-off mock.

## What Judges Should Notice
- privacy does not depend on trusting server
- encryption is practical and end-to-end
- system design directly matches the problem statement
- strong combination of security and product thinking

## Implementation Note

This flow matches the current implementation and should be updated if the demo harness behavior changes.
