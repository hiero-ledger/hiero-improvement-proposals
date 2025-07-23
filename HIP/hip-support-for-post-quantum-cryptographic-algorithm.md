---
hip: TBD
title: Support for Post-Quantum Cryptographic Algorithm
author: Jeremy Pansier <jpansier@sealcoin.ai>
working-group: Jeremy Pansier <jpansier@sealcoin.ai>, Micha Roon <micha.roon@hashgraph-group.com>, Nascimo Madieta <nmadieta@sealsq.com>
requested-by: Carlos Moreira <cmoreira@wisekey.com>, Jonathan Llamas <jllamas@sealcoin.ai>
type: Standards Track
category: Core
needs-council-approval: Yes
status: Draft
created: 2025-01-17
updated: 2025-01-17
---

## Abstract
Hedera currently supports two cryptographic algorithms: ECDSA (secp256k1) and Ed25519. This proposal recommends adding support for a post-quantum cryptographic algorithm, ML-DSA 87 (formerly known as Dilithium 5), to ensure resilience against quantum computer attacks. To accommodate the larger transaction sizes introduced by this algorithm, a hybrid fee model is proposed to ensure fairness and incentivize early adoption.

## Motivation
The rapid advancements in quantum computing pose a significant threat to classical cryptographic algorithms. Shor's algorithm, executed on a sufficiently powerful quantum computer, could potentially break both ECDSA and Ed25519 by solving problems like integer factorization and discrete logarithms in polynomial time.

This vulnerability exposes Hedera to risks such as "harvest now, decrypt later" attacks, where adversaries store encrypted data today to decrypt it later with quantum computers. Furthermore, regulatory pressures, such as mandates from NIST and the European Union, are increasingly urging the adoption of quantum-safe cryptography.

By integrating ML-DSA 87, a lattice-based cryptographic algorithm standardized by NIST, Hedera can:
- Protect future transactions from quantum threats.
- Address regulatory requirements for post-quantum readiness.
- Maintain its leadership in Distributed Ledger Technology (DLT) by offering quantum-resistant solutions.

## Rationale
### Algorithm Selection
**ML-DSA 87** was chosen for its:
- **Strong Security Foundation**: Based on the Module Learning With Errors (MLWE) problem, providing resilience against quantum attacks.
- **Efficiency**: Key sizes (~2.6 KB) and signature sizes (~4.6 KB) are manageable compared to other PQC candidates.
- **Ease of Integration**: Existing JavaScript implementations simplify integration into Hedera’s ecosystem.

#### Alternatives Considered
- **Falcon**: While Falcon offers smaller signature sizes (~1.2 KB), its reliance on complex floating-point arithmetic increases implementation risks and makes it more vulnerable to side-channel attacks. It is also impractical for constrained devices such as cold wallets.
- **SPHINCS+**: Though highly secure, SPHINCS+ has large signature sizes (up to 17 KB), making it unsuitable for DLT systems due to its impact on transaction sizes and throughput.
- **SQIsign**: Offers compact signatures (~335 bytes), but it requires significantly higher computational resources and remains less mature than ML-DSA 87.

### Hybrid Fee Model for PQC Adoption
To manage the resource demands of larger PQC transactions fairly, Hedera will implement a hybrid fee model:
- Transactions using ECDSA or Ed25519 will continue under the current fee structure.
- Transactions using ML-DSA 87 will incur slightly higher fees, reflecting the increased resource usage for processing and storage.

## User Stories
1. As an institutional user, I want to future-proof my transactions against quantum attacks to ensure long-term data security and compliance with regulatory standards.
2. As a developer, I want to integrate ML-DSA 87 into my Hedera-based applications to offer secure solutions to clients.
3. As an end user, I want to sign transactions with a quantum-resistant key to protect my assets from future threats.

## Specification
This HIP proposes the implementation of ML-DSA 87 alongside existing cryptographic algorithms. The following functionalities will be added:
- Enable users to generate ML-DSA 87 key pairs.
- Allow transactions to be signed using ML-DSA 87 private keys.
- Add support for verifying signatures created with ML-DSA 87 private keys.
- Modify Hedera SDKs and APIs to include ML-DSA 87 support for key generation, signing, and verification.
- Introduce a dynamic fee structure that adjusts based on the cryptographic algorithm used, with higher fees for PQC transactions and incentives for early adoption.

The recommended implementation is based on the **Noble Post-Quantum** library for its:
- Lightweight design and active maintenance.
- Compatibility with JavaScript and Node.js environments.

For performance-critical scenarios, WebAssembly-based libraries like Dilithium-crystals can be evaluated post-integration testing.

## Backwards Compatibility
This proposal introduces no breaking changes. Existing cryptographic algorithms (ECDSA and Ed25519) will continue to be supported, ensuring full backward compatibility. The hybrid fee model ensures that users have the flexibility to choose between classical and quantum-resistant algorithms.

## Security Implications
### Enhanced Security
Protects Hedera’s ecosystem from future quantum threats and mitigates risks associated with the "harvest now, decrypt later" attacks.

### Potential Concerns
Increased key and signature sizes (~4.6 KB) may slightly impact transaction size and throughput but remain manageable within Hedera’s architecture. The hybrid fee model addresses the resource demands associated with larger transaction sizes.

## How to Teach This
- **Documentation**:
    - Update Hedera’s official documentation with detailed explanations of ML-DSA 87 and the hybrid fee model.
    - Include code examples for generating keys, signing, and verifying signatures.
- **Developer Tutorials**:
    - Publish step-by-step guides for integrating ML-DSA 87 into Hedera-based applications.
    - Provide examples of how the hybrid fee model impacts transaction costs.
- **Workshops and Webinars**:
    - Organize sessions on the importance of quantum-safe cryptography and Hedera’s role in leading this transition.

## Reference Implementation
The implementation will include:
•	A functional integration of ML-DSA 87 for key generation, signing, and verification.
•	Unit and benchmark tests to validate correctness and performance.
•	Detailed documentation and code samples.

## References
1. [NIST Post-Quantum Cryptography Standardization Process](https://csrc.nist.gov/Projects/post-quantum-cryptography)
2. [ML-DSA 87 Specification](https://pq-crystals.org/dilithium/data/dilithium-specification-round3-20210208.pdf)
3. [ML-DSA 87 FIPS Standard Publication](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf)
4. [SEALSQ Partnership Announcement](https://www.sealsq.com/investors/news-releases/sealsq-partnering-with-hedera-in-the-next-generation-of-post-quantum-semiconductors)
5. [Hedera Blog Post: Post-Quantum Crypto](https://hedera.com/blog/post-quantum-crypto)
6. [Hedera Blog Post: Are Ed25519 Keys Quantum-Resistant?](https://hedera.com/blog/are-ed25519-keys-quantum-resistant-exploring-the-future-of-cryptography)

## Copyright/license
This document is licensed under the Apache License, Version 2.0 --
see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
