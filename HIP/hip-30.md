---
hip: 30
title: CAIP Identifiers for the Hedera Network
author: Danno Ferrin <danno.ferrin@hedera.com>
type: Standards Track
category: Application
needs-council-approval: No
status: Active
last-call-date-time: 2021-11-23T07:00:00Z
created: 2021-10-11
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/169
updated: 2021-11-30
---

## Abstract

Describes the Chain Agnostic Improvement Proposal (CAIP) identifiers for
blockchain identification, account identification, and asset identification.

## Motivation

CAIP is a set of specifications describing how software applications can
interact with multiple other chains in an agnostic manner. Examples are hardware
wallets, native web3 applications, and web browser based applications. Providing
a standardized set of CAIP identifiers will allow such applications to support
Hedera.

This specification will exist in both the HIP repository as a single HIP and in
the CAIP repository as multiple CAIPs.

## Rationale

There are two key places multiple variations of the identifier could be made.
The first is the style of the blockchain identifier. Because Hedera is intended
to only serve a small set of purpose built networks the style that Steller
adopted in
[CAIP-28](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-28.md)
seemed more appropriate.

For separators of the shard, realm and identifiers replacing the dotted notation
with the dashed notation was deemed more readable than the alternatives.

## Specification

### Blockchain Identifier

The `hedera` namespace will be used for CAIP blockchain identifiers. There will
be 4 distinct references: `mainnet`, `testnet`, `previewnet`, and `devnet`.
There are no other supported references in this namespace at this time.

`hedera:mainnet` and `hedera:testnet` are the two persistent networks. `mainnet`
holds the production tokens and `testnet` operates as a testing sandbox with
state that is rarely if ever reset.

`hedera:previewnet` refers to the transient shared testnet that is erased once a
week.

`hedera:devnet` refers to any non-shared developer local network.

### Account Identifier

The account address is the standard account identifier format. Each of realm,
shard, and account ID separated with a dash (`.`). The format of the realm,
shard, and account ID are unsigned integer in decimal representation.

An optional checksum may be added after the account identifier delimited by a
dash ('-'). It consists of up to 5 lowercase letters. The optional checksum may
or may not be valid. Intermediaries may or may not validate the checksum, only
Hedera Systems are guaranteed to reject an invalid checksum.

Examples:

```
# Treasury account
hedera:mainnet:0.0.2

# Funding account
hedera:mainnet:0.0.98

# Address Book Account
hedera:mainnet:0.0.55

# Account '9.8.765432'
hedera:mainnet:9.8.765432

# Mainnet account with checksum
hedera:mainnet:0.0.123-vfmkw
```

### Asset Identifier

There are two types of native assets defined for the `hedera` namespace, `token`
and `nft`. Both are provided by the Hedera Token Service. Because Hedera also
supports EVM execution in some of its services the ethereum token
types `erc20` ([CAIP-21](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-21.md)
and `erc721` ([CAIP-22](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-21.md))
are also possible in the `hedera` namespace, although their use is expected to
be less than the use of the Hedera Token Service.

#### `token`

The asset reference of the token type is each of realm, shard, and token ID of
the token separated with a dash (`.`). The format of the realm, shard, and token
ID are unsigned integer in decimal representation.

An optional checksum may be added after the token identifier delimited by a
dash ('-'). It consists of up to 5 lowercase letters. The optional checksum may
or may not be valid. Intermediaries may or may not validate the checksum, only
Hedera Systems are guaranteed to reject an invalid checksum.

Examples:

```
# Fictitious token in realm 0, shard 0, and token ID 720
hedera:mainnet/token:0.0.720

# Fictitious token in realm 0, shard 0, and token ID 123, with checksum
hedera:mainnet/token:0.0.123-vfmkw
```

#### `nft`

The asset reference of the non-fungible token type is each of realm, shard, and
token ID of the token separated with a dash (`.`). The format of the realm,
shard, and token ID are unsigned integer in decimal representation.

An optional checksum may be added after the token identifier delimited by a
dash ('-'). It consists of up to 5 lowercase letters. The optional checksum may
or may not be valid. Intermediaries may or may not validate the checksum, only
Hedera Systems are guaranteed to reject an invalid checksum.

The Token ID is the serial number. The format of the serial number is an
unsigned integer in decimal representation.

Examples:

```
# Fictitious token in realm 0, shard 0, token ID 721 serial number 3
hedera:mainnet/nft:0.0.721/3

# Fictitious token in realm 0, shard 0, token ID 123, with checksum
# serial number 3
hedera:mainnet/nft:0.0.123-vfmkw/3
```

### `file`

A topic is used by the Hedera File Service. While not an ownable asset
applications will want to identify it in a chain agnostic manner.

The asset reference of the file type is each of realm, shard, and topic ID of
the file separated with a dash (`.`). The format of the realm, shard, and file
ID are unsigned integer in decimal representation.

An optional checksum may be added after the file identifier delimited by a
dash ('-'). It consists of up to 5 lowercase letters. The optional checksum may
or may not be valid. Intermediaries may or may not validate the checksum, only
Hedera Systems are guaranteed to reject an invalid checksum.

```
# Fictitious topic in realm 0, shard 0, token ID 723
hedera:mainnet/file:0.0.723

# Fictitious topic in realm 0, shard 0, token ID 123, with checksum
hedera:mainnet/file:0.0.123-vfmkw
```

### `topic`

A topic is used by the Hedera Consensus Service to relay consensus messages.
While not an ownable asset applications will want to identify it in a chain
agnostic manner.

This asset only refers to the topic as a whole and does not refer to specific
messages in the topic.

The asset reference of the topic type is each of realm, shard, and topic ID of
the topic separated with a dash (`.`). The format of the realm, shard, and topic
ID are unsigned integer in decimal representation.

An optional checksum may be added after the topic identifier delimited by a
dash ('-'). It consists of up to 5 lowercase letters. The optional checksum may
or may not be valid. Intermediaries may or may not validate the checksum, only
Hedera Systems are guaranteed to reject an invalid checksum.

```
# Fictitious topic in realm 0, shard 0, token ID 722
hedera:mainnet/topic:0.0.722

# Fictitious topic in realm 0, shard 0, token ID 123, with checksum
hedera:mainnet/topic:0.0.123-vfmkw
```

## Backwards Compatibility

The dotted rendition of the Hedera accounts will remain as the canonical
representation within Hedera. CAIP identifiers are only to be used when required
by interoperability.

## Reference Implementation

The various SDKs may provide convenience methods to translate between Hedera
notations and CAIP notations.

## Rejected Ideas

### Using the ethereum blockchain namespace

One possibility for blockchain identifier is to use the `eip155` namespace and
have the networks be represented as `eip155:295`, `eip155:296`, `eip:297`
and `eip:298` for Mainnet, Testnet, Previewnet, and devnet. The EIP155 number
would be derived by the EVM `CHAINID` operation.

Using this identifier, however, would misrepresent the level of compatibility
between Hedera and Ethereum chains. While Hedera does provide an EVM execution
environment that is where the compatibility ends. First, Hedera uses the Edwards
25519 curve, and does not use the chain identifier as part of the signature (
which is the expressed purpose of EIP-155). Neither does it expose Ethereum
standard JSON-RPC apis at this time.

### Using letters instead of dashes in account identifier

As currently specified
[CAIP-10](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-10.md)
prohibits dashes in account identifiers. The option of using letters to separate
decimals did not read as well (`hedera:mainnet:r0s0a720`
/ `hedera:mainnet:0-0-720`). Updating the CAIP to support dashes was viewed as a
more user-friendly option

### Using dashes in identifiers instead of dots

Instead of only using dashes to replace dots in identifiers we will instead join
in the requests to expand account identifiers to include more punctuation as an
option.

## Open Issues

None at this time

## References

* Chain Agnostic Improvement Proposals - https://github.com/ChainAgnostic/CAIPs
* CAIP-2: Blockchain ID Specification
    - https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
* CAIP-10: Account ID Specification
    - https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-10.md
* CAIP-19: Asset Type and Asset ID
  Specification https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-19.md

## Copyright/license

This document is licensed under the Apache License, Version 2.0 --
see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
