# Whispr — Project Overview

This document describes the project vision and target direction for Whispr.

## Project Name
**Whispr**

## Tagline
A secure communication system that stays private even if the backend is compromised.

## One-Line Summary
Whispr is an end-to-end encrypted one-to-one messaging platform designed so that the server can relay and store messages without ever learning their contents.

## Vision
Most messaging systems rely on backend trust. Whispr is built on a different assumption: the backend may fail, leak, or even be compromised. User privacy should still hold.

## Core Idea
Whispr uses client-side encryption, secure key exchange, and encrypted message storage so that only the intended sender and receiver can read a message.

## Why This Matters
Traditional systems often stop at HTTPS. That protects data in transit, but not necessarily data from the backend itself. Whispr addresses the harder problem: privacy against a compromised server.

## Target Users
- Privacy-conscious individuals
- Security-focused teams
- Students and researchers learning applied cryptography
- Hackathon judges looking for practical security engineering

## Core Value Proposition
- Server cannot read message plaintext
- Database leaks reveal ciphertext, not conversations
- Stronger privacy model than a normal chat app
- Clear threat model and practical security design

## Implementation Note

This overview is intentionally high-level and aspirational. Refer to the repository root and service READMEs for the current implementation state.
