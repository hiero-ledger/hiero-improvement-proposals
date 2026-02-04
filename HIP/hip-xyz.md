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

WRAPS needs two kinds of public parameters before it can produce and verify proofs: a universal set that can be reused across many proofs, and a circuit-specific set that is tied to the WRAPS circuit itself. The goal of this ceremony is to produce both sets while minimizing trust in any single party and while allowing anyone to independently verify the outcome.

The standard way to do this is to run a Phase 1 ceremony that establishes a shared pool of randomness. From that single Phase 1 output, the coordinator can deterministically derive the universal parameters and also produce the initial input for a Phase 2 ceremony that binds the parameters to the WRAPS circuit. Because these derivations are deterministic and publicly verifiable, the coordinator is explicitly untrusted: anyone can reproduce the same outputs from the published Phase 1 result.

This HIP therefore separates setup into three stages: a universal Phase 1 multi‑party computation, a deterministic post‑processing step, and a circuit‑specific Phase 2 ceremony. Security follows the standard multi‑party guarantee: as long as at least one contributor in each relevant phase adds fresh randomness and deletes their secret material, the resulting parameters are secure.

## Specification

We implement the ceremony protocol verbatim from [2], and summarize the protocol flow below, at a high level.

### Protocol Phases

The ceremony is a sequential, multi‑party process: contributors act one at a time, and the coordinator only performs deterministic steps that anyone can reproduce. It consists of three phases. The coordinator kickstarts the process by publishing a fixed starting file and a public schedule that determines who contributes and in what order. First, Phase 1 collects contributor randomness to build a universal pool of parameters. Next, the coordinator next derives the universal parameters needed by the system and prepares the starting input for Phase 2. Finally, Phase 2 adds contributor randomness again to bind the parameters to the WRAPS circuit.

On completion, the coordinator MUST publish the final parameter bundle containing `universal_params` and `circuit_params`, as well as a complete transcript sufficient for independent verification and long‑term archival.


### Ceremony Artifacts

The transcript MUST clearly separate and label artifacts for Phase 1, the derived universal parameters, and Phase 2 outputs. This is required so that an independent third-party verifier can replay the ceremony and validate each transition without ambiguity.

### Phase 1 (Universal Setup)

Phase 1 produces a universal pool of parameters that are not tied to any specific circuit. Each contributor takes the prior output, mixes in fresh randomness, and then deletes their secret material. The final output, `phase1_final`, MUST be sufficient to deterministically derive `universal_params(max_degree)` and `phase2_initial_params`.


### Post-Processing (Coordinator, Untrusted)

From `phase1_final`, the coordinator performs a deterministic computation to prepare for Phase 2. First, it derives `universal_params(max_degree)` for the commitment scheme used in WRAPS. The `max_degree` MUST be published in advance and included in the final manifest, and anyone MUST be able to recompute `universal_params` from `phase1_final`. Second, it produces `phase2_initial_params`, which is the starting input for the circuit‑specific ceremony. This step MUST be reproducible and accompanied by signatures from all the participants.

### Phase 2 (Circuit-Specific)

Phase 2 binds the parameters to the WRAPS circuit by producing the circuit‑specific proving and verifying keys. It takes `phase2_initial_parmas` and a published commitment to the WRAPS circuit description as inputs. Each contributor again adds fresh randomness and deletes their secret material.

The outputs of this phase are `WRAPS proving key` (roughly 2 GB), and the `WRAPS verification key`.


## Security Implications

Security holds as long as at least one participant in the relevant phase(s) contributes true randomness and deletes it after the ceremony.
On the contrary, an attacker can forge invalid proofs if they are able to attain the entropy values of all participating nodes.

## Reference Implementation
Please refer to the Hedera Cryptography [repository](https://github.com/hashgraph/hedera-cryptography) for the reference implementation.


## References

1. [HIP-1200: TSS](https://hips.hedera.com/hip/hip-1200)
2. Kohlweiss, M., Maller, M., Siim, J., Volkhov, M. (2021). *Snarky Ceremonies*. Cryptology ePrint Archive, Paper 2021/219. Retrieved from [https://eprint.iacr.org/2021/219](https://eprint.iacr.org/2021/219.pdf)
3. Garg, S., Jain, A., Mukherjee, P., Sinha, R., Wang, M., & Zhang, Y. (2023). *hinTS: Threshold Signatures with Silent Setup*. Cryptology ePrint Archive, Paper 2023/567. Retrieved from [https://eprint.iacr.org/2023/567](https://eprint.iacr.org/2023/567)
4. Das, S., Camacho, P., Xiang, Z., Nieto, J., Bünz, B., & Ren, L. (2023). *Threshold Signatures from Inner Product Argument: Succinct, Weighted, and Multi-threshold*. Cryptology ePrint Archive, Paper 2023/598. Retrieved from [https://eprint.iacr.org/2023/598](https://eprint.iacr.org/2023/598)
5. Maxwell, G., Poelstra, A., Seurin, Y., Wuille, P. (2018). *Simple Schnorr Multi-Signatures with Applications to Bitcoin*. Cryptology ePrint Archive, Paper 2018/068. Retrieved from [https://eprint.iacr.org/2018/068](https://eprint.iacr.org/2018/068)

## Copyright/license
This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
