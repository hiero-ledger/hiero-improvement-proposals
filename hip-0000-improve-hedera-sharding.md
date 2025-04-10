---
hip: <HIP number (assigned by the HIP editor), usually the PR number>
title: "Improve Hedera Sharding via Dynamic Committee Reconfiguration"
author: Ziwei Wang <t4stek1ng@whu.edu.cn>, Cong Wu <cnacwu@gmail.com>, Paolo Tasca <p.tasca@exp.science>
working-group: <List of the technical and business stakeholders' names and/or usernames, or names and emails. Ex: John Doe <@johnDoeGithub1778>, Jane Smith <jane@email.com>>
requested-by: <Name(s) and/or username(s), or name(s) and email(s) of the individual(s) or project(s) requesting the HIP. Ex: Acme Corp <request@acmecorp.com>>
type: Standards Track
category: <"Core" | "Service" | "Mirror" | "Application">
needs-council-approval: <"Yes" | "No">
status: Draft
created: 2025-03-13
discussions-to: https://github.com/hashgraph/hedera-improvement-proposal/discussions/1150
updated: <Latest date HIP was updated, in YYYY-MM-DD format.>
requires: <HIP number(s) this HIP depends on, if applicable. Ex: 101, 102>
replaces: <HIP number(s) this HIP replaces, if applicable. Ex: 99>
superseded-by: <HIP number(s) that supersede this HIP, if applicable. Ex: 104>
---

## Abstract

This HIP proposes a scalable enhancement to Hedera’s architecture through a multi-tier sharding framework that introduces Local Committees for intra-shard transaction processing, a Global Committee for coordinating cross-shard consistency, and dynamic committee reconfiguration for robustness. To support this architecture, the proposal integrates upcoming Block Stream and Block Node initiatives, which consolidate transaction, event, state, and proof data into a single verifiable stream, enabling external services to independently validate network state via Threshold Signature Scheme (TSS). Block Nodes, positioned between consensus and mirror nodes, consume and serve this unified data format, promoting decentralized verification, state proof services, and advanced querying. With this layered approach—shards for computational load distribution, Block Streams for unified verifiable output, and Block Nodes for scalable data access—Hedera improves throughput, reinforces integrity, and supports future-proof decentralized applications.This HIP proposes a scalable enhancement to Hedera’s architecture through a multi-tier sharding framework that introduces Local Committees for intra-shard transaction processing, a Global Committee for coordinating cross-shard consistency, and dynamic committee reconfiguration for robustness. To support this architecture, the proposal integrates upcoming Block Stream and Block Node initiatives, which consolidate transaction, event, state, and proof data into a single verifiable stream, enabling external services to independently validate network state via Threshold Signature Scheme (TSS). Block Nodes, positioned between consensus and mirror nodes, consume and serve this unified data format, promoting decentralized verification, state proof services, and advanced querying. With this layered approach—shards for computational load distribution, Block Streams for unified verifiable output, and Block Nodes for scalable data access—Hedera improves throughput, reinforces integrity, and supports future-proof decentralized applications.

------

## Motivation

Despite Hedera’s high throughput through the Gossip-about-Gossip protocol, the growing size of the network introduces challenges including:

- Scalability bottlenecks from requiring each consensus node to maintain the full DAG’s recent state.
- Increasing communication overhead from Gossip spreading every event to every node.
- Security vulnerabilities stemming from static committee structures, making individual shards more susceptible to targeted attacks.

To alleviate these limitations, this HIP introduces dynamic sharding with committee reconfiguration, supported by the modular integration of Block Nodes and unified Block Streams. These accommodate verification, block indexing, and shard state proofs efficiently—without overburdening consensus nodes.

------

## Rationale

The proposed design extends research from systems such as OmniLedger and RapidChain while embracing Hedera-specific innovations like the Block Stream and Block Node models:

- Reduces per-node workload by localizing data and limiting consensus responsibilities to relevant shards.
- Parallelizes transaction processing across shards to increase throughput.
- Incorporates Block Streams to unify state with event and transaction data, enabling downstream services (such as Block Nodes) to perform decentralized state verification and service provisioning.
- Leverages mirror nodes as full archives for historical reference while Block Nodes supplement data discoverability and verification.

Through this design, Hedera maintains consensus integrity, improves scalability, and supports decentralized application demands with dynamic committee realignment to reflect network conditions.

------

## User Stories

1. Node Operator:
   I want my node to only process shard-specific data and allow mirror or Block Nodes to manage full history and verification workloads.
 
2. Application Developer:
   I need reliable and low-latency cross-shard communication and access to trustworthy state proofs through Block Streams or Block Nodes.

3. Data Service Provider:
   I want to run a Block Node that ingests Block Streams to provide enhanced APIs and decentralized state proof services with optional monetization.
 
4. Auditor / Security Engineer:
   I require proofs of transaction execution and determinism through signed block data (TSS) and reproducibility via per-shard Block Streams.

------

## Specification

### Architecture

- Local Committees
  - Composed of subsets of consensus nodes.
  - Each manages its own shard’s ledger via a localized DAG.
  - Each committee produces Block Streams (a unified record format) of their shard history.
  - Uses shard-specific state proofs and aligns with the network-level TSS for consensus.

- Global Committee
  - Composed of rotating coordinators from Local Committees.
  - Handles cross-shard transaction batching and finalizes inter-shard state updates.
  - Produces high-level Block Streams that include batch state transitions verified through the TSS from participating shards.

- Block Stream Integration
  - All shard DAGs output Block Streams, replacing traditional event and record stream formats.
  - Each Block in the stream includes:
    - All relevant events and transactions
    - Resulting state changes
    - A threshold signature (TSS) from the Global/Local Committee
  - These blocks are public, verifiable, and replayable.

- Block Nodes
  - Purpose-built verifier nodes ingest block streams and store locally the most recent shard/global state.
  - Block Nodes expose offline verification, state proofs, and data availability APIs.
  - They provide incentives and decentralized operations for community stakeholders.

- Mirror Nodes
  - Mirror nodes continue to store full history across shards.
  - Operators or third parties can chose to elevate their nodes with Block Stream parsing capability to become Block Nodes.

### DAG Slicing and Data Partitioning

- Each Local Committee publishes periodic checkpoints and Block Streams tagged with shard IDs.
- DAG is naturally partitioned by time and committee ownership.
- State changes are recorded as state deltas in the Block Stream; these can be replayed or queried directly through Block Nodes.

### Cross-Shard Communication

1. Intra-Shard Phase: 
   Local Committees process transactions and produce round-based Block Streams.

2. Global Coordination Phase:
   Cross-shard transactions are handled through the Global Committee using deterministic atomic commit patterns (e.g., 2PC). Round-level consensus is captured via threshold-signed global Block Streams.

3. Finalization Phase:
   Finalized transactions and consensus-related changes are broadcast to relevant shard-local Block Streams. All updates are verifiable using TSS.

### Committee Reconfiguration

- Nodes dynamically shuffled using entropy derived from consensus timestamps and verifiable delay functions (VDFs).
- Reshuffling ensures unpredictability and minimizes adversarial targeting.
- Shard transitions and committee changes are encoded in Block Streams along with evidence for auditability.

------

## Compatibility and Transition
- Existing nodes will continue to produce legacy output formats temporarily.
- A transitional Dual Mode operates both RecordStream V6 and Block Stream until full migration.
- Mirror Nodes may be upgraded gradually into Block Nodes or intermediate verifiers.
- APIs provided by Block Nodes are designed for backward compatibility and progressive adoption.

------

## Security Implications

- Randomized dynamic committee assignments reduce predictability and risk of collusion within shards.
- Threshold-signed Block Streams make it impossible to forge shard or global consensus without compromising quorum.
- Block Nodes provide alternate trustless validation paths—independently parsing Block Streams to verify DAGs.

------

## How to Teach This

- Documentation
  - Updated developer portal sections on Block Stream format, Block Node deployment, and shard-oriented APIs.
  - Protocol primer and migration tutorials for legacy node operators.

- Developer Bootcamps / Workshops
  - Live demonstrations covering intra-/cross-shard transactions, Block Stream validation, and Block Node setup.

- Community Events & Demos
  - Hands-on sessions explaining how Block Nodes can be deployed for custom applications, compliance tools, and analytics.

------

## References

1. Wang, Z,. et al.[Investigating Sharding Advancements, Methodologies, and Adoption Potential in Hedera](https://cdn.prod.website-files.com/669a53c60f11ddb32e07366a/67dda22b3182a5f07ac28d2b_Discussion%20Paper%2008-2025%20(1).pdf)
2. Kokoris-Kogias, E., et al. “OmniLedger: A Secure, Scale-Out, Decentralized Ledger via Sharding.”
3. Zamani, M., et al. “RapidChain: Scaling Blockchain via Full Sharding.”
4. Solat, et al. "Sharding Distributed Databases: A Critical Review."
5. Baird, L. “The Swirlds Hashgraph Consensus Algorithm: Fair, Fast, and Secure.”
6. Hedera Mirror Node Documentation – [Hedera Core Concepts](https://docs.hedera.com/hedera/core-concepts/mirror-nodes).
7. Luu, L., et al. “Elastico: A Secure Sharding Protocol For Open Blockchains.”
------

## Open Issues

- **Reconfiguration Thresholds:**
  Further research is required to determine the optimal thresholds and triggers for committee reconfiguration.
- **Simulation and Testing:**
  Additional simulation and testing must validate the performance improvements and verify security guarantees under varying network loads.
- **Interoperability During Transition:**
  The interoperability between legacy nodes and sharded nodes needs to be robustly defined and thoroughly tested.
- **State Proof Implementation:**
  Further exploration is needed regarding the design trade-offs, computational overhead, and practical implementation of state proofs for shard validation.
- **Randomness Sources:**
  The selection and integration of randomness sources with a high level of entropy and unpredictability must be carefully evaluated.
