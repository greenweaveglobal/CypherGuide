# RFC-0005: Documentation Lookup Assistant (Docs Assistant)

- **Status:** Draft
- **Author:** Cypher Guide Core Team
- **Date:** 2026-07-28
- **Related Modules:** `src/components/DocsAssistant.tsx`, `server.ts`

## Problem

Users and developers in the Cypher Guide ecosystem need a fast lookup tool for architecture specs, RFC guidelines, security maturity matrices, and source code structure. Unconstrained general LLMs risk hallucinations and may cause users to mistake AI output for official project statements.

## Considered Options

### Option A: Call Gemini API directly from Client-Side
- **Pros:** Preserves the 100% serverless/client-side philosophy of the Cypher Guide protocol.
- **Cons:** Exposes the API key in the client bundle or requires end users to enter their own API key.

### Option B: Build a small Server-Side Proxy for Gemini API with context-locked System Prompt
- **Pros:** Safely hides the API Key on the server (`process.env.GEMINI_API_KEY`). Allows embedding all official documentation (`RFC/*.md`, `ARCHITECTURE.md`, `MATURITY.md`) into the server-side System Prompt to strictly lock lookup scope.
- **Cons:** Introduces a small backend server dedicated to this lookup API.

## Recommendation

Choose **Option B**. Implement the `DocsAssistant.tsx` component coupled with a server-side proxy endpoint `/api/docs-assistant/query` in `server.ts`.

The endpoint's System Prompt must ingest all project documentation and enforce strict rules:
1. If the question cannot be answered from the provided documents, **it MUST respond: "Chưa có tài liệu về việc này"** (or "There is no documentation about this yet" when queried in English).
2. Never speculate or invent non-existent protocol mechanisms or policies.
3. Maintain an objective, neutral documentation-lookup tone.

## Security & Decentralization Trade-offs

- **Conscious Architectural Exception:** Creating a backend proxy for the Gemini API is a **conscious exception completely isolated from Layer 2 of the Cypher Guide protocol**. Core protocol functions (P2P booking, Nostr signatures, Lightning Network payments, escrow collateral) do not depend on this backend and remain 100% client-side.
- **UI Transparency & Naming:**
  - The UI must display a fixed, non-hideable disclaimer label: *"Automatic document lookup tool — not an official project spokesperson. Always cross-check with original RFC/code."*
  - Never use names like "Cypher AI Spokesperson" or "Official Representative".

## Proposed Maturity Tier

**Experimental** — This feature must undergo rigorous testing regarding its "no speculation" constraint before being promoted to Beta/Stable.
