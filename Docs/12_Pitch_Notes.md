# Whispr — Pitch Notes

This file is presentation material, not an implementation spec.

## Elevator Pitch
Whispr is a secure messaging platform designed for a zero-trust backend world. Even if the server or database is compromised, attackers cannot read user conversations because messages are encrypted end to end on the client.

## The Problem
Most apps stop at HTTPS. That protects traffic in transit, but not data from the backend itself. A server breach can still expose conversations.

## Our Solution
Whispr moves trust away from the backend by using:
- client-side encryption
- public/private key infrastructure
- encrypted storage
- integrity-aware messaging
- a clear compromised-backend threat model

## Why It Stands Out
- practical cybersecurity application
- strong demo value
- technically deep but understandable
- directly aligned with real-world privacy concerns

## Key Message for Judges
We did not build “just another chat app.”
We built a communication system where backend compromise does not automatically mean privacy compromise.

## Closing Line
Whispr rethinks secure messaging by assuming the server can fail, leak, or be attacked — and protecting user privacy anyway.

## Usage Note

Keep this file aligned with what has actually been built so the project story remains credible.
