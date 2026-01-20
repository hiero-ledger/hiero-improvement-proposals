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

This HIP specifies a two-phase trusted setup ceremony (a “Powers of Tau” style MPC) to generate the Structured Reference String (SRS) required by Hedera’s recursive zk-SNARK proof system (“WRAPS”) used in TSS (HIP-1200) to cryptographically validate the full history of Hedera address books.

The ceremony produces two SRS components:
  1.  Groth16 SRS: Public parameters required to generate and verify Groth16 proofs used inside WRAPS.
  2.  KZG SRS: Public parameters required for the KZG polynomial commitment scheme used by Nova (or Nova-style folding/accumulation) within WRAPS.

Both SRS components are generated through a global collaborative ceremony where parties take turns contributing secret entropy. The ceremony yields (1) the finalized SRS bundle (Groth16 SRS + KZG SRS) usable by provers and verifiers, and (2) a public transcript enabling any observer to verify correct ceremony progression.

The ceremony is performed exclusively by Hedera Council members, specifically those who operate the secure signing computers used for network governance transactions. Contributions are coordinated off-ledger via an AWS S3 bucket, producing no footprint on consensus operation. A dedicated coordinator machine performs compute-heavy untrusted post-processing steps.

## Motivation

HIP-1200’s threshold signing design relies on a recursive proof system that proves—and allows efficient verification of—the validity of the entire historical sequence of Hedera address books. WRAPS is built from (at least) two cryptographic subsystems that require one-time public parameters:
  • A Groth16 proving/verification system, which requires a Groth16 SRS.
  • A Nova-based recursion layer that uses a KZG polynomial commitment scheme, which requires a KZG SRS.

Without a secure, auditable ceremony for these SRS components:
  • There is no credible basis for global trust in the parameters.
  • Compromise of the “toxic waste” secrets could enable forged proofs, undermining WRAPS soundness and downstream applications (e.g., cross-network state proofs).
  • Ledger IDs cannot be upgraded from temporary placeholders to cryptographically meaningful identifiers.

This HIP defines a ceremony that:
  • Uses an established “at-least-one-honest” MPC model,
  • Keeps the process within Hedera Council operational controls, and
  • Avoids changes to Hedera consensus operation by coordinating off-ledger.

## Terminology

  • SRS bundle: The combined public parameters for WRAPS, comprising a Groth16 SRS and a KZG SRS.
  • Groth16 SRS: Structured reference string used by Groth16 provers/verifiers (circuit-specific in Phase 2).
  • KZG SRS: Structured reference string used to commit to polynomials and open evaluations in KZG (typically universal up to a max degree).
  • Toxic waste: The secret randomness used by a contributor that must be securely destroyed.
  • Contributor / Participant: A Council member (via their secure signing computer) performing one MPC contribution step.
  • Coordinator: An additional machine that performs untrusted, compute-heavy post-processing.
  • Transcript: A sequence of signed artifacts (challenges/responses, metadata, hashes) proving correct ceremony flow.
  • Phase 1 (PoT): Universal “powers of tau” accumulation producing base powers used to derive both Groth16 and KZG parameters.
  • Phase 2 (Groth16): Circuit-specific accumulation producing Groth16 proving/verifying keys for WRAPS.

## Rationale

## User stories

## Technical Overview


## Specification


### Schnorr proof keys and the address book chain of trust


### hinTS BLS keys and TSS signatures


### Verifying `BlockProof`s as a stream consumer



## Security Implications


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
