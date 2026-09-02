---
hip: 0000
title: CLPR Financial Security Profiles and Value Guards
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

This HIP defines machine-readable security profiles and enforceable value guards for financial applications built
on the Cross Ledger Protocol (CLPR) specified by HIP-1535. CLPR authenticates cross-ledger messages, but its payloads
are intentionally opaque and permissionless Channels do not imply a particular verifier quality, finality policy,
administrative model, or economic exposure. A generic messaging service therefore cannot determine whether a
message represents ten dollars or ten billion dollars, nor whether the receiving application considers a Channel
safe for irreversible execution.

The proposed profile binds an application to exact ledger instances, CLPR Service deployments, verifier
fingerprints, finality requirements, application endpoints, message schemas, administrative policies, and recovery
rules. A Value Guard then enforces per-message, in-flight, and time-window limits for typed financial operations on
both the source and destination. Independent evidence registries may attach audits and operational observations to
a profile without converting the registry into a source of message validity. Emergency monitors are veto-only:
they may reduce limits or halt execution but can never make an otherwise invalid message valid.

The standard preserves permissionless experimentation while giving wallets, issuers, applications, Connector
Operators, and institutional risk teams a common way to select, monitor, and constrain production Channels. It
introduces no new token and does not alter CLPR's verifier interface.

## Motivation

HIP-1535 correctly makes Channel creation permissionless and verifier selection application-dependent. Those
properties enable experimentation, but they are insufficient as the default integration model for applications
that mint, release, transfer, or otherwise make irreversible changes to valuable assets.

A Channel user currently has to discover and evaluate, out of band:

- the exact peer ledger history and CLPR Service deployment;
- the verifier implementation, proxy behavior, upgrade authority, and finality policy;
- the source and destination applications allowed to exchange financial messages;
- the maximum value exposed before an operator can detect and stop an anomaly;
- the behavior during reorganization, verifier failure, application failure, or Channel quarantine; and
- the evidence supporting claims that a deployment was audited or is operating correctly.

Human-readable allow-lists and front-end labels do not compose across wallets, SDKs, exchanges, custodians, and
institutional policy engines. Message-count throttles also do not bound financial loss: one message may represent a
greater exposure than a million ordinary messages.

This HIP supplies a common, inspectable policy object and a deterministic enforcement layer. It deliberately does
not declare any Channel universally safe. Risk acceptance remains with the party whose assets are exposed.

## Rationale

**Profiles are immutable and content-addressed.** A security label whose meaning can change after approval does not
provide a stable trust decision. A profile ID is therefore derived from its canonical contents. A revised verifier,
limit, admin policy, or recovery procedure creates a new profile.

**Evidence is separate from validity.** Auditors, issuers, councils, security firms, and applications may publish
evidence about a profile. None of those parties can use the registry to approve a message that fails CLPR proof
verification. This avoids recreating a bridge validator set under another name.

**Safety monitors are veto-only.** An independent monitor can shorten the time between anomaly detection and halted
execution, but giving it approval power would weaken CLPR's direct-proof model. A monitor may move a guard toward a
safer state and may never move it toward a less restrictive state.

**Limits are enforced in asset units.** Converting every asset to a common unit introduces an oracle dependency.
Every conforming deployment must enforce native-quantity limits. A deployment may additionally enforce an
oracle-valued aggregate limit, provided the oracle and stale-price behavior are identified in the profile.

**Both sides enforce.** Source-only limits can be bypassed by a faulty or hostile source application; destination-
only limits discover excessive exposure after the message has already been authorized. The source reserves capacity
when an operation is enqueued and the destination independently checks capacity before the irreversible action.

## User stories

- As an **asset issuer**, I want to authorize only exact CLPR deployments and verifier policies so that a lookalike
  Channel cannot mint or release my asset.
- As an **application developer**, I want one profile ID that my contracts, SDK, and monitoring systems can enforce
  consistently.
- As a **wallet**, I want to show the user the finality, upgradeability, and recovery assumptions of a financial
  route before signing.
- As a **risk officer**, I want hard per-asset and aggregate exposure limits that remain effective even when a
  relayer, Connector, or application is compromised.
- As a **security monitor**, I want to halt or reduce exposure without gaining the power to authorize messages.
- As an **auditor**, I want to attach evidence to an exact immutable configuration rather than to a mutable project
  name.

## Specification

### 1. Scope

This HIP standardizes an Application-layer policy and middleware interface. It requires HIP-1535 Channel queries
to expose authenticated peer identity, verifier identity, and lifecycle state. It does not change how a CLPR proof
is constructed or verified.

A conforming implementation consists of:

1. a canonical `FinancialSecurityProfile` encoding;
2. a `ValueGuard` that enforces that profile before and after CLPR delivery;
3. a permissionless evidence registry interface; and
4. events and query surfaces sufficient for independent monitoring.

### 2. Canonical encoding and identifiers

All structures in this HIP MUST have a deterministic binary encoding. Maps MUST be encoded by ascending key bytes,
integer encodings MUST be minimal and unsigned unless explicitly stated, and unknown required fields MUST cause
rejection. Implementations MAY expose JSON for human consumption, but JSON MUST NOT be used to derive identifiers.

```text
ProfileID = SHA-256("CLPR_FINANCIAL_PROFILE_V1" || canonical_profile_bytes)
```

The domain string is ASCII. A profile is immutable. Any semantic change produces a new `ProfileID`.

### 3. FinancialSecurityProfile

The profile contains the following required fields:

| Field | Semantics |
|---|---|
| `profile_version` | This specification's encoding version. |
| `valid_from` / `valid_until` | Inclusive activation and exclusive expiry consensus times. |
| `source_channel_binding` | Source `ChainID`, `LedgerInstanceID`, CLPR Service address and code hash, Channel ID, and verifier fingerprint. |
| `destination_channel_binding` | Destination values corresponding to the source binding. |
| `proof_policy` | Verification class, finality rule, composite-verifier rule if used, and proof-format identifier. |
| `application_binding` | Exact source and destination application identifiers and executable code hashes. |
| `message_schema_hash` | Content hash of the only typed financial envelope accepted under this profile. |
| `asset_policies` | Per-asset authorization, limits, adapter, and recovery policy. |
| `aggregate_policy` | Optional common-value exposure limit and its oracle policy. |
| `administration_policy` | Admin identities, thresholds, timelocks, and powers for every mutable dependency. |
| `monitor_policy` | Veto-only monitors and the safer state transitions each may request. |
| `recovery_policy_hash` | Content hash of the executable and documented reconciliation procedure. |

An application MUST compare every binding field with current on-ledger state before authorizing or executing a
financial envelope. A mismatch fails closed. Profile expiry also fails closed for new operations; already completed
operations remain valid.

### 4. Verification classes

Profiles MUST declare one of these classes. The class communicates structure, not an endorsement.

| Class | Minimum property |
|---|---|
| `DIRECT_DETERMINISTIC` | The destination verifies a finalized commitment from a deterministic-finality source, with no mutable external attestor. |
| `DIRECT_FINALIZED` | The destination verifies a source consensus proof that meets an explicitly finalized commitment rule. |
| `DIRECT_PROBABILISTIC` | The destination verifies source consensus under a stated confirmation or economic-finality rule with non-zero reorganization risk. |
| `COMPOSITE` | A content-addressed policy combines multiple independent verification mechanisms and declares its threshold and required members. |
| `EXTERNAL_ATTESTATION` | Validity depends materially on an external signer, federation, oracle, or optimistic challenge system. |

The profile MUST disclose mutable proxies, emergency keys, governance overrides, optimistic windows, external
signers, and any condition under which finality may be reverted. A composite policy MUST identify each component by
code hash and MUST state whether the relationship is AND, OR, or threshold. A lower assurance mechanism MUST NOT be
described as strengthening a direct proof when its compromise can independently authorize delivery.

### 5. Typed financial envelope

The Value Guard accepts only an envelope whose schema hash matches the profile. The base envelope contains:

```text
FinancialEnvelope {
    version
    profile_id
    operation_id
    source_ledger_instance_id
    destination_ledger_instance_id
    source_application
    destination_application
    operation_type
    asset_id
    amount
    sender
    recipient
    source_nonce
    valid_after
    valid_until
    maximum_execution_cost
    application_payload_hash
    compliance_policy_hash      // optional
}
```

`operation_id` is the SHA-256 hash of the canonical envelope including the source signature domain. It MUST be
unique across profile versions and ledger instances. `amount` is expressed in the asset's smallest indivisible
unit. The envelope carries a hash of application-specific data rather than granting arbitrary payload bytes an
implicit financial meaning.

### 6. Value limits

Every `asset_policy` defines:

- `max_single_amount`;
- `max_in_flight_amount`;
- one or more token buckets, each with `capacity`, `refill_amount`, and `refill_period`;
- `max_pending_operations`;
- permitted operation types and destination adapters; and
- behavior when the Channel, profile, oracle, or application is stale or unavailable.

The source Value Guard reserves in-flight amount and bucket capacity atomically with enqueue. The reservation is
released only after a verified terminal response or an authorized recovery transition. Timeout alone MUST NOT
release capacity if destination execution remains possible.

Before destination execution, the destination Value Guard independently verifies the profile, envelope,
idempotency record, limits, Channel state, finality rule, application code hash, and asset adapter. It then reserves
capacity and invokes the adapter using checks-effects-interactions. A failed invocation releases destination
capacity and returns a deterministic failure. Successful irreversible execution consumes bucket capacity and
records the operation ID permanently or for at least the maximum replay horizon of every dependency.

An optional aggregate policy may convert exposures through a named oracle. It MUST define maximum price age,
confidence requirements, fallback behavior, decimal handling, and the consequence of an unavailable or divergent
price. Oracle failure MUST NOT disable native-quantity limits.

### 7. Guard states and circuit breakers

A Value Guard has four monotonically safety-oriented operating states:

| State | Behavior |
|---|---|
| `ACTIVE` | New operations execute within all limits. |
| `DEGRADED` | New operations execute under a precommitted lower limit set. |
| `HALTED` | No new financial operation executes; proofs and observations may continue. |
| `RECOVERY` | Only profile-defined reconciliation operations execute. |

Automated monitors and emergency authorities MAY request `ACTIVE → DEGRADED`, `ACTIVE → HALTED`, or
`DEGRADED → HALTED`. They MUST NOT reactivate a guard, raise a limit, change a recipient, or authorize a message.
Reactivation or increased limits require the profile's normal administrative threshold and timelock. A CLPR Channel
entering `QUARANTINED` immediately forces every bound Value Guard to `HALTED`.

### 8. Evidence registry

Any account may publish an `EvidenceRecord` containing:

- `profile_id`;
- evidence type and content hash;
- issuer identity;
- publication and expiry times;
- URI or on-ledger content reference; and
- optional supersession or revocation reference.

Evidence types may include source-code verification, formal-verification reports, audits, reproducible builds,
incident notices, operational observations, and issuer approvals. Registries MUST preserve issuer identity and MUST
NOT collapse conflicting evidence into a single boolean such as `safe`.

Applications choose which evidence issuers and policies they trust. A registry administrator may moderate indexing
or presentation but cannot change a profile, validate a CLPR message, or bypass a Value Guard.

### 9. Administration and change management

Every mutable authority referenced by a profile MUST have a declared scope. At minimum, the profile distinguishes:

- power to halt;
- power to reduce or increase limits;
- power to change verifier or application code;
- power to change an asset adapter;
- power to enter recovery; and
- power to withdraw collateral or escrow.

An increase in exposure, replacement of verification logic, change of peer instance, or expansion of permitted
applications requires a new profile. Implementations SHOULD support an overlap period in which the old profile
accepts only completion responses while the new profile accepts new operations.

### 10. Conformance invariants

A conforming implementation MUST demonstrate through tests or formal methods that:

1. no financial operation executes unless all profile bindings match current state;
2. no operation ID can execute twice across retry, reorganization, upgrade, or migration paths;
3. native-quantity exposure never exceeds per-message, in-flight, or bucket limits;
4. a veto-only monitor cannot authorize a message, raise a limit, or reactivate a guard;
5. Channel quarantine prevents new irreversible application effects;
6. timeout cannot create simultaneous refund and destination-execution claims; and
7. no administrator can silently alter the meaning of an existing `ProfileID`.

Implementations MUST publish adversarial tests for malformed encodings, stale proofs, identifier collisions,
reentrancy, integer boundaries, decimal mismatches, oracle staleness, reorganization, administrative compromise,
and concurrent limit consumption.

### 11. Impact on Mirror Node

Mirror Nodes MAY index profiles, profile-bound operations, guard state changes, limit consumption, and evidence
records. Indexing MUST preserve the original issuer of each evidence record and MUST distinguish observation from
consensus state.

### 12. Impact on SDK

SDKs SHOULD provide canonical encoders, profile-ID derivation, binding validation, human-readable risk summaries,
Value Guard transaction builders, and evidence queries. SDKs MUST NOT label a permissionless profile safe merely
because it exists in a registry.

## Backwards Compatibility

This HIP is an opt-in Application standard layered above HIP-1535. Existing Channels and arbitrary messages remain
valid. A financial application becomes conforming only when it explicitly binds to a profile and routes financial
operations through a Value Guard.

Profiles are versioned and content-addressed. A future encoding version can coexist with version 1; applications
must explicitly opt into newly recognized versions.

## Security Implications

- **Profiles describe risk; they do not remove it.** A perfectly encoded profile may intentionally select weak
  verification or centralized administration. Applications remain responsible for policy selection.
- **Registry capture cannot forge messages but can mislead users.** Wallets should display evidence provenance and
  conflicting records rather than a registry-controlled safety badge.
- **Oracle-valued limits add oracle risk.** Native-asset limits remain mandatory and continue operating when the
  optional aggregate oracle fails.
- **Limit fragmentation can hide aggregate exposure.** Issuers should apply route-level and global controls across
  all profiles that can affect one asset supply or escrow.
- **Halting creates liveness and market risk.** Recovery procedures must be specified before value is accepted, and
  administrators must not promise automatic refunds where destination non-execution cannot be proven.
- **Upgradeable dependencies weaken fingerprint guarantees.** Their complete implementation and authority policy
  must be committed and surfaced to users.

## How to Teach This

Teach CLPR as proving *where a message came from*. Teach a financial security profile as defining *which exact
route an application accepts*, and the Value Guard as limiting *how much damage that route can cause before it is
stopped*. Evidence registries help users evaluate a route but never participate in message validity.

Integration documentation should begin with a profile diff, a worst-case-exposure calculation, and a recovery
exercise rather than with a successful happy-path transfer.

## Reference Implementation

A reference implementation should include:

- canonical protobuf or XDR schemas and cross-language test vectors;
- Solidity and Hiero-native Value Guards;
- a permissionless evidence registry;
- an SDK risk-summary renderer;
- a veto-only monitor example; and
- property-based and adversarial tests for every invariant in §10.

The implementation must complete independent security review before this HIP can become Final.

## Rejected Ideas

- **A single protocol-wide safety authority.** Rejected because applications and assets have different risk
  tolerances, and such an authority could become an intermediary trust layer.
- **A mutable profile with a stable friendly name.** Rejected because an approval could silently acquire different
  verification or administrative semantics.
- **Limits based only on USD value.** Rejected because the oracle would become a universal safety dependency.
- **Monitors that co-sign validity.** Rejected for direct-proof profiles because compromise of the monitor could
  weaken rather than strengthen authentication. Veto-only operation preserves fail-safe behavior.
- **Inferring value from arbitrary CLPR bytes.** Rejected because application semantics are not safely discoverable
  by the generic CLPR Service.

## Open Issues

- Selection of the canonical binary encoding should align with the final HIP-1535 wire encoding.
- The community should publish recommended evidence vocabularies without making any registry canonical by protocol
  fiat.
- Cross-application aggregate limits may require an issuer-operated guard shared by several otherwise independent
  applications.

## References

- [HIP-1535: CLPR](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/spec/HIP/hip-1535.md)
- [CAIP-2: Blockchain ID Specification](https://chainagnostic.org/CAIPs/caip-2)
- [Chainlink CCIP Rate Limit Management](https://docs.chain.link/ccip/concepts/rate-limit-management/overview)
- [ERC-7786: Cross-Chain Messaging Gateway](https://eips.ethereum.org/EIPS/eip-7786)
- [Hyperlane Interchain Security Modules](https://docs.hyperlane.xyz/docs/protocol/ISM/modular-security)
- [LayerZero Security Stack](https://docs.layerzero.network/v2/concepts/modular-security/security-stack-dvns)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
