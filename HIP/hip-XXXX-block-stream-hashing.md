---
hip: XXXX
title: Block and State Merkle Tree Hashing Scheme
author: Nana Essilfie-Conduah <@Nana-EC>, Jasper Potts <@jasperpotts>
working-group: >-
  Nana Essilfie-Conduah <@Nana-EC>, Jasper Potts <@jasperpotts>,
  Joseph Sinclair <@jsync-swirlds>, Leemon Baird <@lbaird>,
  Richard Bair <@rbair23>
requested-by: Hiero Block Builders and Validators, External Verifiers
type: Standards Track
category: Core
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
last-call-date-time: 2026-04-01T07:00:00Z
created: 2026-02-27
updated: 2026-02-27
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/YYYY
requires: 1056
---

## Abstract

This HIP specifies the complete hashing scheme and Merkle tree structures used by the Hiero network
to compute verifiable, tamper-evident digests of all data in both the block stream and the
consensus node state. Building on the block stream format introduced in
[HIP-1056](https://hips.hedera.com/hip/hip-1056), this specification defines the node prefixing
convention that provides domain separation between leaf and internal nodes, the three distinct
Merkle tree types used for different parts of the block, the fixed 16-leaf block root structure
with its eight defined sub-trees and eight reserved expansion slots, the streaming incremental
Merkle tree algorithm designed for efficient hash computation as block items are produced, and the
complete set of protobuf messages for the block footer, block proof variants, and filtered or
redacted item representations. Together, these primitives allow any party to verify the integrity
of any individual item in any block or in state, and to generate concise Merkle proofs for both
recent and historical blocks.

## Motivation

[HIP-1056](https://hips.hedera.com/hip/hip-1056) established the block stream format and defined
the concept of a block root hash over which consensus nodes produce a threshold signature.
HIP-1056 describes the *what*: which items belong in a block and what the root hash represents.
This HIP describes the *how*: the precise algorithm and data structures used to compute that root
hash, and the rules governing every node in the tree from which it is derived.

Without a fully specified hashing scheme, independent implementations — consensus nodes, block
nodes, mirror nodes, and external verifiers — cannot agree on a canonical digest for any given
block or state snapshot. This specification defines all hash inputs, prefixes, tree shapes, and
algorithms completely, so that any compliant implementation produces byte-for-byte identical
digests from the same data. That agreement is the prerequisite for threshold signatures to be
meaningful.

## Rationale

### SHA-384 as the Hash Function

SHA-384 (a truncation of SHA-512) is used throughout this scheme. It provides a 384-bit (48-byte)
digest, which is larger than the 256-bit output of SHA-256 or Keccak-256 used by EVM chains.
This larger output eliminates the classes of collision attacks that have theoretical relevance
against 256-bit hashes in second-preimage contexts. SHA-384 is standardized (FIPS 180-4), widely
hardware-accelerated, and offers a comfortable security margin well above the 128-bit post-quantum
security level that 256-bit hashes approach asymptotically.

### Domain Separation via Node-Type Prefixes

A naive binary Merkle tree where `internal_hash = H(left || right)` and
`leaf_hash = H(leaf_data)` is vulnerable to a second-preimage attack: an adversary can craft a
pair of adjacent leaves whose concatenation, when hashed directly, equals the hash of an internal
node — meaning the same tree root can be "proved" from two different leaf sets. The fix is to
make the hash domain of leaves and internal nodes disjoint by prefixing the input to the hash
function with a byte that identifies the node type:

- `0x00` — leaf node
- `0x01` — internal node with a single (left) child
- `0x02` — internal node with two children

Because these prefix bytes are different, no hash produced for a leaf can equal a hash produced
for an internal node for any input, regardless of the leaf content or internal node child hashes.
This is the minimal, maximally efficient form of domain separation for a binary tree. For a
thorough discussion of why this is necessary see
[the length-extension attack on Wikipedia](https://en.wikipedia.org/wiki/Length_extension_attack)
and [the Merkle tree second-preimage attack](https://www.rareskills.io/post/merkle-tree-second-preimage-attack).

### Streaming Merkle Tree for Block Item Sub-trees

Block items (transactions, execution outputs, state changes, trace data, consensus headers) are
produced sequentially during block execution. A standard Merkle tree construction requires all
leaves to be available before hashing can begin, which is incompatible with streaming. The
streaming algorithm described in this HIP, designed by Leemon Baird, maintains a compact list of
O(log N) intermediate hashes and immediately folds each new leaf into the partially-built tree.
The root hash can be queried at any point during streaming without disturbing the intermediate
state, and only a final O(log N) folding pass is required after the last leaf is added.

## Terminology

**SHA-384**: The Secure Hash Algorithm with a 384-bit digest length, as defined in FIPS 180-4.
Used as the sole hash function throughout this scheme.

**Leaf node**: A Merkle tree node that carries data and has no children.

**Internal node**: A Merkle tree node that has one or two children and carries no data of its own.

**Domain separation**: The use of distinct prefixes on hash inputs to ensure that hashes computed
for different node types occupy disjoint regions of the hash output space, preventing
cross-type collisions.

**Block root hash**: The single 48-byte SHA-384 digest that summarizes the entire content of a
block, including all transactions, outputs, state changes, and the previous block root hash.

**Sub-tree**: A self-contained Merkle tree whose root appears as one of the 16 fixed leaves of
the block root tree.

**`MerkleLeaf`**: A conceptual protobuf wrapper that unifies all leaf types — block items and
state items — into a single message type for hashing purposes. The actual wrapper is *not*
materialized in the block stream for performance reasons (see Specification).

**Block footer**: A special block item, always the last item before the block proofs, that carries
the three pre-computed hashes that cannot be produced by streaming block items alone.

**Block proof**: One or more items appended after the block footer that provide a cryptographic
attestation over the block root hash.

**Filtered item**: A placeholder that replaces a block item removed from a partial (filtered) block
stream, carrying the item's hash so that the block's Merkle tree can still be computed and verified.

**Redacted item**: Similar to a filtered item but permissible on tier-1 block nodes; also carries
the hash of the original `SignedTransaction` (without its `BlockItem` wrapper) to allow event
reconstruction.

**Streaming binary Merkle tree**: An incremental algorithm that builds a Merkle tree root hash
one leaf at a time while maintaining only O(log N) bytes of intermediate state.

**Complete balanced binary Merkle tree**: A tree in which all levels are full except the lowest,
and all leaves on the lowest level are positioned as far left as possible. Used for the state tree.

**Fixed size Merkle tree**: A tree with a predetermined number of leaves and fixed sub-tree
positions. Used for the block root.

## User Stories

### Consensus Node Implementor

1. **As a consensus node implementor**, I need a precise specification of the hashing scheme so
   that independent implementations of the consensus node produce byte-for-byte identical block
   root hashes, enabling threshold signatures to aggregate correctly.
2. **As a consensus node implementor**, I want a streaming algorithm for computing sub-tree hashes
   so that hashing can proceed concurrently with transaction execution without buffering all block
   items in memory.

### Block Node Operator

3. **As a block node operator**, I need to verify the block root hash of every block I receive
   against the threshold signature it carries, so that I can reject tampered or corrupted blocks
   before storing or forwarding them.

### Security Auditor

4. **As a security auditor**, I want explicit documentation of the domain separation scheme
   and the attacks it mitigates, so that I can verify correctness without reconstructing the
   reasoning from first principles.

## Specification

### Hash Function

All hash computations throughout this scheme SHALL use SHA-384, producing a 48-byte digest.

The notation `hash(x)` means: compute the SHA-384 hash of the byte sequence `x`.
The notation `||` means: concatenate the byte sequences on each side.

### Tree Node Design

The Merkle tree is composed of exactly two kinds of nodes:

**Internal nodes** carry no data and have either one or two children. They MUST NOT appear as
leaves. Their hashes are computed as follows:

- Internal node with one child:
  `hash = hash(0x01 || hash(firstChild))`
- Internal node with two children:
  `hash = hash(0x02 || hash(firstChild) || hash(secondChild))`

The distinction between one-child and two-child internal nodes is necessary to support trees whose
leaf count is not a power of two. In such trees the right-most branch on each level may be
incomplete. A missing right child is represented by promoting the left subtree upward — not by
creating a placeholder empty leaf — and the one-child prefix `0x01` marks these nodes so they
cannot be confused with two-child nodes.

**Leaf nodes** carry data and have no children. Their hashes are computed as:

`hash = hash(0x00 || MerkleLeaf_bytes)`

Where `MerkleLeaf_bytes` is the protobuf serialization of the `MerkleLeaf` message wrapping the
leaf content (see below).

**Empty tree**: A tree with no leaves at all is represented as a single empty leaf with no data.
Its hash is `hash(0x00)`.

**Single-leaf tree**: A tree with exactly one leaf has no internal nodes. Its hash is the hash of
that leaf: `hash(0x00 || MerkleLeaf_bytes)`.

#### Domain Separation Summary

| Node type | Prefix | Formula |
|---|---|---|
| Empty leaf | `0x00` | `hash(0x00)` |
| Data leaf | `0x00` | `hash(0x00 \|\| leaf_bytes)` |
| Internal, 1 child | `0x01` | `hash(0x01 \|\| child_hash)` |
| Internal, 2 children | `0x02` | `hash(0x02 \|\| left_hash \|\| right_hash)` |

These four domains are disjoint: no hash computed with one prefix can equal a hash computed with a
different prefix for any input.

### The `MerkleLeaf` Wrapper

All leaf content — whether from the block stream or from state — is logically treated as a
`MerkleLeaf` for hashing purposes. This creates a uniform leaf type across the entire tree.

```protobuf
/**
 * A unified wrapper for all Merkle tree leaf content.
 *
 * This message provides a consistent leaf type for hashing purposes
 * across both block stream and state data.
 *
 * NOTE: This wrapper is NOT materialized in the block stream or in
 * persistent state. It is constructed in memory only during hash
 * computation to avoid the storage and parsing overhead of embedding
 * it in every block item.
 */
message MerkleLeaf {
    oneof content {
        /**
         * The consensus timestamp of the block.<br/>
         * This is the left child of the block root, above the
         * 16-leaf fixed sub-tree.
         */
        Timestamp block_consensus_timestamp = 1;

        /**
         * A single item from the block stream.
         */
        BlockItem block_item = 2;

        /**
         * A single key-value pair from consensus node state.
         */
        StateItem state_item = 3;
    }
}

/**
 * A single key-value pair from the consensus node state Merkle tree.
 * Renamed from VirtualLeaf in the previous implementation.
 */
message StateItem {
    /**
     * The key identifying this state entry.<br/>
     * Field number 2 is used intentionally to preserve compatibility
     * with the existing VirtualMerkle implementation.
     */
    StateKey stateKey = 2;

    /**
     * The value stored at this state key.
     */
    StateValue stateValue = 3;
}

/**
 * The key for a state Merkle tree entry.
 * Renamed from VirtualMapKey in the previous implementation.
 */
message StateKey {
    oneof key {
        AccountID account_id = 1;
        // Additional key types follow the same pattern.
        // All network entity types that are stored in state
        // SHALL have a corresponding key variant here.
    }
}

/**
 * The value stored at a state Merkle tree key.
 * Renamed from VirtualMapValue in the previous implementation.
 */
message StateValue {
    oneof value {
        Account account = 1;
        // Additional value types follow the same pattern.
        // All network entity types that are stored in state
        // SHALL have a corresponding value variant here.
    }
}
```

> **Implementation note**: The `MerkleLeaf` wrapper SHALL NOT be serialized into the block stream
> or into persistent state storage. Adding it there would increase the block stream size by several
> bytes per item — significant across billions of transactions — and would require additional
> parsing during hash verification. Instead, implementations SHALL construct the `MerkleLeaf`
> message in memory solely when computing hashes, serialize it to bytes, and then immediately
> discard the serialized bytes after hashing.

### Three Merkle Tree Types

Three distinct tree construction algorithms are used, each suited to a different part of the
block structure.

---

#### 1. Fixed Size Merkle Tree (Block Root)

Used for: the top level of every block.

This is a tree with exactly **16 leaves**, permanently fixed in shape. Its leaf positions are
assigned once and SHALL NOT change. The fixed shape enables state proofs to encode paths that
remain valid across all past and future blocks.

Empty leaves — those reserved for future use — SHALL be hashed as `MerkleLeaf` messages with no
`content` field set. The protobuf serialization of such a message is an empty byte array `[]`,
so the hash of an empty leaf is `hash(0x00)`.

---

#### 2. Complete Balanced Binary Merkle Tree (State)

Used for: the consensus node state.

This is a [complete balanced binary tree](https://en.wikipedia.org/wiki/Binary_tree#Types_of_binary_trees)
in which all levels are full except the lowest, and all leaves on the lowest level are positioned
as far left as possible. All data in state is stored as key-value pairs as leaves of this single
tree. This tree is not a search tree — lookup is handled by separate index structures. It is a
pure Merkle tree for integrity verification.

The root hash of the state tree at the beginning of each block is published in the block footer
as `start_of_block_state_root_hash`, making state provable from the block root.

---

#### 3. Streaming Binary Merkle Tree (Block Item Sub-trees)

Used for: all six active block item sub-trees (Consensus Headers, Input Items, Output Items,
State Changes, Trace Data, and All Block Hashes).

This algorithm enables the root hash of a Merkle tree to be computed incrementally as leaves
become available, one at a time, without ever storing the entire tree in memory. Only O(log N)
intermediate hashes need to be maintained between additions. The root hash can be queried at any
point, including mid-stream, without interrupting the computation.

##### Algorithm (Pseudocode)

```
elements = ordered sequence of serialized leaf byte arrays
hashList  = new empty list

for each element e in elements (index i starting at 0):
    leafHash = hash(0x00 || e)        // hash the leaf
    hashList.append(leafHash)
    n = i
    while (n is odd):                 // fold complete pairs upward
        right = hashList.removeLast()
        left  = hashList.removeLast()
        hashList.append(hash(0x02 || left || right))
        n = n >> 1

// After all elements have been processed, fold remaining open branches:
merkleRoot = hashList.last()
for j from (hashList.size() - 2) down to 0:
    merkleRoot = hash(0x02 || hashList[j] || merkleRoot)

return merkleRoot
```

The inner `while` loop immediately folds any newly completed pair of siblings into a parent
internal node. Because of the binary structure, this loop executes at most O(log i) times per
leaf. The final folding pass over the remaining `hashList` entries closes all open left-hand
branches, always using the two-child internal node formula `0x02 || left || right`.

##### Step-by-Step Example: 5 Leaves

Notation: `Lx = hash(0x00 || leaf_x_bytes)`, `h(X,Y) = hash(0x02 || X || Y)`

| Step | Action | Working list (`hashList`) |
|---|---|---|
| Add leaf 0 | i=0 (even), no fold | `[ L0 ]` |
| Add leaf 1 | i=1 (odd), fold L0+L1 → NodeA=h(L0,L1) | `[ NodeA ]` |
| Add leaf 2 | i=2 (even), no fold | `[ NodeA, L2 ]` |
| Add leaf 3 | i=3 (odd), fold L2+L3 → NodeB=h(L2,L3); then i>>1=1 (odd), fold NodeA+NodeB → NodeC=h(NodeA,NodeB) | `[ NodeC ]` |
| Add leaf 4 | i=4 (even), no fold | `[ NodeC, L4 ]` |
| Final fold | merkleRoot = h(NodeC, L4) | `[ ]` |

**Final root**: `h( h( h(L0,L1), h(L2,L3) ), L4 )`

![Streaming Merkle Tree Growth](../assets/hip-YYYY/Merkle%20proof%20sketches%20-%20Page%203.png)

##### Reference Implementation (Java)

```java
/**
 * Computes a Merkle tree root hash incrementally as leaves are added.
 *
 * <p>Uses SHA-384 as the hash algorithm and the node-type prefix scheme
 * (0x00 for leaves, 0x02 for internal nodes) defined in this HIP.
 *
 * <p>This class is not thread-safe; it is intended for single-threaded use.
 */
public class StreamingHasher {

    /** Prefix byte prepended to leaf data before hashing. */
    private static final byte[] LEAF_PREFIX = { 0x00 };

    /** Prefix byte prepended to internal node inputs before hashing. */
    private static final byte[] INTERNAL_NODE_PREFIX = { 0x02 };

    private final MessageDigest digest;
    private final LinkedList<byte[]> hashList = new LinkedList<>();
    private long leafCount = 0;

    public StreamingHasher() {
        try {
            digest = MessageDigest.getInstance("SHA-384");
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Constructs a StreamingHasher from a previously saved intermediate state,
     * allowing hashing to be resumed after a restart or checkpoint.
     *
     * @param intermediateHashingState the saved list of intermediate hashes
     */
    public StreamingHasher(List<byte[]> intermediateHashingState) {
        this();
        this.hashList.addAll(intermediateHashingState);
    }

    /**
     * Adds one leaf to the tree and immediately folds any newly completed pairs.
     *
     * @param data the serialized bytes of the leaf (before leaf prefix is applied)
     */
    public void addLeaf(byte[] data) {
        final long i = leafCount;
        hashList.add(hashLeaf(data));
        for (long n = i; (n & 1L) == 1L; n >>= 1) {
            final byte[] right = hashList.removeLast();
            final byte[] left  = hashList.removeLast();
            hashList.add(hashInternalNode(left, right));
        }
        leafCount++;
    }

    /**
     * Computes and returns the Merkle root hash from the current state.
     *
     * <p>This method does not modify internal state; additional leaves may be
     * added after calling this method.
     *
     * @return the 48-byte SHA-384 Merkle root hash
     */
    public byte[] computeRootHash() {
        byte[] root = hashList.getLast();
        for (int i = hashList.size() - 2; i >= 0; i--) {
            root = hashInternalNode(hashList.get(i), root);
        }
        return root;
    }

    /**
     * Returns the current intermediate hashing state for checkpointing.
     *
     * @return an unmodifiable view of the intermediate hash list
     */
    public List<byte[]> intermediateHashingState() {
        return Collections.unmodifiableList(hashList);
    }

    /** @return the total number of leaves added so far */
    public long leafCount() { return leafCount; }

    private byte[] hashLeaf(byte[] leafData) {
        digest.update(LEAF_PREFIX);
        return digest.digest(leafData);
    }

    private byte[] hashInternalNode(byte[] left, byte[] right) {
        digest.update(INTERNAL_NODE_PREFIX);
        digest.update(left);
        return digest.digest(right);
    }
}
```

### Null and Empty Leaf Handling

The streaming binary Merkle tree and the complete balanced binary state tree SHALL NOT contain
null or empty leaves. When a tree's leaf count is not a power of two, one-child internal nodes
(prefix `0x01`) are used at appropriate levels to propagate a single subtree upward rather than
padding the tree with empty leaves.

The *only* context in which empty leaves appear is the fixed 16-leaf block root tree. Leaves
reserved for future use in that tree SHALL be hashed as `hash(0x00)` (the hash of the empty
`MerkleLeaf` serialization).

### Block Root Structure

The block root tree has two direct children of the root node:

1. **Left child — Consensus Timestamp**: A leaf whose value is the block's consensus timestamp,
   expressed as the `block_consensus_timestamp` variant of `MerkleLeaf`. A block's consensus
   timestamp is defined as the consensus timestamp of the first transaction in the first round of
   that block.
2. **Right child — Fixed 16-leaf sub-tree**: The root of a fixed-size Merkle tree with exactly
   16 leaves at fixed positions.

This structure is depicted below:

![Simplified Block Root](../assets/hip-YYYY/Hashing%20-%20Simplified%20Block%20Root.png)

The full structure with all 16 leaf positions assigned:

![Full Block Root Tree](../assets/hip-YYYY/Hashing%20-%20Block%20Root%20(3).png)

#### Why the Timestamp Is a Sibling of the Fixed Sub-tree

Every state proof must certify both the leaf value *and* the time at which it was valid. Placing
the timestamp as the sibling of the entire fixed sub-tree means the proof path always passes
through the timestamp node. Because path traversal never adds a hash for a node at which both
children are on the proof path, this design makes the timestamp effectively free in every proof.

#### Fixed Leaf Positions

The 16 leaves of the fixed sub-tree are assigned in order, left to right, and SHALL NOT be
reassigned:

| Position | Sub-tree | Hash Input |
|:---:|---|---|
| 1 | **Previous Block Root Hash** | 48-byte SHA-384 digest. Sourced from `BlockFooter.previous_block_root_hash`. See [HIP-1056](https://hips.hedera.com/hip/hip-1056). |
| 2 | **All Block Hashes Tree Root** | 48-byte SHA-384 digest. Root of a streaming binary Merkle tree of all prior block root hashes (blocks 0 through N-1). Sourced from `BlockFooter.root_hash_of_all_block_hashes_tree`. |
| 3 | **State Root Hash** | 48-byte SHA-384 digest. Root of the complete balanced binary state Merkle tree at the *start* of this block. Sourced from `BlockFooter.start_of_block_state_root_hash`. |
| 4 | **Consensus Headers** | Root of a streaming binary Merkle tree over `BlockItem`s of type `EventHeader` or `RoundHeader`. |
| 5 | **Input Items** | Root of a streaming binary Merkle tree over `BlockItem`s carrying `SignedTransaction` bytes (raw bytes, consensus order). |
| 6 | **Output Items** | Root of a streaming binary Merkle tree over `BlockItem`s of type `BlockHeader`, `RecordFileItem`, `TransactionResult`, or `TransactionOutput`. |
| 7 | **State Changes** | Root of a streaming binary Merkle tree over `BlockItem`s of type `StateChanges`. |
| 8 | **Trace Data** | Root of a streaming binary Merkle tree over `BlockItem`s of type `TraceData`. |
| 9–16 | **Reserved** | Empty leaves (`hash(0x00)`), reserved for future expansion. |

> **Immutability requirement**: The positions, meanings, and hash computation rules for leaves 1
> through 8 SHALL NOT change in any future version of this specification. State proof verifiers
> depend on knowing the exact path to each sub-tree without additional protocol negotiation.

![Block Root Tree Edge Cases](../assets/hip-YYYY/Hashing%20-%20Block%20Root%20Tree%20(7).png)

### Block Footer

The three hashes at leaf positions 1, 2, and 3 of the fixed sub-tree are derived from data that
is not part of any streamed block item sub-tree. They are instead published in a `BlockFooter`
item, which is always the last block item before the `BlockProof` items.

The `BlockFooter` itself is NOT included in any streaming Merkle sub-tree hash. Its three fields
are the direct inputs to leaf positions 1, 2, and 3 of the fixed sub-tree.

> **Rationale for using a footer instead of a header**: Computing the state root hash and the
> previous block root hash requires waiting for prior computation to complete. If these values were
> included in the `BlockHeader` at the start of the block, the consensus node would have to pause
> block item streaming until those hashes were ready. By placing them in the footer, the consensus
> node has up to approximately one full block of additional time to compute them, enabling
> concurrent pipelining of hash computation and block streaming.

```protobuf
/**
 * Pre-computed hashes required to complete the block root Merkle tree.
 *
 * The three fields of this message correspond to leaf positions 1, 2, and 3
 * of the fixed 16-leaf sub-tree of the block root.<br/>
 * This item SHALL be the last BlockItem in a block, immediately before
 * any BlockProof items.<br/>
 * This item SHALL NOT be included in any streaming block item sub-tree hash.
 */
message BlockFooter {

    /**
     * The root hash of the immediately preceding block.<br/>
     * This is leaf position 1 of the fixed block root sub-tree.<br/>
     * This field is REQUIRED and SHALL be 48 bytes (SHA-384 output).
     */
    bytes previous_block_root_hash = 1;

    /**
     * The root hash of the streaming Merkle tree of all prior block root
     * hashes, from block zero through block N-1.<br/>
     * This is leaf position 2 of the fixed block root sub-tree.<br/>
     * This field is REQUIRED and SHALL be 48 bytes (SHA-384 output).
     */
    bytes root_hash_of_all_block_hashes_tree = 2;

    /**
     * The root hash of the consensus node state Merkle tree at the
     * beginning of this block, before any transactions were applied.<br/>
     * This is leaf position 3 of the fixed block root sub-tree.<br/>
     * This field is REQUIRED and SHALL be 48 bytes (SHA-384 output).
     */
    bytes start_of_block_state_root_hash = 3;
}
```

### Block Proof

After the `BlockFooter`, a block contains one or more `BlockProof` items. Having more than one
proof allows future cryptographic schemes (e.g., post-quantum signatures, TSS) to be added to
historical blocks as a simple file append, without invalidating the original proof.

> **Block node streaming note**: Because a block may have multiple proofs appended over time, block
> nodes receiving a stream SHOULD treat the end of a block as signalled by the start of the next
> block's header or an explicit end-of-stream indicator in the streaming protocol, not by the
> presence of a single `BlockProof` item.

```protobuf
/**
 * A cryptographic attestation over the root hash of a block.
 *
 * One or more BlockProof items SHALL appear at the end of every block,
 * after the BlockFooter.<br/>
 * Additional BlockProof items MAY be appended to historical blocks via
 * a file append operation without altering any other block content.
 */
message BlockProof {
    oneof proof {
        /**
         * A proof based on a TSS threshold signature directly over the
         * block root hash.
         */
        TssSignedBlockProof signed_block_proof = 1;

        /**
         * A proof based on the block's root hash being included as a leaf
         * in a subsequent block's Merkle tree, and a state proof extracted
         * from that later block's signature.
         */
        StateProof block_state_proof = 2;

        /**
         * A proof for blocks that wrap a historic record file, using the
         * original RSA signatures produced by consensus nodes at the time
         * the record file was created.
         */
        SignedRecordFileProof signed_record_file_proof = 3;
    }
}
```

#### TSS Signed Block Proof

The primary proof type for new blocks. The block root hash is signed by a threshold of consensus
node stake weight using the TSS-BLS signature scheme.

```protobuf
/**
 * A TSS threshold signature over the block root hash.
 */
message TssSignedBlockProof {

    /**
     * The aggregated TSS-BLS threshold signature over the block root hash.<br/>
     * To verify: compute the block root hash independently, then verify
     * this signature against the network's TSS public key.<br/>
     * This field is REQUIRED.
     */
    bytes block_signature = 4;
}
```

#### State Proof Block Proof

A block whose root hash appears in a later block's all-blocks Merkle tree (leaf position 2) can be
proved via a state proof extracted from that later block's signature. This allows a block that
lacked sufficient direct signatures at the time of production to be proved retroactively once a
later block is signed, and enables post-quantum re-proofing of any historical block.

#### Signed Record File Proof

For blocks that encapsulate historical record files produced before the block stream cutover, the
original RSA signatures from consensus nodes are preserved.

```protobuf
/**
 * Proof for a block wrapping a historic record file.
 *
 * To verify this proof:
 * 1. Obtain the address book valid at the time of the record file
 *    (from the genesis address book and all prior address book updates).
 * 2. Extract RSA public keys from that address book.
 * 3. Verify the signatures in record_file_signatures against the
 *    SHA-384 hash of the record file content.
 * 4. Confirm that at least 1/3 of the network's nodes signed the file.
 */
message SignedRecordFileProof {

    /**
     * RSA signatures from consensus nodes over the SHA-384 hash of the
     * record file content.<br/>
     * At least 1/3 of the network node count MUST be represented to
     * consider this proof valid.<br/>
     * This field is REQUIRED.
     */
    repeated RecordFileSignature record_file_signatures = 1;

    /**
     * The version of the record stream hashing algorithm used to produce
     * the hash over which signatures were collected.<br/>
     * This field is REQUIRED.
     */
    uint32 version = 2;
}

/**
 * A single node's RSA signature over the SHA-384 hash of a record file.
 */
message RecordFileSignature {

    /**
     * The RSA signature bytes.<br/>
     * This is an RSA signature over the SHA-384 hash of the record file.<br/>
     * This field is REQUIRED.
     */
    bytes signature_bytes = 1;

    /**
     * The identifier of the consensus node that produced this signature.<br/>
     * This field is REQUIRED.
     */
    int32 node_id = 2;
}
```

### Filtered and Redacted Items

A full, unfiltered block stream contains every block item. Downstream consumers (e.g., block nodes
serving specialised clients) may provide filtered streams from which certain item types are
removed. To allow verification of the block Merkle tree even from a filtered stream, removed items
are replaced with placeholder messages.

#### `FilteredSingleItem`

Replaces a single block item removed from the stream.

```protobuf
/**
 * An enumeration of the block item sub-trees in the fixed block root.
 *
 * This enum is used by FilteredSingleItem and FilteredMerkleSubTree to
 * identify which streaming sub-tree a filtered or redacted item belongs to,
 * so that its hash can be inserted at the correct position in that sub-tree.
 */
enum SubMerkleTree {
    /** Default value. SHALL NOT be used in any item. */
    ITEM_TYPE_UNSPECIFIED = 0;

    /** Consensus header sub-tree (leaf position 4). */
    CONSENSUS_HEADER = 1;

    /** Input items sub-tree (leaf position 5). */
    INPUT_ITEM = 2;

    /** Output items sub-tree (leaf position 6). */
    OUTPUT_ITEM = 3;

    /** State change items sub-tree (leaf position 7). */
    STATE_CHANGE_ITEM = 4;

    /** Trace data items sub-tree (leaf position 8). */
    TRACE_ITEM = 5;

    /** Reserved for future sub-trees corresponding to leaf positions 9–16. */
    FUTURE_1 = 6;
    FUTURE_2 = 7;
    FUTURE_3 = 8;
    FUTURE_4 = 9;
    FUTURE_5 = 10;
    FUTURE_6 = 11;
    FUTURE_7 = 12;
    FUTURE_8 = 13;
}

/**
 * Verification data for a single block item removed from a filtered stream.
 *
 * This message type SHALL NOT appear in a full (unfiltered) block stream.<br/>
 * This message SHALL replace any single item removed from a filtered stream,
 * preserving the item's hash so that the block Merkle tree can still be
 * computed and verified.<br/>
 * Presence of this item SHALL NOT prevent block verification, but MAY prevent
 * reconstruction of consensus events.
 */
message FilteredSingleItem {

    /**
     * The SHA-384 hash of the filtered item, computed as if the item were
     * still present (i.e., hash(0x00 || MerkleLeaf_bytes)).<br/>
     * This field is REQUIRED.
     */
    bytes item_hash = 1;

    /**
     * The streaming sub-tree to which this filtered item belongs.<br/>
     * The item hash SHALL be inserted into this sub-tree at the position
     * the original item would have occupied.<br/>
     * This field is REQUIRED.
     */
    SubMerkleTree tree = 2;
}
```

#### `FilteredMerkleSubTree`

Replaces an entire streaming sub-tree or a contiguous set of leaves within a sub-tree, when all
filtered leaves descend from a common internal ancestor node. This enables more efficient
representation of large-scale filtering (e.g., removing all trace items from a block).

```protobuf
/**
 * Verification data for a complete sub-tree removed from a filtered stream.
 *
 * This message replaces all items belonging to one or more contiguous subtrees
 * that have been filtered, providing only the root hash of the filtered
 * sub-tree.<br/>
 * A block node SHOULD compute the full Merkle tree before filtering in order
 * to produce this message correctly.
 */
message FilteredMerkleSubTree {

    /**
     * The root hash of the filtered sub-tree.<br/>
     * This SHALL equal the root hash that would have been computed had
     * all filtered items been present.<br/>
     * This field is REQUIRED and SHALL be 48 bytes (SHA-384 output).
     */
    bytes subtree_root_hash = 1;

    /**
     * The streaming sub-tree whose root hash is provided here.<br/>
     * This field is REQUIRED.
     */
    SubMerkleTree tree = 2;

    /**
     * The number of leaf items represented by this filtered sub-tree.<br/>
     * This field is REQUIRED and SHALL be greater than zero.
     */
    uint32 filtered_leaf_count = 3;
}
```

> **Tier-1 block node restriction**: Blocks containing `FilteredSingleItem` or
> `FilteredMerkleSubTree` entries SHALL NOT be stored as part of the permanent block chain history
> on tier-1 block nodes. Filtering removes information necessary for consensus event reconstruction.
> Filtered blocks are suitable only for downstream specialised consumers.

#### `RedactedItem`

A `RedactedItem` differs from a filtered item in one important way: it retains the SHA-384 hash
of the original `SignedTransaction` (without its `BlockItem` wrapper), which is necessary for
consensus event reconstruction. Blocks containing `RedactedItem` entries MAY be stored on tier-1
block nodes.

```protobuf
/**
 * Verification data for a single block item redacted from the stream.
 *
 * Unlike FilteredSingleItem, a RedactedItem retains the hash of the original
 * SignedTransaction (without BlockItem wrapper) to allow event reconstruction.
 * Blocks containing RedactedItem entries MAY be stored on tier-1 block nodes.
 */
message RedactedItem {

    /**
     * The SHA-384 hash of the redacted item as it would appear as a Merkle
     * leaf in its sub-tree (i.e., hash(0x00 || MerkleLeaf_bytes)).<br/>
     * This field is REQUIRED.
     */
    bytes item_hash = 1;

    /**
     * The SHA-384 hash of the original SignedTransaction, computed directly
     * from the SignedTransaction bytes without the BlockItem wrapper.<br/>
     * This field SHALL be set for event transactions and SHALL NOT be set for
     * synthetic transactions that are not part of any event.<br/>
     * This field is OPTIONAL.
     */
    bytes signed_transaction_hash = 2;

    /**
     * The streaming sub-tree to which this redacted item belongs.<br/>
     * This field is REQUIRED.
     */
    SubMerkleTree tree = 3;
}
```

## Backwards Compatibility

This HIP specifies the hashing scheme for the block stream format introduced by HIP-1056; it does
not alter how historical record files were hashed or signed — those retain their original
RSA-signed SHA-384 digests and are wrapped as block stream blocks with a `SignedRecordFileProof`.
The fixed leaf positions in the block root tree (positions 1 through 8) SHALL NOT change in any
future version of this protocol, ensuring state proofs produced after the block stream cutover
remain verifiable indefinitely.

## Security Implications

### Domain Separation Prevents Second-Preimage Attacks

Without domain separation, a Merkle tree where `H(internal) = hash(left || right)` and
`H(leaf) = hash(data)` is vulnerable: an adversary who observes an internal node hash can
construct a "leaf" whose content is `left || right`, producing the same hash. This allows
a fraudulent Merkle path to be presented in place of a legitimate one. The three-prefix
scheme (`0x00`, `0x01`, `0x02`) ensures that no input to `hash()` for a leaf node can equal
any input to `hash()` for an internal node, closing this attack completely.

### SHA-384 vs. 256-Bit Hash Schemes

SHA-384 provides a 192-bit security level against preimage attacks and approximately 192-bit
collision resistance. EVM chains use 256-bit hashes (Keccak-256), which provide only ~128-bit
security under second-preimage attack scenarios. The 384-bit output provides a comfortable margin
above the 128-bit threshold commonly considered the post-quantum security floor. Second-preimage
attacks on SHA-384 are not computationally feasible with any known or projected hardware.

### Fixed Block Root Provides Tamper-Evident History

The inclusion of the previous block root hash (leaf position 1) and the all-blocks Merkle tree
(leaf position 2) in every block ensures that any alteration of a historical block changes the
root hash of every subsequent block. An adversary cannot silently modify a historical block
without breaking the chain of hash dependencies, which would be immediately detected when
compared against the signed root hash of the latest block.

### Filtered Block Restrictions Protect Event Integrity

Tier-1 block nodes are prohibited from storing filtered blocks. This ensures that the authoritative
block history from which event reconstruction and consensus verification are performed is always
the full, unfiltered stream. Filtered streams are explicitly flagged as incomplete and unsuitable
for archival purposes.

## How to Teach This

### For Consensus Node and Block Node Implementors

The hashing scheme has two building blocks. The first is the prefix rule: every SHA-384 hash
input is prefixed with `0x00` (leaf), `0x01` (single-child internal), or `0x02` (two-child
internal). The second is the streaming algorithm for block item sub-trees. The Java reference
implementation of `StreamingHasher` in this HIP is a complete, runnable implementation of the
streaming algorithm and is the recommended starting point for any implementation.

### For Mirror Node Operators

Mirror nodes that compute state root hashes SHOULD implement the complete balanced binary Merkle
tree algorithm for their state snapshot and compare the result against the `start_of_block_state_root_hash`
published in the block footer of each block. A mismatch indicates a divergence in indexed state
and should trigger an alert.

### For State Proof Consumers

A state proof encodes a path from a leaf to the block root. Given this HIP, the path can be
decoded as follows: the first branch from the root always separates the consensus timestamp (left)
from the fixed 16-leaf sub-tree (right). From the fixed sub-tree root, the path descends to
the appropriate leaf position (1–8), and then continues down into the appropriate streaming
sub-tree. Leaf positions are permanently fixed and never require version negotiation.

### For Documentation

Update the following to reference this HIP:
- Block stream verifier and proof generation documentation
- State proof consumer guides
- Block node implementation guides
- Any reference to `VirtualMapKey`, `VirtualMapValue`, or `VirtualLeaf` (now renamed `StateKey`,
  `StateValue`, and `StateItem` respectively)

## Reference Implementation

The reference implementation must be complete before this HIP is given the status of "Final."
The implementation will span the following repositories:

- **`hiero-consensus-node`**: Implement `StreamingHasher`, the complete balanced binary state tree
  hasher, and the fixed block root tree assembly logic. Populate `BlockFooter` with the three
  pre-computed hashes. Produce `BlockProof` items of type `TssSignedBlockProof`.
- **`hiero-protobufs`**: Add or update protobuf definitions for `MerkleLeaf`, `StateItem`,
  `StateKey`, `StateValue`, `BlockFooter`, `BlockProof`, `TssSignedBlockProof`,
  `SignedRecordFileProof`, `RecordFileSignature`, `FilteredSingleItem`, `FilteredMerkleSubTree`,
  `RedactedItem`, and `SubMerkleTree`.
- **`hiero-block-node`**: Implement block root hash verification using the scheme defined here.
  Implement filtered stream production using `FilteredSingleItem` and `FilteredMerkleSubTree`.

The final implementation MUST include test cases verifying:
- SHA-384 hash correctness for leaves, one-child internal nodes, and two-child internal nodes.
- Streaming Merkle tree root hash against the 5-leaf worked example in this HIP.
- Block root hash assembly from a known set of sub-tree roots and footer hashes.
- State root hash computation from a known state snapshot.
- `FilteredSingleItem` and `FilteredMerkleSubTree` round-trip: filtered hash equals the hash
  of the original full sub-tree.

## Rejected Ideas

### Using Keccak-256 (EVM-Compatible Hash Function)

Using Keccak-256 would improve interoperability with EVM tooling. It was rejected because
Keccak-256 produces a 256-bit output, giving a lower security margin than the 384-bit output of
SHA-384 in second-preimage attack scenarios. Hiero has consistently used SHA-384 throughout its
history, and changing the hash function now would invalidate existing tools, documentation, and
institutional knowledge. EVM tooling that interacts with Hiero does so through the JSON-RPC relay,
which handles the translation; it does not need to compute Hiero Merkle proofs natively.

### Using a Single Prefix Byte for All Nodes

A scheme with only two prefix values — `0x00` for leaves and `0x01` for all internal nodes —
was considered. It was rejected because it does not cleanly distinguish between one-child and
two-child internal nodes, which are both needed to handle non-power-of-two leaf counts without
padding. Using separate prefixes `0x01` and `0x02` for the two internal node types maintains
the same domain-separation properties while also encoding structural information directly in
the hash input, reducing ambiguity.

### Padding Trees to Powers of Two with Empty Leaves

Rather than using one-child internal nodes, trees could always be padded to the next power of
two with empty leaves. This was rejected because it inflates the tree depth and proof size for
large trees, and introduces the complexity of defining and consistently handling a canonical
"empty leaf" sentinel value in every tree type. The one-child internal node approach requires
no padding and produces shorter proofs for unbalanced trees.

### Including `MerkleLeaf` in the Block Stream

The `MerkleLeaf` wrapper was considered as a serialized wrapper around every block item in the
stream, making the leaf structure explicit and self-describing. This was rejected because it
adds several bytes per block item. At the transaction volumes Hiero targets (thousands of
transactions per second), this overhead is significant in aggregate and would increase block
stream storage and bandwidth costs. The wrapper is instead applied only in memory during hash
computation.

### Placing the Consensus Timestamp as One of the 16 Fixed Leaves

The consensus timestamp could have been placed at leaf position 1 within the 16-leaf fixed
sub-tree, with the block root having only one child (the fixed sub-tree). This was rejected
because it would add one hash to every state proof (the proof would need to traverse through
the timestamp leaf's sibling subtree), increasing proof size for every proof ever produced.
Making the timestamp a direct sibling of the fixed sub-tree eliminates this overhead entirely.

## Open Issues

1. **TSS public key distribution for proof verification**: Verifying a `TssSignedBlockProof`
   requires the current TSS public key of the network. The mechanism for distributing and
   rotating this key is outside the scope of this HIP and will be addressed in the TSS HIP.

2. **State proof schema**: The `StateProof` message referenced in the `BlockProof` oneof is not
   fully defined in this HIP. Its full schema is defined in a companion state proofs HIP.

3. **Streaming protocol end-of-block signal**: The streaming block node protocol requires a
   mechanism to signal the end of a block independently of the presence of a `BlockProof` item,
   since additional proofs may be appended to existing blocks. The exact protocol mechanism
   (e.g., an `EndBlock` message type) is left to the block node protocol HIP.

4. **StateKey and StateValue completeness**: The `StateKey` and `StateValue` protobuf messages
   shown in this HIP include only the `AccountID`/`Account` variant as an example. The full
   enumeration of all network entity types that appear in state will be defined in the state
   schema HIP.

## References

- [HIP-1056: Block Streams](https://hips.hedera.com/hip/hip-1056) — the parent HIP establishing
  the block stream format and the concept of the block Merkle tree.
- [FIPS 180-4: Secure Hash Standard](https://csrc.nist.gov/publications/detail/fips/180/4/final) — the SHA-384 specification.
- [RFC 2119: Key Words for Use in RFCs](https://www.rfc-editor.org/rfc/rfc2119) — definition of
  SHALL, MUST, SHOULD, MAY.
- [Length-Extension Attack (Wikipedia)](https://en.wikipedia.org/wiki/Length_extension_attack)
- [Merkle Tree Second-Preimage Attack (RareSkills)](https://www.rareskills.io/post/merkle-tree-second-preimage-attack)
- [Complete Binary Tree (Wikipedia)](https://en.wikipedia.org/wiki/Binary_tree#Types_of_binary_trees)
- Internal design document: *Block & State Merkle Tree Design v69* (Leemon Baird, Jasper Potts)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
