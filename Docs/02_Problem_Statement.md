# Whispr — Problem Statement

## Problem Statement
Create a secure communication system that remains private even if the backend is compromised.

## Domain
Cybersecurity / Privacy

## Detailed Problem
Many communication platforms protect traffic using HTTPS, but if the backend server, database, or storage layer is compromised, stored conversations may still be exposed. This means the system is only secure as long as the server remains trustworthy.

## Goal
Design and build a communication platform where message privacy does not depend on trusting the backend.

## Main Challenge
True security requires:
- end-to-end encryption
- secure key management
- message integrity protection
- careful threat modeling
- safe storage of encrypted data

## Desired Outcome
Even if an attacker gains access to the backend:
- they should not be able to read user messages
- they should not be able to silently alter messages without detection
- they should only see encrypted blobs and limited metadata

## Project Interpretation
Whispr solves this by making the client responsible for encryption and decryption, while the server only handles routing, delivery, and ciphertext storage.
