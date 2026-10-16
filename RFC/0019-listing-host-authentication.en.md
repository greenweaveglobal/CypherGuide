# RFC-0019: Listing Host Authentication

- **Status:** Draft
- **Author:** Project Lead + AI drafting assistant
- **Date:** 2026-10-13 (Standardization update: 2026-10-16)
- **Related Modules:** `src/types.ts`, `src/components/HostRegistrationModal.tsx`, `src/components/HostDashboard.tsx`, `src/components/ListingDetail.tsx`, `src/utils/dynamicFee.ts`, `api/protocol/early-hosts.ts`

## Problem

Previously, determining whether a host was eligible for the "Early Host Incentive" discount (RFC-0002: 1.0% / 100 pcm instead of the default 2.0% / 200 pcm) relied solely on `getPrimaryHostNpub(listing)`. This helper extracted the `coOwners[].npub` holding the highest ownership share (`share`).

However, the `coOwners` array could be populated arbitrarily by anyone creating a listing without proving private key ownership at the time of submission.

This introduced a vulnerability:
- Anyone knowing the public `npub` of an approved Early Host could create a fake listing, populate `coOwners` with that host's `npub` at `share: 100%`, and claim the 1% fee discount without the legitimate host's consent.
- `getPrimaryHostNpub` was merely a self-asserted string lacking cryptographic authentication.
- The legacy prefix-based signature format (`register_<id>_<title>_<price>_coOwners:...`) only verified basic parameters and omitted room types, descriptions, image hashes, and crucially, payout Lightning addresses. An attacker could clone a signed listing, modify the payout address, and retain discount eligibility.

## Installed Specification: NIP-78 Kind 30078 Signature Format

The system enforces Nostr event signatures per NIP-78 Kind 30078:

### 1. Nostr Event Structure
- **Kind:** `30078` (NIP-78 Arbitrary Custom App Data).
- **Pubkey:** Must strictly match `hostPubkey` in 64-character lowercase hexadecimal format.
- **Created_at:** Signature timestamp (seconds).
- **Mandatory Tags:**
  - `["d", "cypherguide:listing:<id>"]`: Unique listing identifier.
  - `["v", "1"]`: Signature schema version.
  - `["x", "<sha256_hash>"]`: SHA-256 hash of the canonicalized listing JSON (`canonicalizeListingForSigning`).
  - `["client", "cypherguide"]`: Client identifier tag.
- **Content:** The exact canonicalized JSON string (`canonicalJson`), deterministically serialized with alphabetically sorted keys (`deterministicStringify`) and no superfluous whitespace.

### 2. Fields Covered by Canonicalization (`canonicalizeListingForSigning`)
The cryptographic hash covers 9 critical fields:
1. `version`: Data schema version (currently `1`).
2. `id`: Listing ID.
3. `title`: Listing title.
4. `description`: Listing description.
5. `priceSats`: Base nightly room rate.
6. `roomTypes`: Array of room types (`id`, `name`, `priceSats`).
7. `coOwners`: Normalized co-owner array (bech32 `npub` decoded to 64-char lowercase hex, `share`, and lowercase `lightningAddress`). The array is lexicographically sorted by `npub` to ensure determinism regardless of input order.
8. `batchPayloadHash`: SHA-256 hash of the image gallery (URLs and NIP-94 image hashes).
9. `createdAt`: Listing creation timestamp.

### 3. Exact Matching Verification Workflow
`verifyListingHostSignature(listing)` executes rigorous checks:
1. Verifies presence of `hostPubkey` and `listingSignature`. Normalizes `hostPubkey` to lowercase hex.
2. Parses JSON in `listingSignature`. Rejects legacy raw strings with a clear error: `"cần ký lại bằng định dạng mới"`.
3. Verifies `event.pubkey === hostPubkey` (hex).
4. Verifies Schnorr signature with `verifyEvent(event)`.
5. Verifies `event.kind === 30078`.
6. Validates tags: `d` tag matches `cypherguide:listing:<listing.id>`, `v === '1'`, and `x` tag exists.
7. Recomputes canonical JSON via `canonicalizeListingForSigning` and derives SHA-256 hash.
8. Asserts exact match: `computedHash === hashTag` AND `event.content === expectedCanonical`. Any discrepancy returns `valid: false`.

The legacy `register_` prefix verification branch has been completely removed from production code.

## Listing Distribution

A clear architectural distinction must be made between cryptographic data signing and the distribution mechanism that delivers listings to guests:

- **Current Storage and Distribution Reality:** In the current codebase (`src/store/useAppStore.ts` lines 690-695 and `src/data.ts`), listings are stored within client application state and browser local persistence (`localStorage` via Zustand persist under `'cypher-travel-storage'`), seeded initially from `INITIAL_LISTINGS`. The system currently **does not have code to publish or subscribe to listing events on Nostr relays**.
- **Scope of Signature Validity:** At present, the NIP-78 digital signature strictly authenticates content integrity within the client's local scope (on the host's machine during management and on the guest's machine when viewing loaded listings). Decentralized broadcast, indexing, and discovery across the Nostr relay network is a future roadmap item.
- **Open Architectural Question:** *"How are listings distributed to guests, and who serves as the verifying party?"* (e.g., Do guests directly fetch events from public Nostr relays and verify Schnorr signatures locally in their browser, or is verification performed by an intermediary client/gateway/indexing server before returning curated results?).

## Signature Expiry & Revocation

Per the Nostr specification, Kind 30078 is a parameterized replaceable event (keyed by `pubkey` and the `d` tag). On compliant relays, a newer event with matching `pubkey` and `d` tag replaces earlier versions. However:
- Offline copies, client caches, or other relays may continue to retain the previously signed listing version.
- **Practical Consequence:** If a host updates their payout Lightning address (e.g., because a wallet private key was compromised or they migrated LNURL providers), the earlier signed listing (with the old payout address) remains a cryptographically valid proof if presented on a client that has not received the replacement event.
- **Potential Directions (framed as open questions, without pre-selecting or implementing):**
  1. *Add an expiration field:* Introduce an `expiresAt` (or `validUntil`) field into the canonical JSON and an `expiration` tag (NIP-40), requiring periodic re-signing (e.g., every 30 or 90 days).
  2. *Revocation / Tombstone Event:* Broadcast a designated host-signed Nostr tombstone event declaring a specific listing hash invalid.
  3. *Conditional Risk Acceptance:* Accept this risk during experimental phases because booking funds still route to the host's older wallet (not to an attacker), and resolve the issue definitively when relay-based distribution is engineered.

## Attack Vector Analysis Matrix

| Attack Scenario | Attacker Action | Cryptographic Defense | Verification Outcome |
|---|---|---|---|
| **1. Payout Address Substitution (Lightning Address Swapping)** | Attacker copies a genuine signed listing of a reputable host, but replaces `coOwners[].lightningAddress` with their own wallet address to intercept guest booking funds. | The `lightningAddress` of every co-owner is locked into the canonical JSON and the SHA-256 digest (`x` tag). | **Rejected (Invalid):** Data hash mismatch (`Listing data does not match signed hash`). Early Host incentive is immediately revoked. |
| **2. Price / Room Tampering** | Attacker or host modifies prices (e.g., 50,000 to 500 Sats), edits description, alters room types, or tampers with image URLs/hashes post-signing. | `priceSats`, `roomTypes`, `description`, and `batchPayloadHash` are all included in the signed payload. | **Rejected (Invalid):** Any modification alters the SHA-256 digest and breaks integrity. |
| **3. Verbatim Replay Attack** | Attacker copies the exact listing content and valid signature to redistribute (or publish on another client). | Because the signature cryptographically binds the genuine host's Lightning address and co-owners, payments route exclusively to the legitimate host. | **Zero Economic Incentive:** Attacker receives no funds; booking revenue flows to the genuine host's wallet. |
| **4. Key Spoofing / Impersonation** | Attacker generates a listing, signs it with their own private key, but sets `hostPubkey` to the pubkey of an enrolled Early Host. | Verification asserts `event.pubkey === hostPubkey`. | **Rejected (Invalid):** Event signer does not match the claimed `hostPubkey`. |
| **5. Legacy Signature Replay** | Attacker submits a raw string `register_...` or legacy JSON event to claim discounts. | Legacy verification branches have been eliminated; only NIP-78 Kind 30078 is accepted. | **Rejected (Invalid):** Returns clear error requiring re-signing with the current format. |

## Known Residual Limitations

Three structural limitations are acknowledged:
1. **Verbatim Replay:** While the attacker cannot redirect payments, when relay-based distribution is introduced in the future, verbatim duplication could pollute search feeds if relays or clients do not implement deduplication based on the `d` tag and the original author's public key.
2. **Fresh Fraudulent Listings:** Digital signatures authenticate content integrity by the key holder; they do not prevent a stranger from signing an entirely fabricated property with their own private key. Real-world veracity relies on portable reputation (RFC-0003), Proof-of-Stay reviews, and community audits.
3. **Enrollment Authority:** Enrolling hosts into `earlyHosts` remains under the authority of protocol administrators, rather than fully automated on-chain consensus.

## Security & Decentralization Trade-offs

- **Who is trusted:**
  - Standard Nostr Schnorr cryptography (secp256k1).
  - Protocol administrators when reviewing host eligibility before enrollment.
- **Failure mode if trusted party misbehaves:**
  - If an admin erroneously enrolls a non-eligible host, the discount applies for a maximum of the configured duration (default 12 months). Note that Kind 27235 is an ephemeral HTTP authentication event per NIP-98 (used in the `Authorization` header for admin access control), not a persistent on-relay audit record. In the current codebase (`api/protocol/early-hosts.ts`), attaching an audit event (`auditEvent`) in the request body is optional; if provided, the server attempts a best-effort broadcast to relays without guaranteed delivery or mandatory on-relay audit enforcement for all actions. An immutable, mandatory on-relay audit log is a future roadmap item.
  - No party can forge another host's signature to steal discounts or hijack payments.

## Host Experience & Re-signing Workflow

- When a host edits listing details (Extranet / Calendar / Rates), the previous signature expires by design.
- The interface provides a **"Re-verify Listing"** button in `ListingDetail` (for host view) and `HostDashboard` (My Listings tab).
- Warning banners are shown exclusively to the host. Guests do not see warning badges, and unverified listings do not receive the discounted fee rate.
- If a host rejects a NIP-07 extension prompt, a clear notification is displayed without altering or discarding the listing.

## Proposed Maturity Tier

**Experimental** (No real hosts onboarded yet, not tested in a production environment. Conditions to reach Beta: real hosts successfully enrolled and operating stably over an observation period, accompanied by an independent review of security limitations).

## Discussion

*(Awaiting feedback and final approval from Project Lead).*
