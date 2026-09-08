---
hip: 0000
title: Ledger-Bound ML-DSA-44 Transaction Signatures
author: Schayan Salehi (@shayansal)
discussions-to: <URL of the GitHub Pull Request for this HIP>
type: Standards Track
category: Core
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-09-09
updated: 2026-09-09
---

## Abstract

This HIP proposes an opt-in post-quantum transaction signature profile for Hiero networks, named HCPQ v1. HCPQ v1 uses the standardized FIPS 204 ML-DSA-44 primitive and does not introduce a new signature primitive or hardness assumption. It adds an ML-DSA-44 public-key variant to `Key` and an ML-DSA-44 signature variant to `SignaturePair`. The 1,312-byte public key is stored in account or other entity state, while each transaction identifies that key with an exact 32-byte SHA3-256 identifier and carries the raw 2,420-byte signature.

The signed transcript binds the signature to the HCPQ version, the network's configured ledger identifier, and the exact canonical `TransactionBody` bytes. Nodes reject alternate protobuf encodings for HCPQ-signed transactions and never accept caller-selected ledger identifiers. HCPQ is disabled by default and bounded by a network-configured per-transaction signature limit. Existing Ed25519 and ECDSA(secp256k1) keys and transactions are unchanged.

This proposal defines wire encodings, canonical transaction rules, failure behavior, mixed-key semantics, and rollout gates. It does not claim that current Hedera throughput is preserved. Network activation requires independent cryptographic review, SDK and wallet support, fee and throttle calibration, cross-implementation vectors, and representative multi-node performance testing.

## Motivation

Ed25519 and ECDSA(secp256k1) rely on discrete-logarithm problems that a sufficiently capable quantum computer could solve with Shor's algorithm. A migration path must be designed and deployed before such a computer exists, because public keys revealed on-ledger may otherwise become targets for later compromise.

Post-quantum signatures impose meaningful costs. ML-DSA-44 public keys and signatures are much larger than their classical counterparts, and verification has a different CPU and implementation profile. Stateful hash-based signatures also create unsafe backup and recovery failure modes for ordinary wallets. A Hiero profile therefore needs more than a new algorithm tag: it needs deterministic wire rules, replay-domain separation, bounded verification work, safe activation, and an explicit accounting of network and storage costs.

HCPQ v1 chooses the finalized FIPS 204 ML-DSA-44 primitive as a conservative baseline. It stores the public key only in the entity's key structure and transmits a fixed 32-byte identifier in ordinary signature maps. Existing Hiero threshold and key-list structures can express a transition policy requiring both classical and post-quantum authorization without defining a new hybrid primitive.

## Rationale

### Why ML-DSA-44

ML-DSA is standardized in FIPS 204 and is intended for digital signature generation and verification in the presence of quantum-capable adversaries. ML-DSA-44 is the smallest standardized ML-DSA parameter set and is therefore the least costly FIPS 204 starting point for transaction authorization.

Falcon-512, the basis for the future FN-DSA standard, has substantially smaller signatures and fast verification. However, draft FIPS 206 remains under development at the time of this HIP, and secure signing has unusually demanding floating-point, sampling, fault, and side-channel requirements. HCPQ v1 reserves no Falcon wire identifier. A later HIP can define an FN-DSA profile after the standard and hardened implementations are stable.

### Why the full public key remains in entity state

A separate global key registry adds lifecycle, proof-of-possession, rent, deletion, collision, and mirror-history rules. It also introduces a new dependency in every authorization path. HCPQ v1 instead reuses the existing `Key`, `KeyList`, and `ThresholdKey` state model. The public key is paid for when an entity stores it. A transaction then carries only the full 32-byte key identifier plus the signature.

### Why an exact key identifier instead of a prefix

Existing signature pairs permit variable-length public-key prefixes. For a large post-quantum key this would either repeat substantial key material or permit ambiguous matching. HCPQ uses a full SHA3-256 identifier and forbids shortening. This gives constant-size lookup material and removes prefix ambiguity within the HCPQ key type.

### Why canonical bytes and a ledger-bound transcript

Signing parsed semantic fields while accepting several protobuf encodings risks different nodes or clients disagreeing about the signed byte string. HCPQ signs a domain-separated digest of the exact `TransactionBody` bytes and only accepts those bytes if they are exactly the deterministic PBJ protobuf encoding of the parsed body. Binding the configured ledger identifier prevents a valid signature from being replayed unchanged onto another Hiero network.

## User stories

> As an account holder, I want to place an ML-DSA-44 key in my account policy so that I can authorize transactions with a standardized post-quantum signature.

> As a wallet developer, I want one exact signing transcript and canonical serialization rule so that independently developed clients produce signatures every conforming node verifies identically.

> As a network operator, I want HCPQ disabled by default with a bounded signature count so that the network can benchmark, price, and activate the feature safely.

> As an organization migrating gradually, I want to combine classical and HCPQ keys with existing threshold structures so that I can require both during a transition period.

## Specification

The keyword **MUST** is normative.

### Primitive and encodings

HCPQ v1 uses ML-DSA-44 as specified by FIPS 204.

| Value | Size | Encoding |
|---|---:|---|
| ML-DSA-44 public key | 1,312 bytes | Raw FIPS 204 public-key encoding |
| ML-DSA-44 signature | 2,420 bytes | Raw FIPS 204 signature encoding |
| HCPQ key identifier | 32 bytes | Complete SHA3-256 output |

All integer values in HCPQ transcripts are unsigned and big-endian. `||` denotes concatenation. ASCII domain strings include their terminating zero byte where shown.

### Key identifier

For an ML-DSA-44 public key `pk`, nodes and clients MUST compute:

```text
key_id = SHA3-256(
    "HCPQ-SIG-KEY-ID\0" ||
    0x01 ||
    0x02 ||
    public_key_length:u64 ||
    pk
)
```

`0x01` is the HCPQ version. `0x02` identifies ML-DSA-44 inside the transcript. The public-key length MUST be 1,312. The complete 32-byte `key_id` MUST be used; prefix truncation is invalid.

### Transaction transcript

Let `ledger_id` be the immutable ledger identifier supplied by node configuration, and let `body` be the exact canonical protobuf bytes of `TransactionBody`. Clients MUST compute:

```text
transaction_digest = SHA3-256(
    "HCPQ-SIG-HEDERA-TX\0" ||
    0x01 ||
    ledger_id_length:u16 ||
    ledger_id ||
    transaction_body_length:u64 ||
    body
)
```

The ledger identifier MUST contain between 1 and 65,535 bytes. Nodes MUST obtain it from trusted network configuration and MUST NOT accept it from a transaction or API caller.

The ML-DSA signer and verifier MUST use the FIPS 204 context string `HCPQ-SIG-TX-v1` and MUST sign or verify the 32-byte `transaction_digest` as the message. Signers SHOULD use randomized or hedged signing with cryptographically secure operating-system-backed randomness. Failure to obtain randomness MUST fail signing.

The following derivation vectors are normative lowercase hexadecimal outputs. They test the HCPQ framing and SHA3-256 steps, not ML-DSA public-key validity:

| Input | Expected output |
|---|---|
| `ledger_id = 00`, `body = 0a0101` | `transaction_digest = b06481a311d5d184b1524f565611f20dd7a48c1f5fb1388fe26c963abb9d84f1` |
| `pk = 1312` zero bytes | `key_id = 12e887dd05eccac5b490be89fd73d070109cc7dccbc615d06d466bc5f0b9caac` |

### Protobuf changes

Add a public-key alternative to the `Key` oneof in `basic_types.proto`:

```protobuf
bytes ML_DSA_44 = 9;
```

The field MUST contain exactly the 1,312-byte raw public key.

Add a signature alternative to the `SignaturePair` signature oneof:

```protobuf
bytes ML_DSA_44 = 7;
```

For this signature type, `pubKeyPrefix` MUST contain exactly the 32-byte HCPQ `key_id`; it is not a variable-length prefix. The signature field MUST contain exactly the 2,420-byte raw signature.

### Canonical `TransactionBody` rule

If a `SignedTransaction.sigMap` contains at least one HCPQ signature, the node MUST:

1. strictly parse `SignedTransaction.bodyBytes` as a `TransactionBody`, rejecting malformed data and unknown fields;
2. deterministically encode the parsed body with the network's canonical PBJ protobuf codec; and
3. reject the transaction unless the encoded result is byte-for-byte identical to the original `bodyBytes`.

This rejects duplicate fields, non-minimal varints, alternate field ordering, explicit encodings of default values, trailing data, and other alternate byte encodings. Verification MUST use the original accepted `bodyBytes`; a node MUST NOT silently replace them with re-encoded bytes before verification.

The new canonical rule applies only when an HCPQ signature is present. It does not change the historical encoding compatibility of transactions signed only with Ed25519 or ECDSA(secp256k1).

### Expansion and verification

For each required `Key.ML_DSA_44` value, a node MUST:

1. reject a public key whose length is not exactly 1,312 bytes;
2. compute its complete HCPQ `key_id`;
3. match only a `SignaturePair.ML_DSA_44` with an exactly equal 32-byte `pubKeyPrefix`;
4. reject a signature whose length is not exactly 2,420 bytes;
5. compute the transaction transcript from the configured ledger ID and accepted canonical body bytes; and
6. verify the signature with ML-DSA-44 and context `HCPQ-SIG-TX-v1`.

Malformed keys, identifiers, signatures, contexts, ledgers, or public-key encodings MUST fail closed. Key-identifier comparison SHOULD use a constant-time equality function. HCPQ keys MUST participate in existing key-list, threshold-key, schedule-signature, consensus-submit-key, and authorization traversal rules in the same role as other primitive cryptographic keys.

The existing arbitrary-message `isAuthorized` system-contract path is outside HCPQ v1 because it has neither the transaction transcript nor the trusted ledger-domain API defined here.

### Activation and resource bound

Nodes MUST expose network-controlled configuration equivalent to:

```text
hcpq.enabled = false
hcpq.maxSignaturesPerTransaction = 1
```

When HCPQ is disabled, transactions containing HCPQ signatures and attempts to store new HCPQ keys MUST fail with `NOT_SUPPORTED`. When enabled, the node MUST reject any transaction exceeding the configured HCPQ signature count before cryptographic verification. The initial activation value SHOULD be one until fees, throttles, and representative network benchmarks justify a higher value.

### Mixed and migration policies

Existing `KeyList` and `ThresholdKey` semantics are unchanged. For example, a two-of-two threshold containing one Ed25519 key and one HCPQ key requires both signatures over the same `TransactionBody`; each algorithm retains its own existing message processing and the HCPQ signature additionally applies its ledger-bound transcript.

Networks and wallets SHOULD support staged migration: add a post-quantum key under a multi-key policy, verify operational recovery, then consider removing the classical key only after the ecosystem and network have met their adoption criteria.

## Impact on Mirror Node

Mirror nodes and protobuf consumers must preserve and expose the new `Key.ML_DSA_44` and `SignaturePair.ML_DSA_44` fields. Public keys add 1,312 bytes wherever an entity key is stored or emitted. Each HCPQ signature adds 2,452 bytes of signature material and key identifier before protobuf tags and length prefixes. Unknown-field handling and software-version sequencing must prevent older consumers from silently misrepresenting these values.

## Impact on SDK

SDKs must add ML-DSA-44 key generation/import, secure private-key storage, exact public-key and signature encodings, HCPQ key-ID derivation, canonical `TransactionBody` serialization, ledger-ID selection from a trusted network profile, and the HCPQ transcript. SDKs must refuse shortened key identifiers and malformed lengths. Hardware-wallet and remote-signer protocols require explicit support; software fallback is not evidence of side-channel-resistant signing.

## Backwards Compatibility

The protobuf additions use previously unassigned oneof field numbers. Existing Ed25519 and ECDSA(secp256k1) key and signature semantics remain unchanged, and their transactions do not acquire the new canonicalization requirement.

Activation requires a coordinated network upgrade. Older nodes that do not understand the new fields reject them during strict parsing, so HCPQ must remain disabled until every consensus node and required downstream consumer is upgraded. Once an entity changes its controlling policy to require HCPQ, older wallets and SDKs cannot authorize that entity; migration tooling must communicate this clearly and retain a tested recovery path.

## Security Implications

HCPQ's post-quantum security is inherited from ML-DSA-44 and SHA3-256. This HIP does not provide a new security reduction and does not make ML-DSA signatures smaller.

The principal security considerations are:

- **Implementation and side channels:** signing code handles long-lived secret material and complex sampling. Production wallets, HSMs, and hardware devices require implementation-specific timing, power, electromagnetic, fault, and randomness review.
- **Denial of service:** signatures are large and verification consumes CPU before ordinary transaction handling. Default-off activation, strict size checks, a signature-count bound, ingress throttles, and fees calibrated to measured resource costs are required.
- **Canonicalization:** every implementation must agree on exact accepted bytes. Cross-language adversarial vectors must cover duplicate fields, default values, field ordering, overlong varints, truncation, and unknown fields.
- **Replay:** the configured ledger ID and purpose-specific domain/context prevent cross-ledger and cross-protocol reuse when implemented as specified.
- **Key identification:** complete 32-byte identifiers are mandatory. Implementations must never fall back to ordinary prefix matching.
- **Migration:** post-quantum algorithms do not protect an account that still permits a vulnerable classical key alone. Conversely, prematurely requiring HCPQ can lock out unsupported wallets.
- **Provider isolation:** a reference implementation should avoid mutating a JVM-wide cryptographic-provider registry and must pin and review its provider version.

Independent cryptographic and implementation review is a prerequisite to production activation. Passing local unit tests or a single-node benchmark is not sufficient.

## Performance and capacity

An HCPQ signature pair carries 2,420 signature bytes and a 32-byte key identifier, versus a 64-byte Ed25519 signature and typically shorter key-prefix material. The 1,312-byte public key is stored in entity state rather than repeated in each transaction.

The reference code has local primitive microbenchmarks, but this HIP intentionally makes no claim that Hedera's advertised or observed transaction throughput is preserved. Before activation, operators must measure at minimum:

- sustained ingest, pre-handle, consensus, reconnect, and state-proof behavior on a representative multi-node network;
- transactions containing one HCPQ signature and mixed threshold policies;
- bandwidth, record/block-stream, mirror-node, and state growth;
- adversarial malformed inputs and signature floods;
- p50, p95, and p99 end-to-end latency and CPU headroom at target load; and
- wallet signing performance, power use, and entropy failure behavior.

The acceptance target and corresponding fee/throttle schedule are governance decisions informed by those measurements. A 10,000-transactions-per-second claim requires an end-to-end network test at that load; primitive verifications per second cannot establish it.

## How to Teach This

HCPQ v1 should be described as “a Hedera transaction profile for standardized ML-DSA-44,” not as a newly invented signature algorithm and not as Falcon. The shortest useful mental model is:

1. store the large ML-DSA public key once in the entity's normal key policy;
2. put its full 32-byte HCPQ identifier beside each transaction signature;
3. sign one canonical, ledger-bound transaction digest; and
4. activate only after the network, wallets, fees, and audits are ready.

Developer documentation should include exact transcript vectors, canonical protobuf examples, migration examples using threshold keys, and conspicuous warnings against protecting real assets with unaudited or unsupported signers.

## Reference Implementation

The draft reference implementation is split so the primitive profile can be reviewed independently from consensus-node integration:

- `hiero-cryptography`: Java ML-DSA-44 key generation, raw key encoding, key-ID derivation, transcript signing, and fail-closed verification, with unit tests.
- `hiero-consensus-node`: protobuf fields, exact-key-ID expansion, ledger-bound verification, canonical transaction enforcement, entity-key validation, mixed-key traversal, default-off configuration, signature-count bounds, and integration tests.

Links to the draft code pull requests will be added before this HIP pull request is opened. Neither draft is a production activation recommendation.

## Rejected Ideas

### Inventing a new post-quantum primitive

Designing a new hardness assumption or signature construction would require years of public cryptanalysis and standardization. HCPQ deliberately composes a standardized primitive with Hiero-specific transcript and wire rules.

### Falcon-512 or pre-standard FN-DSA in v1

The smaller signature is attractive, but draft-standard churn and signing-side implementation risks are inappropriate for the first production-oriented profile. A later HIP can add final FN-DSA under a new, explicit algorithm and wire version.

### Stateful hash-based signatures

XMSS and LMS require durable one-time state coordination. Wallet restore, multi-device use, concurrent signing, and backup rollback can cause catastrophic state reuse. These schemes are not proposed for general account transaction signing.

### A global public-key registry

A registry avoids storing the full key in every entity but adds a new state authority, proof-of-possession ceremony, rotation and deletion rules, rent, collision behavior, and historical lookup requirements. Reusing the existing entity key model is smaller in protocol surface and keeps authorization self-contained.

### Repeating the full public key in every transaction

This would add 1,312 bytes to each signature pair. The exact 32-byte identifier provides unambiguous matching to the public key already present in required-key state.

### Requiring a new bespoke hybrid signature

Existing threshold and key-list policies already express classical-plus-post-quantum authorization. A new hybrid primitive would duplicate policy semantics and complicate recovery and fee calculation.

## Open Issues

- Determine fees and ingress throttles from representative multi-node capacity tests.
- Decide the initial network value for `hcpq.maxSignaturesPerTransaction` after mixed-key benchmarks.
- Publish cross-provider and cross-language known-answer and malformed-encoding vectors.
- Define SDK, remote-signer, HSM, hardware-wallet, and key-backup interoperability profiles.
- Specify mirror-node presentation and historical key-query behavior.
- Decide whether a future HIP should extend arbitrary-message and smart-contract authorization APIs with a trusted ledger-bound HCPQ domain.
- Complete independent cryptographic, JVM-provider, side-channel, and consensus-integration review before any production activation.

## References

- [NIST FIPS 204: Module-Lattice-Based Digital Signature Standard](https://csrc.nist.gov/pubs/fips/204/final)
- [NIST Post-Quantum Cryptography project status](https://csrc.nist.gov/Projects/post-quantum-cryptography)
- [Hiero Improvement Proposal Process](./hip-1.md)
- [Hedera `basic_types.proto`](https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hapi/hedera-protobuf-java-api/src/main/proto/services/basic_types.proto)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
