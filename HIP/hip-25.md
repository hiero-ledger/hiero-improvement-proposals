---
hip: 25
title: On-disk Virtual Merkle Tree
author: Richard Bair (@rbair23), Jasper Potts (@jasperpotts)
type: Standards Track
category: Core
needs-council-approval: Yes
status: Final
created: 2021-09-07
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/139
updated: 2021-09-17
---

## Abstract

Virtualize the merkle tree as an on-disk data structure to support scaling to billions of entities per node.

## Motivation

Each node in the network must independently maintain the total state of the system at any given point in time.
This state is stored in memory as a Merkle tree. As the size of the state grows, the amount of memory used for
storing the state likewise grows. Nodes on the Hedera network have a large amount of RAM available (on the order
of 256GB). Some of this RAM is used for the operating system, some for off-heap data structures by the JVM, and
a large portion of it (on the order of 150GB-200GB) as Java heap. A large portion of the Java heap must be reserved
for the garbage collector so that it may operate optimally. Some of this RAM is used for transient objects during
state saving and other needs such as gossiping and hashgraph, and most of it for Merkle trees storing the state.

As the amount of state in the system grows, RAM becomes increasingly scarce. By _virtualizing_ the tree on disk,
we can move much of the state out of RAM, enabling Hedera to scale to billions of entities. This HIP proposes the
creation of a **virtual merkle tree** and custom on-disk database that is fault tolerant, fast, and highly scalable.

The initial design objective was to enable very fast and highly-scalable smart contracts. In today's system, a
Postgres database is used for storing both smart contract byte code and smart contract state (256-bit word key/value
pairs) as binary blobs. There are two problems with this approach. First, reading and writing large blob data is
faster working directly with the disk than going through JDBC and the other layers that SQL adds. Second, for smart
contract state where the smart contract changes just a single value, we read the entire blob from Postgres, change a
single 256-bit word, hash the entire blob, and write it all back to the database. By creating a virtual merkle tree,
we are able to represent smart contract key/value pairs as leaves in the tree, reading only the necessary data,
writing only the necessary data, and hashing only the necessary data resulting in huge performance gains.

Virtualization may prove useful for other entities beyond just smart contracts. NFTs could also be virtualized,
giving Hedera the capability to support hundreds of millions or more NFTs.

Critically, virtualizing the Merkle tree state should **not** impact the 10K TPS SLA of the Hedera network.

## Rationale

### Design Goal #1: Minimize Changes

A virtual Merkle tree should fit naturally into the existing in-memory Merkle tree code and mechanisms, including
tree traversal, hashing, state signing, state saving, and reconnect, while storing the actual data on disk and
**realizing** (i.e. bringing into memory) as little data as possible. Some modifications to the core systems and
algorithms may be needed, but we want to keep these changes to only the required minimum.

### Design Goal #2: Scale According to TPS not Number of Entities

Our ability to scale should be based primarily on the TPS and not the number of entities. That is, the system
with 10M entities and with 100M entities should exhibit similar memory characteristics if executed with the
same load (TPS). They won't compare exactly, since the Merkle tree itself will be larger and require more
internal (branch) nodes, but it should be true as we approach the asymptote that an increase in entity count
has little impact on the overall performance of the system, subject to disk characteristics.

### Design Goal #3: Fault Tolerant

The on-disk database should be designed to survive system faults. In particular, the design must account for
nodes which die unexpectedly, and those that go offline as part of an upgrade. As is shown in the specification,
this is not a particularly difficult problem to solve, since the network is by design able to restore from
saved state and reconnect.

### Design Goal #4: Variable Sized Data

Our on-disk merkle tree data structures should be designed for variable sized data. We need to store smart
contract bytecode, which is variable sized, and smart contract data, which is not. Another reason for supporting
variable sized data is to support data migration over time. When serializing an account to disk, we need to store
the version of the data along with the data so that future versions will be able to deserialize the older versioned
data, making data migration much simpler by basically making it a non-issue (no migration necessary).

### Design Goal #5: Mechanical Sympathy

Superior performance requires designing the entire solution in a holistic manner taking into account the manner in
which the underlying storage mechanisms work. Initial design attempts were based on memory mapped files with random
reads and writes, and at low entity counts (< 200M) this looked very promising. As we increased the load testing to
include 1 billion entities, we found that memory mapped files performance dropped off a cliff due to write
amplification.

As another example, we began by making use of standard Java collections for various uses. As we profiled, we found
that using `long` variables was much better since they allowed us to use native CAS (compare-and-swap) support of the
CPU. Since the Java collections box primitives like `long`, it was not possible to use them and get the best
performance.

By understanding the nature of the machine we are able to design a solution that leads to higher performance.

### Design Goal #6: End-User Transparency

Virtual merkle is a core implementation detail of the product and has no direct user-visible impact. It has an
indirect user-visible impact in the number of entities supported on the platform and overall performance of smart
contracts, but does not expose any new HAPI or other API.

### Design Goal #7: Fast Startup

The startup time of the system must not appreciably grow based on the size of the state. We want to design a
system that does not require scanning of the entire state at startup.

## User stories

N/A
  
## Specification

There are no user-visible features as a result of this HIP, so we do not present any formal specification

## Backwards Compatibility

As virtual merkle trees are adopted by Hedera Services, their adoption must be transparent to the user and contain
no backwards incompatibilities. Code in Hedera Services will be responsible for migrating state from in memory
merkle trees and/or Postgres blobs into virtual trees. This may result is larger than average upgrade windows.

## Security Implications

Smart contracts have a gas price for accessing key/value pairs and for creating new pairs. It is critical that
we test the true cost of accessing and mutation key/value pairs from smart contracts and prove that the true cost
does not exceed the gas price, otherwise a malicious smart contract could perform a DOS on the network by
accessing or mutating key/value pairs (so-called `broken metre` attack).

## How to Teach This

N/A

## Reference Implementation

N/A

## Rejected Ideas

### Off-the-shelf Databases

An explicit non-goal is to force the use of an off-the-shelf database, such as Postgres, RocksDB, LMDB, or others.
After extensive POC and prototyping, we found all off-the-shelf solutions to have limitations that we were not
willing to accept. RocksDB exhibited numerous seg-faults and inferior read performance. LMDB exhibited inferior
write performance as the number of entities exceeded two hundred million. We tested more than a half-dozen
different systems and found that none of them met our criteria.

## Open Issues

N/A

## References

N/A

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
