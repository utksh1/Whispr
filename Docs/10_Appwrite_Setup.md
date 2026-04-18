# Whispr — Appwrite Setup

Whispr's product app (`/app`) uses Appwrite for account sessions and document storage.

## Project

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=69e2ba2700132ed5d552
NEXT_PUBLIC_APPWRITE_PROJECT_NAME=Whispr
NEXT_PUBLIC_APPWRITE_DATABASE_ID=whispr
NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID=users
NEXT_PUBLIC_APPWRITE_USER_KEYS_COLLECTION_ID=user_keys
NEXT_PUBLIC_APPWRITE_PRIVATE_KEY_BACKUPS_COLLECTION_ID=private_key_backups
NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID=messages
```

These values are public client configuration. Do not put Appwrite API keys in `NEXT_PUBLIC_*` variables.

## Required Appwrite Console Settings

Before login works from the browser, configure these in the Appwrite console:

### 1. Add Web Platforms

Add your frontend origins as Appwrite Web platforms.

Recommended:
- `http://localhost:3000`
- `https://whispr-client-utksh1.vercel.app`

If you use a different Vercel preview or custom domain, add that exact origin too.

### 2. Enable Email/Password Auth

In Appwrite Auth settings, make sure email/password login is enabled for the project.

### 3. Common Browser Error

If Whispr shows `Failed to fetch` on login, the most common causes are:
- the site origin was not added as an Appwrite Web platform
- the browser is trying to log in from a domain Appwrite does not trust yet
- the user typed a username into the email field instead of an email address

Whispr login currently uses:
- email
- password

It does not support username-only login on the Appwrite auth step.

## Required Database

Create a database with ID `whispr`.

The web SDK can authenticate users and create documents, but it cannot create database schema safely without a server API key. Create these collections in the Appwrite console or provide a server-only API key later for automated provisioning.

Schema blueprint file:
- [appwrite/whispr-schema.blueprint.json](/Users/Utkarsh/Desktop/Projects/Whispr/appwrite/whispr-schema.blueprint.json)
- [appwrite/bootstrap.mjs](/Users/Utkarsh/Desktop/Projects/Whispr/appwrite/bootstrap.mjs)

This blueprint mirrors the required Appwrite database structure so you do not have to reconstruct the schema by hand from scratch.

## Automatic Bootstrap Script

Once you have an Appwrite server API key, you can create the database and collections automatically.

Required env vars:

```bash
export APPWRITE_ENDPOINT="https://nyc.cloud.appwrite.io/v1"
export APPWRITE_PROJECT_ID="69e2ba2700132ed5d552"
export APPWRITE_API_KEY="your_server_api_key"
```

Run:

```bash
node appwrite/bootstrap.mjs
```

Optional:

```bash
export APPWRITE_BLUEPRINT_PATH="/absolute/path/to/appwrite/whispr-schema.blueprint.json"
export APPWRITE_RESPONSE_FORMAT="1.8.0"
```

Recommended Appwrite API key scopes:
- `databases.read`
- `databases.write`

What the script does:
- creates database `whispr` if missing
- creates collections `users`, `user_keys`, `private_key_backups`, and `messages`
- creates attributes from the schema blueprint
- waits for asynchronous attributes and indexes to become available
- creates indexes from the schema blueprint
- safely skips resources that already exist

## Appwrite MCP Servers

Appwrite also offers Model Context Protocol (MCP) servers that let LLM tools interact with Appwrite APIs and documentation in a structured way.

### What MCP is

The Model Context Protocol is an open standard that allows AI assistants and code-generation tools to work with external systems through structured tools instead of plain text only.

For Appwrite, that means an MCP-enabled client can:
- inspect Appwrite API capabilities
- look up the latest Appwrite documentation
- help generate integration code
- assist with project operations in natural language

### Available Appwrite MCP servers

Appwrite's MCP offering includes:
- Appwrite API MCP server
- Appwrite docs MCP server

These are useful in tools such as Claude Desktop, Cursor, and Windsurf when you want AI help that is grounded in Appwrite's APIs and docs.

### Why this matters for Whispr

For this project, Appwrite MCP can help with:
- looking up Auth and Databases usage while building the `/app` flow
- validating collection and attribute expectations against Appwrite docs
- generating or refining Appwrite integration code
- debugging setup problems without relying on stale SDK examples

### Safety note

If you use an Appwrite MCP server with Whispr:
- keep server API keys out of `NEXT_PUBLIC_*` variables
- prefer local MCP client configuration or other server-only secret storage
- treat MCP access as privileged if it can mutate Appwrite project resources

Whispr's browser app should continue to use only the public Appwrite endpoint, project ID, and collection IDs exposed in this document.

## Collections

Enable document security on every collection and allow authenticated users to create documents where noted.

### `users`

Purpose: public-safe user discovery and active public key lookup.

Attributes:
- `userId` string, required
- `username` string, required
- `usernameLower` string, required
- `email` string, required
- `publicKey` string, optional
- `activePublicKeyId` string, optional
- `hasPublicKey` boolean, required
- `hasPrivateKeyBackup` boolean, required
- `updatedAt` string, required

Indexes:
- unique index on `usernameLower`
- key index on `userId`
- key index on `usernameLower`

Permissions:
- create: authenticated users
- document reads: authenticated users
- document update/delete: owner user

### `user_keys`

Purpose: historical public keys by deterministic key id.

Attributes:
- `keyId` string, required
- `userId` string, required
- `username` string, required
- `publicKey` string, required
- `isActive` boolean, required
- `revokedAt` string, optional
- `updatedAt` string, required

Indexes:
- key index on `keyId`
- key index on `userId`

Permissions:
- create: authenticated users
- document reads: authenticated users
- document update/delete: owner user

### `private_key_backups`

Purpose: encrypted keyring backup material.

Attributes:
- `userId` string, required
- `ciphertext` string, required
- `salt` string, required
- `iv` string, required
- `version` string, required
- `updatedAt` string, required

Permissions:
- create: authenticated users
- document read/update/delete: owner user only

Security rule: this collection never stores plaintext private keys.

### `messages`

Purpose: ciphertext-only message storage.

Attributes:
- `conversationKey` string, required
- `participantIds` string array, required
- `senderId` string, required
- `receiverId` string, required
- `senderUsername` string, required
- `receiverUsername` string, required
- `senderKeyId` string, required
- `receiverKeyId` string, required
- `ciphertext` string, required
- `nonce` string, required
- `salt` string, required
- `version` string, required
- `tampered` boolean, required
- `createdAt` string, required

Indexes:
- key index on `conversationKey`
- key index on `createdAt`
- key index on `participantIds`

Permissions:
- create: authenticated users
- document reads: sender and receiver users only
- document update/delete: sender user only

## Current Scope

The `/app` route now uses Appwrite Auth and Appwrite Databases directly from the browser. The `/demo` route and Express server remain available for the hackathon explanation flow and Swagger docs.

Full production hardening can add a small server/Appwrite Function later to enforce username uniqueness, collection provisioning, rate limits, and stricter message write validation.
