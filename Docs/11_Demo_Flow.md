# Whispr — Demo Flow

This document describes an intended demonstration script for the project.

## Demo Goal
Show that the system remains private even when the backend is compromised.

## Demo Script

### Step 1 — User Setup
- Register two users: Alice and Bob
- Generate client-side keypairs
- Show that only public keys are uploaded

### Step 2 — Send Message
- Alice sends a message to Bob
- Encryption happens on Alice's device before network transmission

### Step 3 — Show Backend View
- Open admin panel or database view
- Show stored ciphertext instead of readable plaintext

### Step 4 — Receive Message
- Bob receives ciphertext
- Bob decrypts locally and sees plaintext

### Step 5 — Compromised Backend Scenario
- Simulate attacker reading backend database
- Show attacker sees only encrypted blobs and metadata

### Step 6 — Tamper Test
- Modify ciphertext or signature manually
- Show message verification or decryption failure

## What Judges Should Notice
- privacy does not depend on trusting server
- encryption is practical and end-to-end
- system design directly matches the problem statement
- strong combination of security and product thinking

## Implementation Note

Adapt this demo flow to match the features that are actually implemented at presentation time.
