---
hip: 20
title: Standardized URI scheme to reference Hedera data
author: Khoa Luong <khoa.luong@luthersystems.com>, Sam Wood <sam.wood@luthersystems.com>, Stephanie Yi <stephanie.yi@luthersystems.com>, Declan Fox <declan.fox@luthersystems.com>
type: Standards Track
category: Service
needs-council-approval: Yes
status: Replaced
superseded-by: 30
created: 2021-06-29
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/110
---

## Abstract
This HIP defines a way for Hedera to host data in a centralized location and accessible
with a standardized URI.

## Motivation

Non-fungible tokens often have metadata associated with them and this HIP provides a way to
access them with a standardized URI, hosted by Hedera.
Third-party applications would then be able to use this standardized URI to integrate with and
display a token's metadata and image (for example: DECENT Wallet [0]).
Non-Hedera NFT's could also utilize this feature to host their metadata, like ERC-721.

## Rationale

The format of the URI includes the prefix "hcs" to represent that it is hosted on Hedera, and
then the network that the token was deployed on (mainnet/testnet), followed by the topic ID.
Currently, Hedera's ID convention can be confusing because a topic ID on one network can be a
wallet ID in another network, so by using this prefix, we can start standardizing the format of the
IDs. For example, using HCS to distinguish data hosted on Hedera consensus service, HFS prefix for
Hedera file service, as well as including the associated network (testnet, previewnet).

One use case for the topic ID to be part of the URI is: the metadata of an NFT can be submitted to
this topic as a message and then retrieved by accessing this standardized URI. This gives us an
easy way to send the token's metadata to Hedera without the need for a new API. The token's metadata
URI would then be stored on the memo field of the token when it is deployed.

## Specification

Different Hedera services have different prefixes, for example, HFS for Hedera file service and
HCS for Hedera consensus service.
The URI is in the following format: hcs-<network>://<topic-id> for testnet and previewnet
and hcs://<topic-id> for mainnet.
For example: hcs-testnet://0.0.01234. This URI then serve the metadata in the format of the
"Token Metadata JSON Schema", from HIP-10 [1].
For Hedera file service, the format is: hfs://<file_id> and hfs-{<network>}://<file_id>

## Backwards Compatibility

This feature is optional for deployed Hedera tokens so there won't be any backward compatibility
concerns.

## Security Implications

No known security concerns.

## How to Teach This

## Reference Implementation

## Rejected Ideas

## Open Issues

## References

[0] https://dcentwallet.com/features/erc721-wallet
[1] https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-10.md

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
