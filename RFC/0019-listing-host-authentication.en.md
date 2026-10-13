# RFC-0019: Listing Host Authentication

- **Status:** Draft
- **Author:** Project Lead + Drafting AI
- **Date:** 2026-10-13
- **Related Modules:** `src/types.ts`, `src/components/HostRegistrationModal.tsx`, `src/utils/dynamicFee.ts`, `api/protocol/early-hosts.ts`

## Problem

Currently, the mechanism determining whether a host qualifies for the "Early Host Incentive" discount (RFC-0002: 1.0% / 100 pcm instead of the default 2.0% / 200 pcm) relies on `getPrimaryHostNpub(listing)`. This function extracts the `coOwners[].npub` holding the highest ownership share (`share`) from the listing's co-owners list.

However, in `HostRegistrationModal.tsx`, the `coOwners` list is freely editable by the user creating the listing (`npub: ''`), with zero verification of private key ownership for that `npub` at registration time.

Consequently, a security vulnerability exists:
- Anyone who knows the public `npub` of an enrolled Early Host can simply create a new listing, input that host's `npub` with `share: 100%`, and claim the 1% fee discount without the actual host's knowledge, consent, or signature.
- In essence, `getPrimaryHostNpub` is an unauthenticated, self-asserted string attribute.

Why is the status quo inadequate?
The Early Host Incentive was established to reward and onboard genuine pioneer hosts into CypherGuide. Allowing unverified npub spoofing undermines protocol fairness, violates the core Cypherpunk tenet ("Don't Trust, Verify"), and bypasses administrator cohort limits.

## Considered Alternatives

### Alternative A (Proposed): Cryptographic Host Listing Signature
When a Host submits a listing in `HostRegistrationModal`, the application uses the logged-in host's cryptographic key (in-vault key or NIP-07 browser extension) to sign a canonical listing payload (including `id`, `title`, `priceSats`, `coOwners`, and timestamp). The listing stores optional fields `hostPubkey` (64-char hex pubkey) and `listingSignature` (Schnorr / Nostr event signature).
- **Pros:**
  - Direct cryptographic verification of key ownership: An attacker cannot forge the signature without possessing the private key (nsec or NIP-07).
  - Tamper-proofing: Any post-signing tampering with listing content (e.g. swapping co-owners or price) invalidates the signature.
  - Seamless support for local vault keys and NIP-07 browser extensions (Alby, nos2x).
  - Discount is only activated if the signature is valid AND `hostPubkey` is present in the active early hosts enrollment list.
- **Cons:**
  - Requires a cryptographic signing step at listing registration. If the user lacks a key or refuses NIP-07 signing, the listing cannot be signed and thus cannot qualify for the Early Host discount.

### Alternative B: Enrolling Individual Listing IDs Instead of Host Pubkeys
Instead of enrolling a host's pubkey/npub, administrators directly whitelist individual listing IDs (`list_ABC123`) via the admin API.
- **Pros:**
  - Minimal implementation complexity: Simple membership check on `listing.id`.
  - Avoids adding Schnorr signing logic to the listing modal.
- **Cons:**
  - Rigid and non-scalable: If a pioneer host creates 5 listings, an administrator must review and whitelist all 5 individually.
  - Centralized dependency on admin whitelisting, degrading host self-sovereignty.

### Alternative C: Interactive Challenge-Response at Discount Redemption + Alternative A
When a guest initiates booking, the guest client or relay sends an ephemeral challenge to the host via Nostr DM or an ephemeral event, requiring real-time signature proof of liveness and key ownership.
- **Pros:**
  - Proves the host is actively online and controlling the key at the moment of booking.
- **Cons:**
  - Severe UX degradation: If the host is offline, booking fee calculation and checkout block.
  - High latency and vulnerability to network/mesh partitions.

## Proposal

Adopt **Alternative A**:
1. The `Listing` schema in `src/types.ts` is extended with optional fields:
   - `hostPubkey?: string;` (64-character hex string)
   - `listingSignature?: string;` (Schnorr / Nostr event signature JSON)
2. In `HostRegistrationModal.tsx`, when registering a listing:
   - The application computes a canonical listing payload string (incorporating `listingId`, `title`, `priceSats`, `coOwners`, and timestamp).
   - The host's identity key (`identity`) cryptographically signs the payload.
   - Sets `hostPubkey = identity.pubKeyHex` and `listingSignature = signature`.
   - If the host lacks a key or signing fails, a clear warning is displayed and the listing is flagged as ineligible for the Early Host incentive.
3. In `src/utils/dynamicFee.ts`:
   - `isEarlyHostEligible` accepts the `listing` as a parameter.
   - Qualification criteria for 1.0% fee:
     - The listing must contain valid `hostPubkey` and `listingSignature` matching the listing content.
     - The recovered `hostPubkey` must match an active enrolled host pubkey within its 365-day validity period.
     - Tampered listings immediately lose discount eligibility.
   - `getPrimaryHostNpub` is retained for UI display purposes but is **no longer a source of truth** for fee calculation.

## Known Residual Limitations

Two residual limitations remain by design:
1. **Client-Side Dynamic Fee Calculation:**
   - Fees are currently computed and settled client-side by the guest's browser calling `calculateDynamicFee` and paying the Treasury invoice. A modified client could theoretically bypass or underpay the Treasury fee (see in-depth architectural breakdown in Task 5 - `docs/FEE_ENFORCEMENT_ANALYSIS.md`).
2. **Sybil Resistance (Multiple npubs per person):**
   - Nostr is permissionless; any actor can generate multiple keypairs.
   - Mitigation: Managed via administrator vetting via NIP-98 authenticated APIs, combined with strict cohort limits (`maxEarlyHosts` / `maxEnrolled`) and enrollment duration (`durationDays`).

## Security & Decentralization Trade-offs

- **Who is trusted:**
  - Trust in standard Nostr secp256k1 Schnorr cryptography: No entity can forge a listing signature without the host's private key.
  - Trust in protocol administrators (Guardian Council / Admin) to properly vet enrolled host pubkeys.
- **Failure mode if trusted party misbehaves:**
  - If an admin improperly enrolls an unauthorized pubkey, that key only benefits from a 1-year fee discount and is publicly recorded via NIP-98 Audit Trail events on Nostr relays (Kind 27235).
  - No malicious third party can impersonate another host to siphon fee benefits.

## Proposed Maturity Tier

**Beta** (Applied across all newly created listings and covered by end-to-end regression tests).

## Discussion

*(Awaiting Project Lead review and formal approval before implementing Task 1b codebase modifications).*
