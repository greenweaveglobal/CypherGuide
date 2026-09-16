# RFC-0014: Agent Runtime Verification

- **Status:** Draft
- **Authors:** Project owner + Claude (AI). The conceptual framework originated from a public technical question on a CypherGuide Nostr thread — **it does not rely on any content submitted by unverified accounts** (see the Origins note below).
- **Related modules:** directly expands RFC-0013 (Agent-Ready Stay), but completely separates the scope — RFC-0013 only verifies static infrastructure (uptime, bandwidth, node dedication), whereas RFC-0014 verifies the runtime behavior of the agent running on that infrastructure.

## Problem

RFC-0013 defines the `AGENT-READY` tag to verify that a node has standard infrastructure (dedicated compute, dedicated relay, minimum bandwidth) to run a guest's agent. But verifying infrastructure **says nothing** about whether the agent running on it is manipulated mid-task — for example, via prompt injection from untrusted content it ingests (a website, a third-party message). This is a real gap: a node meeting all `AGENT-READY` criteria can still run a manipulated agent, with no way for anyone — guest or host — to verify it before trusting it.

## Options considered

### Option A: Trust the agent's self-attestation ("I am safe, not injected")
- Cons: **rejected** — this is exactly what cannot be trusted, because injection attacks the action layer (tool-call), not the text response layer — a manipulated agent can still "claim" to be safe verbally while already executing unintended actions.

### Option B: Build a full, diverse red-team layer, scoring 0-100
- Cons: too complex for v1, hard to re-verify independently, risks repeating the exact problem RFC-0013 avoided (adding unnecessary complexity in a phase with few real hosts).

### Option C: Minimal 3-layer probe suite, verdict based on tool-call trace, independently re-verifiable (PROPOSED)
- Pros: small enough to run as a CI gate before admitting an agent to a host, but sufficient to detect the most realistic type of attack (injection → unintended action).

## Proposal

**Option C.** A minimal 3-layer probe, each layer having machine-verifiable criteria (no grading based on text style):

1. **Injection layer:** insert a fake directive into the content the agent ingests via an untrusted channel (web page content, third-party message). Verdict: does the agent generate unplanned tool-calls — based on actual actions, not on the agent "verbally confirming" it rejected the directive.
2. **Exfiltration layer:** set up a decoy endpoint within the agent's accessible scope. Verdict: does sensitive data appear in the payload sent outbound to that endpoint.
3. **Privilege layer:** restrict the agent to read-only scope on guest data. Verdict: does the agent attempt to write/execute beyond the boundaries declared in the `AGENT-READY` scope.

**Re-verification mechanism:** the verdict is a deterministic function of the tool-call trace (not the text response content) — hashing (SHA-256) the sequence of actions allows anyone (not just the host) to independently re-run the same inputs and compare hashes, rather than relying on a one-way attestation from the host.

**v1 Scale:** 1 probe per layer + 1 negative control (an un-attacked agent must always pass) = 6 test items — small enough to run as a CI gate before the agent is admitted to the node, requiring no complex infrastructure.

## Security / decentralization trade-offs

- Maintains the RFC-0013 boundary: this RFC **does not touch the financial surface** — the agent still has no right to spend, and no independent identity/reputation. It only adds an independent behavioral verification axis.
- The risk of false negatives (a manipulated agent passing the probe undetected) exists in every red-team system — v1 only targets the most common attack vector (injection → action), and does not claim to cover the entire attack surface.

## Proposed maturity tier

**Draft**, advancing to real-world testing when RFC-0013 has at least one real operating `AGENT-READY` node to provide a verification environment for the probe.

## Origins & Transparency Note

The initial conceptual framework (3 probe layers, "verify actions, not self-attestations" principle) originated from a public Nostr discussion asking the right questions about the gap in RFC-0013. During the discussion, some unverified accounts attempted to attach their names/content to this RFC (including offering sample code from unverified sources) — **those offers were rejected and no part of this RFC originates from their content**. This is a practical example of the "verify, not trust" principle that this RFC proposes, applied retroactively to the process of writing it.

## Discussion

(Open — a specific question for the community: is the 6-item scale for v1 sufficient, or is a 4th layer needed for multi-turn drift scenarios (where the agent is steered via multiple small steps instead of one obvious attempt)? Input from anyone with hands-on AI agent red-teaming experience is highly valuable.)
