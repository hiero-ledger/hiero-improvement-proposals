---
hip: 1292
title: Hiero AnonCreds Method
author: Keith Kowal (keith.kowal@hashgraph.com)
working-group: Diane Mueller (diane@hbar.fund), AlexanderShenshin
type: Informational
needs-hiero-approval: No
status: Active
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1292
created: 2025-08-25
updated: 2025-10-22
---

# Abstract

This Information HIP introduces the **Hiero AnonCreds Method**, a specification for publishing and resolving AnonCreds objects—such as schemas, credential definitions, and revocation registries—on Hiero networks. Once established, the method will be submitted to the **Hyperledger AnonCreds Methods Registry** to enable ecosystem visibility and alignment.

# Motivation
AnonCreds is the leading privacy-preserving credential format with broad adoption across self-sovereign identity (SSI) ecosystems. To integrate Hiero networks into this landscape, we must publish a clear method specification describing how AnonCreds objects are stored and resolved via Hiero networks.  

By publishing the method, we enable everyone to build compatible libraries and agents, and we align Hiero networks with existing AnonCreds VDRs like Indy, Cheqd, and Cardano.

# Rationale

- **Interoperability**: Having a published method ensures interoperability across agents, wallets, and identity ecosystems.  
- **Inclusivity**: Anyone can implement against the method—whether using the Hiero Python DID repo, Hiero JS DID repo, ACA-Py plugins, or custom tools.  
- **Discoverability**: Listing in the Hyperledger AnonCreds Methods Registry shows the community that Hiero networks supports AnonCreds.  
- **Governance**: A Hiero repo provides versioning, updates, and clarity for maintainers and contributors.  

# Specification

## High-Level Summary

The Hiero AnonCreds Method defines how AnonCreds objects are anchored, resolved, and maintained on the Hiero network:

- **Schemas**: JSON schema definitions are stored using Hiero Consensus Service (HCS), aligned with HCS-1 file storage conventions.  
- **Credential Definitions**: Published as HCS objects containing cryptographic material for credential issuance and verification.  
- **Revocation Registry Definitions**: Anchored on HCS for long-term persistence.  
- **Revocation Registry Entries**: Updated dynamically on-chain, providing real-time revocation status.  
- **Resolution**: Performed through Hiero Mirror Node APIs, allowing verifiers and wallets to retrieve the latest state.  
- **Identifiers**: Objects are referenced using DID-compatible identifiers (`<issuer-did-on-hedera>/anoncreds/<anoncreds-version>/<object-type>/<hcs-topic-id>`).  

## Alignment with DID Methods

The method extends the **Hedera DID approach (HIP-762)** by providing specific rules for AnonCreds object handling.  

Similar to how DID methods are published to help developers understand the lifecycle of DIDs, the AnonCreds Method must be published to help developers understand how credential data is created, updated, and resolved on Hiero networks.

## Example Resources

- Draft spec: [DSR Hedera AnonCreds Method](https://dsrcorporation.github.io/hedera-anoncreds-method/)  
- Hyperledger Registry: [AnonCreds Methods Registry](https://github.com/hyperledger/anoncreds-methods-registry)  
- DID context: [W3C DID Extensions – DID Methods](https://www.w3.org/TR/did-core/)  

## Reference Implementations

Existing Hiero ecosystem libraries already support AnonCreds operations and serve as proof points:

- [Hiero Python DID repo] – Python SDK support for DID resolution and credential flows  
- [Hiero JS DID repo] – JavaScript SDK support for DID resolution and AnonCreds integration  

These demonstrate how to implement the method and will benefit from a formal, discoverable specification.

## Submission to Hyperledger Registry

Hiero will submit the AnonCreds Method to the **Hyperledger AnonCreds Methods Registry** by creating a PR with:

- A new Markdown file describing the method (`method-anoncreds-hedera.md`)  
- Metadata in `specs.json` including method identifier, maintainers, and spec link  
- Reference to the `hiero-anoncreds-method` GitHub repo  

This ensures Hiero networks such as Hedera appears alongside other recognized AnonCreds VDRs like Indy, Cheqd, and Cardano.

# Request

This HIP proposes:

1. Host Hiero Anonreds Method in appropriate Hiero repo.
2. Submission of the method entry into the Hyperledger AnonCreds Methods Registry.  
3. Ongoing updates and community contributions through Hiero governance.  

# Security Considerations

The method spec itself introduces no new risks, but ensures secure anchoring and resolution flows are well-documented, reducing the chance of insecure ad-hoc implementations.

# References

- [Hedera AnonCreds Draft (DSR)](https://dsrcorporation.github.io/hedera-anoncreds-method/)  
- [Hyperledger AnonCreds Methods Registry](https://github.com/hyperledger/anoncreds-methods-registry)  
- [HIP-762: Hedera DID Method](https://hips.hedera.com/hip/hip-762)  
- [W3C DID Methods Registry](https://www.w3.org/TR/did-spec-registries/#did-methods)  
- [Hyperledger AnonCreds Specification](https://hyperledger.github.io/anoncreds-spec/)  

# License

This document is released under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).
