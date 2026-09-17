---
hip: 0000
title: CLPR Canonical Asset Transfer Standard
author: Schayan Salehi (@shayansal)
working-group:
requested-by:
discussions-to:
type: Standards Track
category: Application
needs-hiero-approval: No
needs-hedera-review: No
status: Draft
created: 2026-09-02
updated: 2026-09-02
requires: 1535
replaces:
superseded-by:
release:
---

## Abstract

This HIP defines a canonical asset identity, transfer envelope, adapter interface, and supply-accounting model for
moving fungible assets through the Cross Ledger Protocol (CLPR) specified by HIP-1535. CLPR can authenticate
arbitrary messages but intentionally does not assign financial meaning to payload bytes. Without an asset standard,
independent applications may create incompatible representations of the same asset, apply inconsistent decimal or
issuer controls, and implement lock, burn, mint, release, and recovery paths whose combined supply cannot be
audited.

The proposed standard gives every asset an origin-bound `AssetID` and lets the asset authority publish approved
representations and adapters. It supports issuer burn/mint, escrow lock/mint, and escrow lock/release while exposing
the distinct trust and solvency assumptions of each mode. Transfers use a typed, replay-resistant envelope and a
state machine that separates source finality, destination execution, acknowledgement, and exceptional recovery.
Destination adapters enforce idempotency, supply invariants, rate policies, exact recipient semantics, and explicit
hook behavior. Timeout alone never authorizes a refund when destination execution may still be possible.

This HIP is an Application standard and requires no change to CLPR proof verification. It is intended to prevent
wrapped-asset fragmentation, make cross-ledger liabilities auditable, and provide a safe settlement primitive for
stablecoins, tokenized deposits, securities, funds, commodities, and other real-world or crypto-native assets.

## Motivation

An authenticated message is not an authenticated asset. A financial application must additionally establish:

- which ledger and issuer define the original asset;
- which destination representation is canonical;
- who may mint, burn, freeze, recover, or upgrade that representation;
- how decimals and transfer amounts are interpreted;
- whether destination supply is backed by a source burn, escrow, issuer liability, or liquidity provider;
- how aggregate outstanding supply and escrow can be reconciled;
- how duplicate delivery, reorganization, timeout, hook failure, and Channel quarantine are handled; and
- which compliance rules follow the asset across ledgers.

If each bridge or application answers these questions independently, one economic asset fragments into several
non-fungible wrappers and pools. Liquidity then becomes shallower, integrations multiply, and an incident in one
adapter may contaminate downstream applications that display every representation under the same ticker.

This HIP defines a common asset and transfer layer so that issuers, custodians, wallets, exchanges, market makers,
and applications can reason about the same representation graph and verify conservation of supply.

## Rationale

**Asset identity is origin- and authority-bound.** Symbols and contract addresses are not globally unique. The
identity commits to the origin ledger instance, origin asset reference, and asset authority.

**Issuer-native burn/mint is preferred when available.** It avoids accumulating pooled bridge collateral and gives
the issuer one supply authority across supported ledgers. It does not eliminate issuer trust, which is disclosed as
part of the asset policy.

**Escrow modes remain supported.** Many assets cannot be burned by an interoperability adapter. Lock/mint and
lock/release are therefore standardized with explicit backing, cap, custody, and recovery rules rather than hidden
behind a common `bridged` label.

**A timeout is not proof of non-execution.** Automatically refunding a source transfer after a wall-clock timeout
can create unbacked destination supply if the delayed message later executes. Recovery requires cryptographic proof
of non-execution, a destination-side cancellation committed before execution, or an asset-authority reconciliation
procedure that accounts for both ledgers.

**Hooks are subordinate to asset safety.** Transfer and arbitrary destination calls have different failure risks.
The sender chooses whether a hook is atomic with the transfer or best-effort, and the choice is committed in the
signed envelope.

## User stories

- As an **issuer**, I want one canonical identity and approved representation graph so that third-party wrappers
  cannot be mistaken for issuer-backed assets.
- As a **wallet**, I want to distinguish native, issuer-minted, escrow-backed, and synthetic representations.
- As a **custodian**, I want on-ledger liabilities to reconcile against locked collateral without trusting an
  indexer's private database.
- As an **application**, I want one typed transfer envelope with deterministic replay and hook semantics.
- As a **market maker**, I want interchangeable canonical representations so liquidity does not fragment by bridge.
- As an **auditor**, I want supply and escrow invariants that can be independently reconstructed across ledgers.

## Specification

### 1. Roles

- **Asset Authority** — the origin-defined authority that registers canonical representations and policies. It may
  be an issuer, protocol governance mechanism, or immutable origin contract.
- **Origin Asset** — the asset whose authority and primary reference define the `AssetID`.
- **Representation** — an authorized instance of the asset on a particular ledger.
- **Adapter** — the application that validates envelopes and performs burn, mint, lock, release, or transfer.
- **Escrow** — on-ledger custody holding backing assets for a representation or route.
- **Transfer Initiator** — the account authorizing source-side value movement.
- **Recipient** — the exact destination account receiving value.
- **Recovery Authority** — an optional authority constrained by the registered recovery policy.

### 2. Canonical encoding and AssetID

All identifiers use deterministic binary encoding with explicit lengths and domains. Implementations MUST reject
non-canonical integer encodings, duplicate map keys, unknown required fields, and ambiguous address formats.

```text
AssetID = SHA-256(
    "CLPR_ASSET_V1" ||
    origin_ledger_instance_id ||
    origin_asset_namespace ||
    origin_asset_reference ||
    asset_authority_hash
)
```

`origin_asset_namespace` and `origin_asset_reference` SHOULD use CAIP-19 where an applicable namespace exists. The
`origin_ledger_instance_id` prevents an identically addressed asset on a fork or lookalike network from inheriting
the identity. `asset_authority_hash` commits to the authority and its change policy; changing the authority outside
that precommitted policy creates a new `AssetID`.

Ticker, name, logo, and decimal display metadata are non-authoritative. Amounts are always encoded in the origin
asset's smallest indivisible unit. A representation with different local decimals MUST use a registered exact
conversion rule and MUST reject any transfer that would require silent rounding.

### 3. Asset registration

An `AssetRegistration` contains:

| Field | Semantics |
|---|---|
| `asset_id` | Canonical identifier derived in §2. |
| `origin_binding` | Origin ledger instance, asset reference, executable code hash or native token identifier. |
| `authority_policy` | Authority identities, thresholds, timelocks, and permitted changes. |
| `metadata_hash` | Content hash of human-readable metadata. |
| `decimals` | Canonical smallest-unit exponent. |
| `control_policy` | Mint, burn, pause, freeze, KYC, clawback, and recovery capabilities. |
| `representations` | Authorized representation records indexed by ledger instance. |
| `global_limits` | Optional issuer-wide outstanding and flow caps. |
| `reconciliation_policy_hash` | Content hash of supply-audit and exceptional-recovery procedures. |

Registration is permissionless at the protocol level but is canonical for an asset only when authorized by the
origin `authority_policy`. Registries and wallets MUST preserve unauthorized registrations as distinct claims and
MUST NOT infer authority from ticker ownership or first registration.

### 4. Representation records

Each representation record commits to:

- destination `LedgerInstanceID`;
- local token or account identifier;
- representation executable code hash and upgrade policy;
- adapter identifier and code hash;
- transfer mode from §5;
- mint, burn, lock, release, freeze, and recovery authorities;
- decimal conversion rule;
- route and outstanding-supply caps;
- required financial security profile;
- required compliance policy, if any; and
- activation, deprecation, and terminal times.

A wallet MUST display the transfer mode and controlling authority. Two representations with the same `AssetID` are
not automatically fungible if their authority, backing, transfer restrictions, redemption right, or recovery
policy differs.

### 5. Transfer modes

#### 5.1 `ISSUER_BURN_MINT`

The source adapter permanently burns or retires units under the Asset Authority's policy. The destination adapter
mints the same canonical amount only after a final CLPR proof. Aggregate minted amount MUST NOT exceed aggregate
final source burns minus finalized reverse burns and reconciled corrections.

This mode has no pooled bridge escrow but depends on the issuer's mint/burn authority and solvency.

#### 5.2 `ESCROW_LOCK_MINT`

The source adapter locks origin units in a route-specific or globally accounted escrow. The destination adapter
mints a representation. Outstanding destination supply plus pending unlocks MUST NOT exceed finalized source escrow
less finalized releases, subject to the registered conversion rule.

Escrow withdrawals unrelated to proven reverse transfers are prohibited. Administrative migration requires a
published liability snapshot and an atomic or provably ordered handover.

#### 5.3 `ESCROW_LOCK_RELEASE`

Canonical or pre-funded units exist on both ledgers. The source locks units and the destination releases units from
its escrow after proof. The reverse direction may later rebalance the escrows. A release MUST NOT exceed the
destination route's available unlocked inventory.

This mode transfers inventory risk to the escrow operator and can provide fast settlement without mint authority.

#### 5.4 Unsupported equivalence

Purely synthetic, oracle-priced, debt, derivative, or algorithmic representations MUST NOT use one of the above
backing labels unless they satisfy its invariant. They may register a distinct representation type under a future
extension and must not be displayed as redeemable 1:1 without an enforceable redemption claim.

### 6. AssetTransferEnvelope

```text
AssetTransferEnvelope {
    version
    transfer_id
    asset_id
    representation_id
    transfer_mode
    source_ledger_instance_id
    destination_ledger_instance_id
    source_channel_id
    source_adapter
    destination_adapter
    sender
    recipient
    amount
    source_nonce
    valid_after
    valid_until
    maximum_destination_cost
    security_profile_id
    compliance_policy_hash       // optional
    hook_mode                    // NONE, ATOMIC, or BEST_EFFORT
    hook_target                  // optional
    hook_payload_hash            // optional
    hook_gas_limit               // optional
}
```

```text
TransferID = SHA-256("CLPR_ASSET_TRANSFER_V1" || canonical_envelope_without_transfer_id)
```

The initiator signs `TransferID` using a domain that includes both ledger instances and the source adapter. The
source adapter verifies the signature, account authority, nonce, amount, deadline, representation status, security
profile, and compliance policy before changing value state.

Recipient substitution is forbidden after source authorization. An adapter MUST reject zero or ambiguous
recipients, unsupported address encodings, silent decimal truncation, and a destination instance that differs from
the Channel's authenticated peer.

### 7. Transfer lifecycle

Each source transfer has one of these states:

| State | Meaning |
|---|---|
| `INITIATED` | Envelope validated; source state change not yet final. |
| `SOURCE_FINAL` | Burn or lock is final and the CLPR message may execute. |
| `DESTINATION_EXECUTED` | A verified destination receipt records successful mint, release, or transfer. |
| `COMPLETED` | Source received and finalized the unique destination receipt. |
| `CANCELLED_BEFORE_FINALITY` | Source operation was cancelled before burn/lock became final; destination execution is impossible. |
| `RECOVERY_PENDING` | Normal completion cannot be proven; the registered reconciliation procedure is active. |
| `RECOVERED` | Asset Authority finalized a correction with an auditable cross-ledger record. |
| `QUARANTINED` | Bound Channel or adapter was quarantined; no normal execution or automatic refund may proceed. |

The normal sequence is:

1. Validate and sign the envelope.
2. Atomically burn or lock source units and write `SOURCE_FINAL` with the envelope hash.
3. Send the typed envelope through the profile-bound CLPR Channel.
4. Verify CLPR proof, profile, limits, representation, and adapter on the destination.
5. Atomically reserve destination limits, record `TransferID`, and mint, release, or transfer.
6. Emit a destination receipt containing the resulting transaction identifier and amount.
7. Return the receipt through CLPR and mark the source transfer `COMPLETED` exactly once.

An adapter MUST process a duplicate successful envelope as an idempotent receipt lookup, not as another asset
operation. A conflicting envelope with the same nonce or `TransferID` is rejected.

### 8. Conservation and reconciliation

Every adapter publishes sufficient state for an independent reconciler to compute, per asset, representation,
route, and epoch:

- cumulative finalized burns;
- cumulative finalized mints;
- current escrow balance;
- cumulative releases and reverse locks;
- pending source-final transfers;
- pending destination receipts;
- recovered or administratively corrected amounts; and
- current cap and guard consumption.

Implementations MUST use monotonically increasing counters in addition to current balances so temporary movement
cannot erase audit history. Reconciliation roots SHOULD be emitted periodically and MUST be bound to exact ledger
consensus times.

The following invariants are mandatory:

```text
ISSUER_BURN_MINT:
    destination_minted <= finalized_source_burned - finalized_reverse_burned + authorized_corrections

ESCROW_LOCK_MINT:
    synthetic_outstanding + pending_unlocks <= finalized_source_escrow + authorized_corrections

ESCROW_LOCK_RELEASE:
    cumulative_releases <= opening_inventory + finalized_inbound_rebalances
```

Corrections are never implicit. Each correction references the affected transfer IDs, authority decision, reason,
and before/after reconciliation roots.

### 9. Timeout, cancellation, and recovery

Expiry prevents an unexecuted destination adapter from newly accepting the envelope after `valid_until`; it does
not prove that the envelope did not execute before expiry. A source refund after `SOURCE_FINAL` requires one of:

1. a final destination proof that the transfer entered a terminal non-executable state before any value action;
2. a precommitted two-ledger cancellation protocol whose destination cancellation is final before source refund;
   or
3. the registered exceptional-recovery process, which first reconciles destination supply and can freeze or burn
   any conflicting representation before restoring source value.

Channel unavailability, missing response, endpoint failure, or local wall-clock timeout is insufficient. This rule
prevents simultaneous source refund and destination mint/release.

### 10. Destination hooks

`NONE` performs only the asset operation. `ATOMIC` reverts the asset operation if the hook fails. `BEST_EFFORT`
commits the asset operation and reports hook success or failure separately. The sender signs the mode, target,
payload hash, and gas limit.

Adapters MUST update replay, limit, and accounting state before external interaction and MUST use reentrancy guards.
Hook targets MUST authenticate the source ledger, source adapter, AssetID, TransferID, sender, and amount. A hook
cannot redirect the asset transfer unless the redirection was part of the signed envelope.

### 11. Compliance and restricted assets

An Asset Authority may bind a representation to a content-addressed compliance policy covering KYC, sanctions,
jurisdiction, investor eligibility, holding periods, transfer agents, freeze, or clawback. The policy identifies
the attestation issuers and disclosure behavior. Personally identifying information SHOULD remain off-ledger; the
envelope carries only the minimum attestation references or commitments necessary for enforcement.

Compliance controls are asset-specific and do not grant the CLPR Service a universal censorship role. Wallets and
applications MUST disclose restrictions before source authorization.

### 12. Upgrades and migration

Representation or adapter upgrades require a new content hash and activation epoch under the registered authority
policy. In-flight transfers remain bound to the old adapter until completed or reconciled. Migration MUST NOT
permit both old and new adapters to independently mint or release against the same backing capacity.

Deprecation stops new source transfers first, allows safe completions, publishes a final reconciliation root, and
then removes old authority. A suspected verifier or adapter compromise uses immediate quarantine rather than
graceful completion.

### 13. Impact on Mirror Node

Mirror Nodes SHOULD index registrations, representations, transfer states, receipts, accounting counters,
reconciliation roots, corrections, cap changes, and quarantine events. APIs must retain the exact
`LedgerInstanceID`, code hashes, and authority epoch associated with historical events.

### 14. Impact on SDK

SDKs SHOULD implement canonical encoding, AssetID and TransferID derivation, authority verification,
representation discovery, human-readable backing labels, transfer simulation, hook construction, and
reconciliation queries. SDKs MUST NOT treat matching symbols as matching assets.

## Backwards Compatibility

This HIP is opt-in and does not change arbitrary CLPR messages or existing token behavior. Legacy bridges and
wrappers may register only if their authority and backing can satisfy the standard; registration does not alter
their existing contracts.

Applications can support legacy representations alongside conforming ones, but must not present them as equivalent
without an explicit fungibility and redemption analysis.

## Security Implications

- **Verifier compromise can create false source events.** Financial security profiles, value guards, quarantine,
  and issuer-wide caps are required defense-in-depth; they cannot repair value already irreversibly released.
- **Adapter compromise is supply compromise.** Adapters should be minimal, content-addressed, independently
  audited, and isolated by route and asset where practical.
- **Escrow creates concentrated custody risk.** Lock-based modes must publish custody, upgrade, withdrawal, and
  insolvency assumptions.
- **Issuer burn/mint preserves issuer trust.** It removes pooled bridge collateral but not malicious or compromised
  issuer authority.
- **Timeout refunds can inflate supply.** They are forbidden without final non-execution evidence or reconciled
  recovery.
- **Decimals can create hidden loss or inflation.** Conversion must be exact and tested at integer boundaries.
- **Compliance authorities can freeze or claw back assets.** Their powers must be committed in registration and
  surfaced to users.
- **Representation labels are attack surfaces.** Wallets should derive identity from `AssetID` and authority, not
  ticker, name, logo, or an unverified registry entry.

## How to Teach This

Explain the standard with three questions:

1. **What is the asset?** `AssetID` identifies its origin and authority.
2. **What backs this representation?** The transfer mode identifies burn/mint or an exact escrow relationship.
3. **Can supply be reconciled?** Counters and roots make every mint, burn, lock, release, and correction auditable.

CLPR proves the source state. The asset adapter decides what that proven state means for supply. A canonical name
does not make weak backing safe.

## Reference Implementation

A reference implementation should provide:

- deterministic protobuf or XDR schemas and cross-language vectors;
- a Hiero Token Service adapter;
- an EVM adapter for each transfer mode;
- an issuer-authorized asset and representation registry;
- Value Guard integration;
- a cross-ledger reconciliation indexer; and
- invariant, fuzz, reentrancy, migration, quarantine, and double-execution tests.

The reference implementation should begin with capped test assets and increase limits only after independent audit
and adversarial operation on public test networks.

## Rejected Ideas

- **Ticker-based canonical identity.** Rejected because tickers are neither unique nor authoritative.
- **One universal wrapped representation controlled by CLPR governance.** Rejected because CLPR is a messaging
  protocol and should not become the issuer or custodian of every asset.
- **Treating all transfer modes as equivalent.** Rejected because issuer, escrow, and inventory risks differ
  materially.
- **Automatic refund after timeout.** Rejected because absence of a timely response is not proof of destination
  non-execution.
- **Arbitrary post-transfer calls with implicit semantics.** Rejected in favor of signed, gas-bounded, explicit
  atomic or best-effort hooks.
- **A mandatory protocol token for fees or backing.** Rejected because it adds unrelated price and governance risk
  and impedes issuer adoption.

## Open Issues

- The canonical encoding should follow the final HIP-1535 wire-format decision.
- Native asset standards differ in how burn and escrow evidence can be state-proven; each reference adapter needs a
  ledger-specific annex.
- Efficient proofs of cross-ledger aggregate supply may use periodic recursive or zero-knowledge proofs, but those
  optimizations must preserve inspectable base counters.
- Non-fungible assets and semi-fungible positions require a separate extension because their identity and partial-
  transfer semantics differ materially from fungible supply accounting.

## References

- [HIP-1535: CLPR](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/spec/HIP/hip-1535.md)
- [CAIP-19: Asset Type and Asset ID Specification](https://chainagnostic.org/CAIPs/caip-19)
- [Circle Cross-Chain Transfer Protocol](https://developers.circle.com/cctp)
- [ERC-7802: Token with Mint/Burn Access Across Chains](https://eips.ethereum.org/EIPS/eip-7802)
- [ERC-7786: Cross-Chain Messaging Gateway](https://eips.ethereum.org/EIPS/eip-7786)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
