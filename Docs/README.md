# Whispr Documentation

This directory contains the design and planning documents for Whispr.

## How To Read These Docs

The docs in this folder are a mix of:

- product and problem framing
- target architecture and API design
- security model and threat assumptions
- implementation roadmap
- demo and pitch material

Not every design described here is fully implemented in the current codebase.

When a document describes intended behavior that does not yet exist in code, it should be written as a target design rather than as an already-shipped feature.

## Document Map

- `01_Project_Overview.md`: project summary, vision, and value proposition
- `02_Problem_Statement.md`: security and privacy problem definition
- `03_Core_Features.md`: must-have, good-to-have, and demo-facing features
- `04_System_Architecture.md`: target system structure and trust boundaries
- `05_Cryptography_Security_Flow.md`: intended cryptographic flow and trust assumptions
- `06_Threat_Model.md`: attacker capabilities, out-of-scope items, and mitigations
- `07_Tech_Stack.md`: selected technical direction
- `08_Database_Design.md`: target storage schema and design principle
- `09_API_Design.md`: target backend API and realtime events
- `10_Development_Roadmap.md`: phased implementation plan
- `11_Demo_Flow.md`: suggested product demonstration sequence
- `12_Pitch_Notes.md`: presentation and judging narrative

## Documentation Rules

- Keep docs aligned with the codebase.
- Mark planned or target behavior clearly.
- Avoid presenting future work as already implemented.
- Update linked documents together when changing architecture, crypto, storage, or API contracts.
- Prefer technical precision in engineering docs.
- Keep pitch-oriented language in pitch docs, not implementation docs.

## When To Update Docs

Update the relevant file in this directory when changing:

- trust assumptions
- cryptographic design
- message format
- authentication behavior
- database schema direction
- API contracts
- roadmap scope

## Suggested Maintenance Flow

1. Change code.
2. Update the matching technical doc.
3. Update `README.md` or `CONTRIBUTING.md` if contributor-facing behavior changed.
4. Verify the docs still distinguish current implementation from target architecture.
