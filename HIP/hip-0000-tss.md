---
hip: 0000
title: The hinTS threshold signature scheme 
author: Michael Tinker <@tinker-michaelj>
working-group: Rohit Sinha <@rsinha>, Edward Wertz <@edward-swirldslabs>, Neeha Sompalli <@Neeharika-Sompalli>
requested-by: Hashgraph
type: Standards Track
category: Service
needs-hedera-review: Yes
hedera-review-date: 
hedera-approval-status: 
needs-hiero-approval: Yes
status: Draft
created: 2025-04-15
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/1181
updated: 2025-04-15
requires: 
replaces: 
superseded-by: 
---

## Abstract
Hiero networks sign blocks in the V6 record stream by each node in the network publishing an 
RSA signature on the hash of every block it produces as specified in [HIP-415](https://hips.hedera.com/hip/hip-415). 
The network's **aggregate signature** on block `N` is any combination of valid RSA **partial signatures** 
from nodes holding at least 1/3 of the network stake.

This scheme is simple but inefficient. Verifiers must track the node RSA keys published in the 
network state, which is fairly costly. Assuming a roughly uniform stake distribution, the 
aggregate signature size and verification work needed both grow linearly with the number of 
nodes in the network. And verifying RSA signatures on EVM chains is impractical, since there 
is no native precompile support.

We propose Hiero networks adopt the **hinTS** threshold signature scheme (TSS) from [1] in 
tandem with adopting the block stream proposed in [HIP-1056](https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1056). 
The hinTS scheme uses a single BLS aggregate signature that can be cheaply verified by an 
EVM smart contract. It achieves this by pairing each signature with a zk-SNARK proving the 
signature is a valid aggregation of partial signatures from BLS keys in the network address 
book for nodes with a threshold amount of weight.

Verifiers will verify Hiero hinTS signatures under a sequence of BLS **verification keys** 
specific to each network, corresponding to the chain of address books that network has adopted.
Starting with the genesis address book, each time the network adopts a new address book, it 
will publish a recursive zk-SNARK in the block stream that proves the new address book's 
verification key belongs to the network's **chain of trust**.

## Motivation
Inter-ledger communication between Hiero networks and EVM chains requires a efficient
signature scheme whose cryptography has robust support in EVM smart contracts. Specifically,
no matter the size of the Hiero network, the scheme must yield fixed-size signatures that 
require only fixed-time verification work. Anything less makes inter-ledger communication 
impractical.

## Rationale
The appeal of the hinTS scheme is described extensively and succinctly in [1], so we will 
not repeat each reason to adopt it in this HIP. The main benefit we do want to emphasize,
other than efficiency, is that hinTS lets nodes be assigned **exact weights**, even at the
resolution of 64-bit stake weights. 

This is quite attractive because for an aBFT proof-of-stake blockchain, the ideal 
**access structure** needed to form a network signature is the agreement of any set of 
nodes holding at least 1/3 of the total consensus weight. In a Hiero network, consensus 
weights are the whole number of HBARs staked to each node, and hence require 64-bit 
precision since each network has a fixed supply of 50B HBAR.

So adopting hinTS lets Hiero networks impose exactly the access structure that is 
most natural for the aggregate signatures of a proof-of-stake blockchain.

## User stories
- As a Hiero network user, I want to be able to verify the signature of any block proof
created by the network _without_ keeping the full address book history and the RSA keys of 
every node throughout that history.
- As a Hiero network user, I want to do a fixed amount of work to verify each block proof.
- As a Hiero network user, I want inter-ledger communication with EVM blockchains to enable, 
for example, transferring tokens from Hedera mainnet to Ethereum mainnet without a bridge.
- As a Hiero block node operator, I want concise network signatures to reduce the amount 
of information I need to store and serve to block proof consumers.

## Specification
Our specification has three parts.
1. First, we define the TSS **address book** and how we can use **proof keys** to link one 
address book to the next in a cryptographic chain of trust that binds arbitrary **metadata** 
to each address book in the chain. 
2. Next, we outline the information flow in the construction of a hinTS scheme, emphasizing 
that the main external output of each hinTS scheme, its **verification key**, is exactly the 
metadata bound to the corresponding address book in the chain of trust.
3. Finally, we summarize what information a block stream consumer needs to keep as context 
to efficiently verify block proofs.

**Important:** This specification is for developers working on the core protocol, block nodes,
and mirror nodes. We confine ourselves to just what is needed to correctly produce and consume 
the TSS protocol outputs in the block stream, taking as given a cryptography library that 
provides the API of the `HintsLibrary` and `HistoryLibrary` interfaces in the reference 
implementation in [4]. 

Readers interested in thoroughly understanding the reference implementation should refer to 
its [design documentation](https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hedera-node/docs/exact-weight-tss.md). 
Readers interested in the deeper details of the cryptography should consult [1].

### Schnorr proof keys and the address book chain of trust

Users of a Hiero network must have prior reasons beyond cryptographic proof for trusting a 
large majority of the _originators_ of the network. This is obvious since the originators will, 
by definition, hold the entire stake weight; and even the gold standard of aBFT security is 
mathematically limited to a corruption threshold of strictly less than a third of the weight.

But users should never have to extend their trust beyond this original grant and the limits 
of aBFT fault tolerance. Every future change to the membership of the network must come with 
cryptographic proof that at least one third of the weight (and hence at least one honest node) 
voted for that membership change.

We propose a recursive proof mechanism that uses a zero-knowledge succinct non-interactive
argument of knowledge (zk-SNARK) based on honest nodes contributing signatures to address book
changes using Schnorr keys they gossip the public parts of to the network.
```
message HistoryProofKeyPublicationTransactionBody {
  /**
   * The proof key the submitting node intends to use when
   * contributing signatures for use in proving history
   * belongs to the chain of trust for the ledger id.
   */
  bytes proof_key = 1;
} 
```

The structure of this zk-SNARK depends on representing the membership of the network in a 
TSS address book composed of `(nodeId, proofKey, weight)` triples; where the `proofKey`s 
are the Schnorr keys gossiped as above; and the `nodeId` and `weight` fields are identical to 
those in a current or candidate consensus roster. 

It follows that every proof construction derives from a **source roster** (and address book); 
and aims to prove a trustworthy transition to a **target roster** (and address book). The first 
time that TSS is enabled on a Hiero network is a special case in which the same roster serves as 
both source _and_ target; the TSS address book for this special roster is called the **genesis 
address book**. From that point forward, the **ledger id** is the concatenation of the genesis 
address book hash and the zk-SNARK verification key.
```
ledgerId = <genesisAddressBookHash>||<zkSnarkVerificationKey>
```

The honest nodes in the network prove this ledger id---and every subsequent address book 
change---by first using a deterministic policy to determine the hash of the target address 
book, then gossiping their Schnorr signatures on the hash of that address book. The honest 
nodes then use another deterministic policy to take a selection of the valid signatures as 
inputs to the zk-SNARK; compute the proof; and then gossip their vote for that proof as the 
evidence the roster transition is trustworthy. 

The reference implementation keeps the state of the two latest chain-of-trust proofs in 
singleton states. Their State API keys are,
- `HistoryService.ACTIVE_PROOF_CONSTRUCTION` 
- `HistoryService.NEXT_PROOF_CONSTRUCTION` 

And their `StateIdentifier` ordinals are [`44` and `45`](https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hapi/hedera-protobuf-java-api/src/main/proto/block/stream/output/state_changes.proto#L430), 
respectively. These singletons have the following type,
```
message HistoryProofConstruction {
  /**
   * The construction id.
   */
  uint64 construction_id = 1;
  /**
   * The hash of the roster whose weights are used to determine when
   * certain thresholds are during construction.
   */
  bytes source_roster_hash = 2;
  /**
   * If set, the proof that the address book of the source roster belongs
   * to the the ledger id's chain of trust; if not set, the source roster's
   * address book must *be* the ledger id.
   */
  HistoryProof source_proof = 3;
  /**
   * The hash of the roster whose weights are used to assess progress
   * toward obtaining proof keys for parties that hold at least a
   * strong minority of the stake in that roster.
   */
  bytes target_roster_hash = 4;

  oneof proof_state { 
    ...
    /**
     * When this construction is complete, the recursive proof that
     * the target roster's address book and associated metadata belong
     * to the ledger id's chain of trust.
     */
    HistoryProof target_proof = 7;
    ...
  }
}
```

Where a `HistoryProof` is formed by three messages,
```
message History {
  /**
   * The address book hash of the new history.
   */
  bytes address_book_hash = 1;
  /**
   * The metadata associated to the address book.
   */
  bytes metadata = 2;
}

message HistoryProof {
  /**
   * The hash of the source address book.
   */
  bytes source_address_book_hash = 1;
  /**
   * The proof keys for the target address book, needed to keep
   * constructing proofs after adopting the target address book's
   * roster at a handoff.
   */
  repeated ProofKey target_proof_keys = 2;
  /**
   * The target history of the proof.
   */
  History target_history = 3;
  /**
   * The proof of chain of trust from the ledger id.
   */
  bytes proof = 4;
}

message ProofKey {
  /**
   * The node id.
   */
  uint64 node_id = 1;
  /**
   * The key.
   */
  bytes key = 2;
}
```

Block node and mirror node developers will be mostly interested in just the
`HistoryProofConstruction#source_proof` and `HistoryProofConstruction#target_proof` 
fields of these singletons. The `target_proof` is set only when the honest nodes 
reach consensus on the zk-SNARK for a particular construction. The message in the 
`target_proof` field contains the zk-SNARK itself in its `HistoryProof#proof` field; 
and just as importantly, contains in its `HistoryProof#target_history` field the 
address book metadata that was bound as part of the zk-SNARK, in the 
`History#metadata` field. 

This metadata is the bridge between the address book chain of trust and the hinTS 
signing scheme actually used to create TSS signatures, as we see next.

### hinTS BLS keys and TSS signatures

When confronted with a new candidate address book (or the genesis address book),
the honest nodes must work together to construct the hinTS scheme for that address
book. The first step is once again to gossip the public parts of the BLS keys they
have generated for their individual use.
```
message HintsKeyPublicationTransactionBody {
  ...
  /**
   * The party's hinTS key.
   */
  bytes hints_key = 3;
}
```


## Backwards Compatibility
Because we propose to enable hinTS TSS in tandem with the block stream detailed in
[HIP-1056](https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1056), this
change will be one just more part of a sharp and permanent discontinuity in the Hiero 
protocol. (It is conceivable that Hedera will ultimately publish TSS block proofs for 
all historical mainnet blocks; but that is not in the scope of this HIP.)

## Security Implications
The attack surface for forging hinTS signatures is essentially the same as already
exists with the V6 record stream today. If an attacker can steal the private keys of
nodes that hold at least 1/3 of the stake weight, they can forge network signatures
on arbitrary blocks (whether that means listing RSA signatures or aggregating BLS
signatures). Node operators must therefore remain vigilant and follow best practices
to ensure the physical and cyber security of their machines.

## How to Teach This
For a HIP that adds new functionality or changes interface behaviors, it is
helpful to include a section on how to teach users, new and experienced, how to
apply the HIP to their work.

## Reference Implementation
Please refer to the `HintsService` and `HistoryService` in the Hiero consensus node
[repository](https://github.com/hiero-ledger/hiero-consensus-node) for the reference 
implementation.

## Rejected Ideas
Before adopting hinTS, there was lengthy consideration of an inexact-weight threshold 
scheme that would approximate each node's stake weight by granting it a number of BLS 
key pairs called **shares**. Nodes with more stake would get more shares, and nodes 
with less stake would get fewer shares. Although this approach offered at least equal 
or better space and time efficiency than hinTS, the complexity and compromises inherent
with inexact weights made hinTS the better choice for Hiero networks.

## Open Issues
No known issues are currently under discussion.

## References

1. Garg, S., Jain, A., Mukherjee, P., Sinha, R., Wang, M., & Zhang, Y. (2023). *hinTS: Threshold Signatures with Silent
Setup*. Cryptology ePrint Archive, Paper 2023/567. Retrieved from [https://eprint.iacr.org/2023/567](https://eprint.iacr.org/2023/567)
2. [HIP-415: Introduction of Blocks](https://hips.hedera.com/hip/hip-415) 
3. [HIP-1056: Block Streams](https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1056)
4. [Hiero consensus node](https://github.com/hiero-ledger/hiero-consensus-node) 
5. [Reference implementation design doc](https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hedera-node/docs/exact-weight-tss.md)
6. [zk-SNARK construction ordinals](https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hapi/hedera-protobuf-java-api/src/main/proto/block/stream/output/state_changes.proto#L430)

## Copyright/license
This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
