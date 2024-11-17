---
hip: <HIP number (assigned by the HIP editor), usually the PR number>
title: Block Node
author: Nana Essilfie-Conduah <@Nana-EC>, Jasper Potts <@jasperpotts>, Richard Bair <@rbair>,
Joseph Sinclair<@jsync-swirlds>
working-group: Richard Bair <@rbair>, Anurag Saksena, Mark Blackman <mark@swirldslabs.com>,
Matt Peterson <@mattp-swirldslabs>, Alfredo Gutierrez <@AlfredoG87>, Georgi Lazarov <@georgi-l95>,
Nick Poorman <@nickpoorman>
requested-by: Hedera Consensus Node Operators, Cosmic Wire, Limechain
type: Standards Track
category: Service, Mirror, Block Node
needs-council-approval: Yes
status: Draft
created: 2024-05-15
discussions-to: https://github.com/hashgraph/hedera-improvement-proposal/discussions/1055
updated: 2024-11-17
requires: 1056
---

## Abstract

This HIP introduces and proposes the adoption of a new node type that is designed to parse the block stream, store
latest state and serve up additional network APIs such as state proofs and block retrieval that support decentralized
querying and verification of state. 

A block node will primarily sit in between a consensus node and a mirror node to serve as a decentralized source of
verifiable network state and transaction information. As an emergent feature a block node will introduce a new node
economy through independent community  operations. Anyone will be able to independently run a block node or block
stream parsing product that provides value added services to users e.g. aggregated data insights, data availability.

Block Nodes will have a rich API, allowing consumers to receive a subset of the stream, or the full stream. Block Nodes
can innovate on payment -- they can be commercial and have connectivity rules / rate limits / SLAs for customers. 
They can require payment for serving blocks, or they can serve blocks for free.

## Motivation

In the current network architecture the consensus node outputs data representing snippets of consensus and transaction
inputs and outputs. The majority of this information sits in publicly available but costly cloud buckets from which the
community can download information and parse it - the mirror node and other indexers have utilized this flow since 2019
to support DApps.

Some notable challenges of the existing architecture include

- Users must query the consensus node for latest state information
- Consensus nodes must rely on other consensus nodes to be taught latest hashgraph information in order to catch up
- Consensus nodes don’t offer proof of state APIs
- Community members are unable to easily run independent nodes with complete state and transaction information that
support the verification of the consensus outputs

## Rationale

The rationale fleshes out the specification by describing why particular design decisions were made. It should describe
alternate designs that were considered and related work, e.g. how the feature is supported in other languages.

The rationale should provide evidence of consensus within the community and discuss important objections or concerns
raised during the discussion.

## User stories

Personas

- Council consensus node operators
- Independent community node operators
- Mirror Node operators
- Block Node operators
- Custom dApps focused on high TPS  flows
- Custom dApps focused on low trust  flows
    - Low Trust, here, implies the dApp does not trust the block data without independently verifying authenticity and
    integrity.

User Stories

1. As a block node operator I want to collect all the information in form of block streams, produced by consensus
nodes.
2. As a block node operator I want to verify network signatures on a block proof and assert block integrity.
3. As a block node operator I want to persist and maintain a complete and correct copy of the latest state.
4. As a block operator I want to offer a streaming API that provides access to real time unverified block stream
details.
5. As a block operator I want to offer a streaming API that provides access to real time verified block stream
details.
6. As a block operator I want to offer state APIs that provide access to historical state details.
7. As a block operator I want to offer state APIs that provide access to latest state details.
8. As a block node operator I want to answer all queries available from the consensus node.
9. As a block node operator I want to answer additional queries not available from the consensus node.
10. As a block node operator I want to “catch up” with the latest block(s) from a consensus node if my node falls
behind the latest block.
11. As a block node operator I want to “catch up” with the latest blocks from other block nodes if my node falls too
far behind the latest block.
12. As a block node operator I want to receive the unfiltered and unverified block stream from one or more block nodes,
from one or more  consensus nodes, or from both.
13. As a mirror node operator I want to receive the unfiltered and unverified block stream from a block node with the
minimum possible latency.
14. As a custom dApp I want to receive an unfiltered and unverified block stream from a block node with the minimum
possible latency.
15. As a custom dApp I want to receive the block stream starting at any historical block and continue forward from that
point indefinitely.
16. As a custom dApp I want an API to request a snapshot of the state, as of an arbitrary historical block, from a block
node.
17. As a custom dApp I want an API to request a state proof for any item in state, as of an arbitrary historical block,
from a block node.
18. As a custom dApp I want an API to request a state proof for any item in state, as of the most recent block, from a
block node.
19. As a consensus node operator I want to publish a block stream to one or more block nodes so that I am not required
to maintain historical state snapshots.
20. As a consensus node operator I want to redirect queries to a block node so that I can reduce unnecessary load on my
consensus node.
21. As a consensus node operator I want to retrieve a very recent state snapshot from a block node if I “fall behind”
and must “reconnect” with the network.
22. As a consensus node operator I want to have an “address book” of block nodes where I can send my block stream
and/or request a state snapshot or recent blocks.
23. As a consensus node operator I want a configurable trust score for block nodes listed in my “address book” so I can
determine, in software, the best choice(s) of block node(s) to use.
  
## Specification

### Block Stream Schema

The Block node will support the streaming and parsing of Block Stream messages in protocol buffer format, as specified
in the [hedera-protobuf repository](https://github.com/hashgraph/hedera-protobufs/tree/main/block/stream).

<aside>
🚨 **Open Task:** Explain how to handle 

- protobuf version upgrades
- pause in stream due to CN upgrades
- pauses in stream due to no Block Proof

</aside>

### Services
To achieve the above the block node will offer multiple modular services which can be enabled by node operators.

#### Block Node Service
The block node service will provide ancillary services to inform users of node readiness and configuration

```protobuf
/**
 * Remote procedure calls (RPCs) for the Block Node Ancillary services.
 */
service BlockNodeService {
    /**
     * Read the status of this block node server.
     */
    rpc serverStatus(ServerStatusRequest) returns (ServerStatusResponse);
}
```

#### Block Stream Service

One of the primary goals of the Block Node will be to expose a public streaming endpoint of block information obtained
from Consensus Node outputs.

There will be 2 types of stream services offered

- Unverified block stream for low latency
- Verified block stream for high confidence

Depending on a user of tools needs they can optimize for requesting Block Items as fast as possible for their own
optional verification or rely on confirmed blocks as confirmed by a Block Node following the Block Proof algorithm.

Both streams may also offer filtering capabilities based on user requests and Block Node functionality support.

Initially filtering will be at the Block Item level (e.g. a Mirror Node may want only Transaction input and outputs)
but in the future block nodes could stream blockItems out based on the matching of state or transaction matches.

```protobuf
/**
 * Remote procedure calls (RPCs) for the Block Node Stream services.
 */
service BlockStreamService {
    /**
     * Publish a stream of blocks.
     */
    rpc publishBlockStream (stream PublishStreamRequest) returns (stream PublishStreamResponse);

    /**
     * Subscribe to a stream of blocks.
     */
    rpc subscribeBlockStream(SubscribeStreamRequest) returns (stream SubscribeStreamResponse);
}
```

#### Block Service

As the block stream is ongoing and items are sent out in real time, it is valuable to be able to request an historical
block in its entirety.

```protobuf
/**
 * Remote procedure calls (RPCs) for the Block Node Block services.
 */
service BlockAccessService {
    /**
     * Read a single block from the block node.
     */
    rpc singleBlock(SingleBlockRequest) returns (SingleBlockResponse);
}
```

#### State Service

Live state, snapshot, changes and single entity state

```protobuf
/**
 * Remote procedure calls (RPCs) for the Block Node State snapshot
 * and query services.
 */
service StateService {
    /**
     * Read a state snapshot from the block node.
     */
    rpc stateSnapshot(StateSnapshotRequest) returns (StateSnapshotResponse);
}
```

#### Reconnect Service
Support CN connecting to BN to be taught about latest stake instead of another CN

<aside>
🚨 **Open Task:** Expand

</aside>

#### Proof Service
<aside>
🚨 **Open Task:** Flesh out

</aside>

### Discovery
<aside>
🚨 **Open Task:** Explain how block nodes are discovered

- by a client so they can query data
- by a CN so they can push data e.g. by address book

</aside>

### Upgradeability


### Monetization

Block nodes will perform significant work by consuming the sblock stream, verifying it, storing it and providing
multiple API services to further users. To block node operators it is thus important to offer capabilities to cover
the cost of work and encourage a vibrant economy.

To achieve this the Block Node will adopt a charge card compareable model with crypto transfers of hbar required prior to the
consumption of APIs. The block node will initially manage an hbar ledger on node to track the remaining hbar balance
that an account ID holds with the block node.

To achieve this it is required that a block node have it's own account Id that users can transfer hbar to.

API costs will vary based on API but will include flat fees per request and variable fees based on size of data and
complexity.

Notably, monetization should be confirueable and allows for free or reduce cost pathwyas. For example a council node
operator would likely run its block node and not expect calls from it to be charged.

<aside>
🚨 **Open Task:** Add a diagram to illustrate

Potentially a sequence diagram to highlight the onboarding flow to access APIs

</aside>

## Backwards Compatibility

Block Nodes propose to completely replace the existing cloud storage buckets and replace the record file format with
the block stream format.
All consumers of record stream data from the existing cloud storage buckets will need to change the mechanism of
access, change the mechanism of payment, and adjust any processing logic to process block stream data.

With consideration for Hedera transaction protobuf type formats - the block node will support the new Block Stream
format, which incorporates the existing transactional API formats by reference.

## Security Implications

The Block Node does not sign or co-sign any transactions to the network. It is **not** a custodian. 

The Block Node must have an account on the network to ensure identification to consensus nodes that may stream block
items to it, and to receive payment for services. Multiple accounts may be used to separate authentication and
monetization.

A Block Node will send acknowledgement of blocks to the stream publisher (Consensus Node or other Block Node), in
applicable configurations, to inform the stream publisher of the receipt and verification of blocks.

A Block Node may receive a block stream from a Consensus Node directly, or from another Block Node. The Block Stream is
completely verifiable and carries a verifiable cryptographic proof in each block, so the source of the stream only
affects the total latency observed, and the fees paid.

## How to Teach This

To effectively educate and inform users about block node operation, comprehensive technical documentation, blogs, and
webinars will be essential. Technical documentation will provide detailed and in-depth explanations of operation modes,
usage, and best practices, ensuring that developers and mirror node operators can fully understand and transition to
block stream consmption from a block node as well as block node hosting.

Blogs will offer more accessible and engaging content, highlighting use cases, real-world applications, and the benefits
of a block node, catering to a broader audience of Hedera stakeholders. Webinars will serve as interactive platforms
for live demonstrations, Q&A sessions, and expert insights, enabling participants to gain a deeper understanding through
direct engagement with subject matter experts.

## Reference Implementation


## Rejected Ideas

### BN to CN staking as a requirement for a CN before streaming to a BN.
It was suggested that to help incentivize long term block nodes that a BN would stake some minimum amount of HBAR to a
CN. In which upon reward of the full staking period a BN would recuperate staking rewards but also additional reward
for offering DA

### BN to CN staking as a mechanism to ensure long term DA
It was suggested that to help incentivize long term block nodes that staked and consumed a stream for at least the
staking period would receive an additional reward for offering DA

### App to BN allowances to pay for API usage
It was suggested that one mechanism of paying in advance would be for a client such as a BN or MN or app to first offer
a BN an allowance of some amount of HBAR. The BN would then periodically debit from the allowance to pay itself after
responding to a clients calls. The issue was there was a fear that the client to rescind the allowance after time and a
BN would be 1 or 2 blocks in time off of the accurate allowances which could result in services offered for free if the
client was being malicious

### BlockItem Service
Returning a single request BlockItem seemed to not be a valuable service out of the gate. 
Especially without the ability to cleanly identify an item it doesn’t seem worthwhile for a BN to return a BlockItem vs
a Block.

### Gossiping Block Node
<aside>
🚨 **Open Task:** Summarize initial claims and inital reasons to not support
</aside>

## Open Issues

1. Q: “As a block node operator I should be able to attach custom plugins to the block node, which can utilize its
functionality.” was previously listed as a user story. Is this an intent to be highlighted?
    1. [Ans]
2. Q: Do we want to highlight anonymous node runners?
3. Q: Does the block node require or rely on a transmission of full state from a CN? If so what’s the contract between
nodes here? Previously the CN output state every 15 mins

## References

A collections of URLs used as references through the HIP.

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
