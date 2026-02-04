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

For TSS (HIP-1200) operations in Hiero, we use a recursive SNARK proof system (a.k.a. WRAPS) to cryptographically validate the entire history of address books on that Hiero network.
Like most SNARKs, this requires a one-time trusted setup to create a Structured Reference String (SRS), which are public parameters that both provers and verifiers will use.

To that end, this proposal specifies a cryptographic ceremony, based on a relatively standard “Powers of Tau” protocol, to generate the SRS for WRAPS.
Specifically, it details a protocol that can be executed by the council members -- specifically, those council members that also run consensus nodes -- where each participant supplies some secret entropy to the protocol.
The protocol has the guarantee that as long as one participant acts honestly, and deletes the secret entropy used during the protocol, we have security, in that no (computationally-bounded) adversarial entity can forge invalid proofs.

To minimize the impact of normal consensus operations, the protocol logic is not part of the consensus node software.
Moreover, the protocol operations are coordinated off-chain via an AWS S3 bucket, which also stores the intermediate protocol data.

## Background

Let us first recall some useful background on Hiero TSS as defined in HIP-1200 [1].
The Hiero TSS system contains two main sub-systems: WRAPS and HINTS.
HINTS is used to construct a threshold signature on a block, while WRAPS is used to prove the authenticity of the corresponding `HINTS verification key` (which a verifier will use to verify the threshold signature).
Specifically, each `TSS Address Book` has a threshold signature verification key as metadata, and WRAPS proves that the active `TSS Address Book` is a descendent of the genesis `TSS Address Book`.
Note that WRAPS can be used to prove authenticity for any threshold signing scheme (e.g. [3], [4]).

We have the following relevant TSS objects:

- `Schnorr public / private key`: used by WRAPS for the purpose of signing the next day’s `TSS Address Book`.
- `weight`: a u64 value denoting the node’s weight in TSS signing operations
- `TSS Address Book`: from the point of view of TSS, an address book is a list of (`Schnorr public key`, `weight`) pairs, along with its `HINTS verification key`.
- `ledger ID` 32-byte hash of the genesis `TSS Address Book`.
- `WRAPS proving key` : used to produce a (recursive) `WRAPS proof` that the next `TSS Address Book`  and `HINTS verification key`  are signed off by sufficient members of the prior `TSS Address Book` (signed using the `Schnorr private key`). This proving key is 2 GB, and, despite its name, is not a secret key and can be visible to the world.
- `WRAPS verification key`: used to verify the above `WRAPS proof`, with respect to a given `ledger ID`. This verification key is about 1.7 KB.
- `WRAPS proof` : recursive proof, which includes the cryptographic proof data along with the (public) statement: `ledger ID` and latest `TSS Address Book` hash and `HINTS verification key` hash. A `WRAPS proof` can be verified using only the `ledger ID` and the `WRAPS verification key`.

WRAPS has the following lifecycle:
- **Setup**: TSS ceremony that establishes the `WRAPS proving key` and `WRAPS verification key`.
- **WRAPS signing**: nodes in the previous `TSS Address Book` use their `Schnorr private key`  to sign the message = [next `TSS Address Book` || `HINTS verification key`], where || denotes concatenation. Specifically, they engage in a 3-round Schnorr multisig protocol [5]. The output of this protocol is an aggregate Schnorr signature, which makes the following task efficient.
- **WRAPS proving**: Anyone use the aggregate Schnorr signature and the  `WRAPS proving key` to generate a `WRAPS proof`, which completes the transition to the next `TSS Address Book`.

The remainder of this HIP discusses the TSS ceremony that forms the above **Setup** phase.

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
Please refer to the Hedera Cryptography [repository](https://github.com/hashgraph/hedera-cryptography) for the reference implementation.

## Open Issues
No known issues are currently under discussion.

## References

1. [HIP-1200: TSS](https://hips.hedera.com/hip/hip-1200)
2. Kohlweiss, M., Maller, M., Siim, J., Volkhov, M. (2021). *Snarky Ceremonies*. Cryptology ePrint Archive, Paper 2021/219. Retrieved from [https://eprint.iacr.org/2021/219](https://eprint.iacr.org/2021/219.pdf)
3. Garg, S., Jain, A., Mukherjee, P., Sinha, R., Wang, M., & Zhang, Y. (2023). *hinTS: Threshold Signatures with Silent Setup*. Cryptology ePrint Archive, Paper 2023/567. Retrieved from [https://eprint.iacr.org/2023/567](https://eprint.iacr.org/2023/567)
4. Das, S., Camacho, P., Xiang, Z., Nieto, J., Bünz, B., & Ren, L. (2023). *Threshold Signatures from Inner Product Argument: Succinct, Weighted, and Multi-threshold*. Cryptology ePrint Archive, Paper 2023/598. Retrieved from [https://eprint.iacr.org/2023/598](https://eprint.iacr.org/2023/598)
5. Maxwell, G., Poelstra, A., Seurin, Y., Wuille, P. (2018). *Simple Schnorr Multi-Signatures with Applications to Bitcoin*. Cryptology ePrint Archive, Paper 2018/068. Retrieved from [https://eprint.iacr.org/2018/068](https://eprint.iacr.org/2018/068)

## Copyright/license
This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
