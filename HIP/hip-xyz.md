---
hip: xyz
title: TSS Ceremony
author: Joseph Sinclair <@jsync-swirlds>, Rohit Sinha <@rsinha> 
requested-by: Hashgraph
type: Standards Track
category: TBD
needs-hiero-approval: Yes
needs-hedera-review: Yes
hedera-review-date: 
hedera-acceptance-decision: 
status: Pending
last-call-date-time: TBD
created: 2026-01-20
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/xyz
updated: 2026-01-20
---

## Abstract

For TSS (HIP-1200) operations in Hiero, we use a recursive SNARK proof system (a.k.a. WRAPS) to cryptographically validate the entire history of Hedera address books. 
Like most SNARKs, this requires a one-time trusted setup to create a Structured Reference String (SRS) — a large set of public parameters that both provers and verifiers will use.

To that end, this proposal specifies a cryptographic ceremony, based on a relatively standard “Powers of Tau” protocol, to generate the SRS for WRAPS.
Specifically, it details a protocol that can be executed by the council members -- specifically, those council members that also run consensus nodes -- such that each participant supplies some secret entropy to the protocol.
The  protocol has the guarantee that as long as one participant acts honestly, and deletes the secret entropy used during the protocol, we have security, in that no (computationally-bounded) adversarial entity can forge invalid proofs.

To minimize the impact of normal consensus operations, the protocol logic is not part of the consensus node software.
Moreover, the protocol operations are coordinated off-chain via an AWS S3 bucket, which also stores the intermediate protocol data.

## Background

Let us first recall the operational model of Hiero TSS as defined in HIP-1200. We have the following operations:

- **Address Book rotation** (from AB_prev to AB_next):
    - **HINTS setup**: nodes in AB_next broadcast some cryptographic material derived from their  `HINTS secret key` , after which the `HINTS aggregation key` and `HINTS verification key` are computed.
    - **WRAPS signing**: nodes in AB_prev use their `Schnorr private key`  to sign hash(AB_next) || `HINTS verification key` , where || denotes concatenation. Specifically, they engage in a 3-round Schnorr multisig protocol (called musig). The output of this protocol is a single (aggregate) Schnorr signature, which makes the following task efficient.
    - **WRAPS proving**: nodes in AB_next use the above aggregate Schnorr signature and the  `WRAPS proving key`  to generate the `WRAPS proof` . If this is a valid proof, nodes in AB_prev can safely transition to using AB_next.
- **Block Signing**:
    - **HINTS signing**: nodes use their `HINTS secret key` to sign the `block root hash`. The output of this algorithm is a “partial” signature which is broadcasted to all nodes.
    - **HINTS aggregation**: any node can use the `HINTS aggregation key` to combine a set of partial signatures and produce a `HINTS signature`  over the `block root hash`. This signature is always ~1200 bytes, regardless of network size.

After all these steps, we have a cryptographic attestation on a block, comprising the `WRAPS proof` , `HINTS verification key`, and `HINTS signature` . The block can be verified w.r.t. the `ledger ID` as follows.

- **Verification**: can be decomposed into the following two checks
    - **WRAPS verification**: uses `WRAPS verification key` to verify `WRAPS proof` with respect to the claimed `ledger ID` and claimed `HINTS verification key` . That is, we have the following api: `verify(wraps_verification_key, wraps_proof, genesis_ab_hash, hints_verification_key)`.
    - **HINTS verification**: uses `HINTS verification key`  to verify `HINTS signature` with respect to the claimed `block root hash` . That is, we have the following api: `verify(hints_verification_key, message, hints_signature)` .


## Rationale

A “Powers of Tau” Phase 1 ceremony produces group elements corresponding to powers of a secret τ. These powers can be used to derive:
  • A universal KZG SRS up to some maximum polynomial degree (needed for Nova’s KZG commitments), and
  • Inputs that a Groth16 Phase 2 ceremony consumes to produce circuit-specific Groth16 proving and verifying keys (the Groth16 SRS for WRAPS’ Groth16 circuits).

Accordingly, this HIP defines:
  • Phase 1 as the universal MPC generating powers of τ (foundation for both KZG SRS and Groth16 setup),
  • A coordinator post-processing step that deterministically derives:
  • KZG_SRS from the Phase 1 output (untrusted computation), and
  • Groth16_Phase2_Challenge_0 for Groth16 Phase 2,
  • Phase 2 as the Groth16 circuit-specific MPC.

## Specification

### Protocol Phases

The ceremony proceeds as follows:
  1.  Initialization: Coordinator publishes an initial Phase 1 SRS derived from a fixed seed (no entropy) and publishes deterministic contributor ordering.
  2.  Phase 1 MPC (Powers of Tau): Contributors sequentially add secret entropy to update the universal powers.
  3.  Untrusted Post-Processing (Coordinator):
  - deterministically derives a KZG SRS usable by Nova’s commitment scheme (up to declared max degree),
  - deterministically prepares the initial challenge for Groth16 Phase 2.
  4.  Phase 2 MPC (Groth16): Contributors sequentially add secret entropy to generate Groth16 circuit-specific proving/verifying keys for WRAPS.

At completion, the ceremony outputs an SRS bundle:
- KZG_SRS (Nova commitment scheme),
- Groth16_SRS_WRAPS (Groth16 proving key material + verifying key material for WRAPS),
- plus a complete transcript enabling independent verification and archival.


### Ceremony Artifacts

The transcript MUST clearly separate and label artifacts for:
- Phase 1 (PoT) artifacts: universal powers (τ^i) and related proofs/metadata.
- Derived KZG SRS artifacts: extracted/serialized KZG parameters and digest.
- Phase 2 (Groth16) artifacts: circuit-specific Groth16 parameters and digest.

The final manifest MUST include:
- digest_phase1_final
- digest_kzg_srs
- digest_groth16_srs
- digest_vk_wrapped (verifier key subset used on-node / in SDKs)
- contributor roster, ordering, software versions

### Phase 1 (Universal Powers of Tau)

Purpose
Generate universal powers of secret τ that serve as the foundation for:
  • KZG SRS for Nova, and
  • Groth16 Phase 2 setup inputs.

Contribution step
Unchanged in structure (each contributor blinds the previous output with fresh secret entropy and deletes toxic waste).

Output
phase1_final which is sufficient to deterministically derive:
  • KZG_SRS(max_degree) and
  • phase2_groth16_challenge_0.


### Post-Processing (Coordinator, Untrusted)

From phase1_final, the coordinator performs deterministic, publicly documented computations to produce:
  1.  KZG SRS
  • KZG_SRS(max_degree) for the Nova commitment scheme used in WRAPS.
  • The max_degree MUST be published in advance and included in the final manifest.
  • Anyone can recompute KZG_SRS from phase1_final.
  2.  Groth16 Phase 2 Initial Challenge
  • phase2_groth16_challenge_0 used to begin the Groth16 circuit-specific ceremony.

This step MUST be reproducible and accompanied by:
  • digests/hashes,
  • tool versions,
  • a verification report (optional but recommended).

### Phase 2 (Groth16 Circuit-Specific)

Purpose
Generate the circuit-specific Groth16 SRS (proving and verifying keys) for WRAPS’ Groth16 circuit(s).

Inputs
  • phase2_groth16_challenge_0
  • wraps_circuit_commitment (commitment to constraints / R1CS / QAP binding)

Contribution step
Unchanged in structure; each contributor adds new secret entropy and deletes toxic waste.

Outputs
  • Groth16_PK_WRAPS (prover material; may be large)
  • Groth16_VK_WRAPS (verifier material)
  • VK_wrapped (the minimal subset required for verification in the Hedera/Heiro verification pipeline, expected ~1.7 KB)


## Security Implications

If an adversary learns all toxic waste secrets for the relevant ceremony steps, they can forge proofs. Therefore:
- Phase 1 secrecy impacts both:
- the KZG SRS (Nova commitments), and
- the downstream Groth16 Phase 2 security.
- Phase 2 secrecy impacts:
- the circuit-specific Groth16 SRS.

Security holds as long as at least one participant in the relevant phase(s) contributes true randomness and deletes it.

## Reference Implementation
Please refer to the Hedera Cryptography 
[repository](https://github.com/hashgraph/hedera-cryptography) for the reference 
implementation.

## Open Issues
No known issues are currently under discussion.

## References

1. Kohlweiss, M., Maller, M., Siim, J., Volkhov, M. (2021). *Snarky Ceremonies*. Cryptology ePrint Archive, Paper 2021/219. Retrieved from [https://eprint.iacr.org/2021/219](https://eprint.iacr.org/2021/219.pdf)
2. [HIP-1200: TSS](https://hips.hedera.com/hip/hip-1200)

## Copyright/license
This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
