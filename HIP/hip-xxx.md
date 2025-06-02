---
hip: <HIP number (assigned by the HIP editor), usually the PR number>
title: Native integration of Hedera Smart Contract Service (HSCS) with Hedera Consensus Service (HCS) topics
author: Walter Hernandez <walter.hernandez.18@ucl.ac.uk>, Juan Ignacio Ibañez <j.ibanez@ucl.ac.uk>, Paolo Tasca <p.tasca@exp.science>, Nikhil Vadgama <nikhil.vadgama@exp.science>, Jiahua Xu <jiahua.xu@ucl.ac.uk>
working-group: 
requested-by:  Walter Hernandez <walter.hernandez.18@ucl.ac.uk>, Juan Ignacio Ibañez <j.ibanez@ucl.ac.uk>, Paolo Tasca <p.tasca@exp.science>, Nikhil Vadgama <nikhil.vadgama@exp.science>, Jiahua Xu <jiahua.xu@ucl.ac.uk>
type: Standards Track
category: Service
needs-hedera-review: Yes
hedera-review-date: 
hedera-approval-status:
needs-hiero-approval: Yes
status: Draft
created: 2025-06-02
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/1207
updated: 2025-06-02
requires:
replaces:
superseded-by:
---

## Abstract
This proposal enables direct intraoperability between Hedera Smart Contracts and topics created using the Hedera Consensus Service (HCS). Smart contracts will be able to read and write to HCS topics through native integration. This allows for real-time event processing, decentralized messaging, and cross-application coordination without external intermediaries like Oracles.

## Motivation
Developers will be able to leverage HCS topics for secure, verifiable messaging and event tracking directly within smart contract logic, opening up use cases such as decentralized coordination, event-driven automation, and consensus-based contract execution.

## Rationale
Allowing smart contracts to interact natively with HCS topics enables applications to maintain tamper-proof records, trigger contract execution based on consensus-driven data, and create verifiable off-chain attestations. For example:
- A smart contract can listen to HCS topics and execute predefined actions based on received messages.
- HCS topics can serve as permissioned registries, where contracts validate participants' eligibility before executing transactions.
- Multiple smart contracts on Hedera and external applications (off-graph) can read and write from the same topics, enabling many-to-many communication patterns. For example:
  - External applications can post messages to HCS topics that smart contracts can react to.
  - Smart contracts can emit events to topics that external applications listen to.
- The Hedera mainnet provides the trusted consensus layer that ensures all participants within the same topics see the same sequence of events.

## User stories
- As a developer, I want my smart contract to read data from HCS topics to trigger predefined on-chain actions in a verifiable manner.
- As a developer, I want my smart contract to write data to HCS topics to enable automated event logging and cross-application messaging.
- As an enterprise, I want to use HCS topics as a decentralized messaging layer to coordinate state changes between smart contracts across multiple applications, on-graph and off-graph.

## Specification

![HederaDiagramTopics](https://github.com/user-attachments/assets/2e7a90b8-949d-4bac-a88b-39d6f3d1c861)

- External applications can coordinate indirectly by posting and reading from shared HCS topics.
- Smart contracts can serve as trusted validators and event generators for other smart contracts or external applications.
- An HCS topic acts as a consensus-driven message broker by providing persistent, ordered message queues leveraging Hedera’s consensus.
- The topic could function as an interoperability point of connection with the external applications including those on other blockchains.

### Example Specification

## Backwards Compatibility
The implementation maintains backward compatibility with existing HCS and Smart Contract systems. Applications currently using either system independently can continue to do so without modification. The integration layer adds new capabilities without breaking existing functionality.

## Security Implications
To maintain security and prevent unauthorized smart contract interactions with HCS topics:
- Contracts must be explicitly granted permissions to interact with specific HCS topics, ensuring controlled access.
- Contracts will not be able to delete or modify existing HCS topics. This ensures that the integrity of the topics is maintained and that the smart contract cannot interfere with the normal operation of the HCS system.
- The creation of HCS topics will still be done through the existing HCS APIs, and the smart contract will only be able to interact with topics that have been created beforehand.
- Messages between smart contracts and HCS will be cryptographically signed and verified, preventing tampering.
- The proposed architecture will avoid storing private keys within smart contracts to be able to interact with topics, ensuring security best practices.

## How to Teach This

## Reference Implementation

## Rejected Ideas

## Open Issues

## References
https://hedera.com/blog/use-cases-for-hcs-based-records-in-play-to-earn-nft-gaming
https://docs.hedera.com/hedera/tutorials/consensus/submit-your-first-message

## Copyright/license
This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
