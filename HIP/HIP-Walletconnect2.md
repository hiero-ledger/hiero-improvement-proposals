---
hip: TBD
title: Improvements to the Wallet Connect implementation for dApps on Hedera
author: Greg Scullard
working-group: TBD
type: Standards Track
category: Application
needs-council-approval: No
status: draft
last-call-date-time: 
created: 2025-04-17
discussions-to: 
updated: 
requires: [820](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-820.md)
replaces: [820](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-820.md)
---

## Abstract

This HIP proposes changes to the specification introduced in [HIP-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md) for wallets and dApps on the Hedera platform to connect using the [**Wallet Connect 2.0**](https://docs.walletconnect.com/) protocol.

It introduces improved methods to facilitate native Hedera network operations such that the SDK's capabilities for handling nodes that are temporarily unavailable are used to their full extent.

## Motivation

Wallet connect enables dApps to work with a number of different wallets without implementing specific integration to each wallet they wish to support.

The first implementation however sometimes enforced that a dApp submits a `TransactionBody` and not a full SDK `Transaction`, resulting in unnecessary failures to submit transactions to the network and degrading user experience.

## Rationale

Hedera doesn't operate a mem pool, instead, applications are able to submit their transactions to a node of their choice. If the selected node is temporarily unavailable, the application will have to select a different node and prompt the user to approve the same transaction again.

The SDKs implement strategies that enable the user to approve a transaction once, however behind the scenes, the SDK will prepare a number of transactions (say 10 for example) targeted at different nodes, a single user signature operation essentially signs several (10 for example) transactions. The SDK will attempt to submit the first transaction to the node identified in the Transaction's `TransactionBody`, if unsuccessful, it will automatically attempt another node with the next Transaction it prepared.

Indeed an SDK `Transaction` is a complex object which contains an array of `TransactionBody`, a `TransactionBody` includes a `node_account_id` which is the `AccountId` of the node the transaction is meant to be sent to.

A small portion of transaction fees are paid to the node handling receiving and checking the transaction prior to submitting to consensus, it is necessary to ensure that the signature for the transaction includes the `node_account_id` in order to approve this payment.

Sending a transaction which `TransactionBody` specifies `node_account_id` 0.0.3 to node 0.0.4 will result in an `INVALID_NODE_ACCOUNT_ID` failure given node 0.0.4 will not be paid for handling this transaction. 

This HIP aims to correct the first implementation to more faithfully adhere to the SDK's network handling capabilities.

Note that if an application wishes to enforce a specific `node_account_id` is used, it is free to do so by overriding the SDK's default behaviour, however, if the selected node is temporarily unavailable, the application user will have to approve another transaction to another node, or wait until the node is available again.

## User stories

- As a dApp developer, I wish to create a native Hedera transaction that a remote user can sign and submit to the network on my behalf; returning the receipt (or error) when that action is completed.  I do not need to know the brand of wallet submitting my transaction, only that it follows the known protocol I understand.
- As a dApp developer, I wish to have a remote user sign a transaction and return it so that I can submit the transaction to the network myself on the key-owner’s behalf.  I do not need to know the brand of wallet signing the transaction I created for them, only that the signer follows the known protocol I understand.
- As a dApp developer, I need the functionality above to facilitate coordination of multiple signatures by separate parties.  I do not need the protocol to orchestrate multiple party signatures, only create and return or pass thru existing signatures when required.
- As a dApp developer, I may not have direct gRPC or Mirror Node access to the Hedera Network.  In this scenario, I need to rely on the controller (wallet) to query the hedera network to retrieve live information such as account balances and other information using the native Hedera API Query Services.
- As a dApp developer, I need to know which hedera nodes the remote client is willing to sign and/or send transactions to *including ip addresses*.  There is no point in creating a transaction delivered to a Hedera node that the remote wallet is unwilling or unable to interact with.
- As a dApp developer, I need to challenge the controller (wallet) for the purposes of authentication for an off-ledger purpose, such as authenticating on a web site.  I need functionality similar to Wallet Connect's [`personal_sign`](https://docs.walletconnect.com/advanced/rpc-reference/ethereum-rpc) method for the Ethereum chain.
- As a key-owner (account/wallet owner) I want to utilize any dApp of my choosing with any wallet or key-signing tool of my choosing to facilitate my desired interaction with the dApp or Hedera Network.
- As a key-owner (account/wallet owner) I want to utilize any dApp of my choosing with any wallet or key-signing tool of my choosing to participate in multi-party, multi-signature transactions when and where required.
- As a wallet or dApp developer, I wish to leverage the Wallet Connect libraries provided by Wallet Connect with the Hedera SDK or tooling of my choosing.  I require that the protocol be SDK and programming language agnostic.
- As a dApp developer, I want to be able to leverage the SDK's capabilities for handling unavailable nodes.
  
## Specification

Portions of a specification required to implement a Wallet Connect 2.0 protocol for the Hedera Network already exist.  The accepted HIP-30, CAIP Identifiers for the Hedera Network, ratifies the format for identifying hedera networks and addresses.  It includes definitions for the Chain Agnostic Standards Alliance profiles 2, 10 and 19 for the Hedera Network, to summarize:

> The `hedera` namespace will be used for CAIP blockchain identifiers. There will be 4 distinct references: `mainnet`, `testnet`, `previewnet`, and `devnet`…. `hedera:devnet` refers to any non-shared developer local network.
> 
> The account address is the standard account identifier format. Each of realm, shard, and account ID separated with a ~~dash~~ [period] (`.`). The format of the realm, shard, and account ID are unsigned integer in decimal representation…

The identifiers described above shall be used during the Wallet Connect 2.0 pairing session negotiation to identify the hedera ledgers and accounts that will participate in transaction signing and submission to the Hedera network.  

What is not included in previous work is the definition of the Wallet Connect custom methods and events that complete the support for the use cases identified above.  The following namespace methods shall be supported:

### hedera_signTransaction

*note: be mindful of backwards compatibility*

When a dApp requires only the signature from the controller (wallet), it can use the `hedera_signTransaction` method.  
This method accepts a base64 encoded protobuf representation of the Hedera API [`TransactionBody`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/transaction_body.proto#L90) message as input, or an array in the form of a [`TransactionList`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/sdk/transaction_list.proto#L17) message.  
The controller decodes and interprets the contents, and if valid and approved, returns:
* an encoded [`SignatureMap`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/basic_types.proto#L780) structure that includes one or more signatures generated by the controller if a single `TransactionBody` was submitted.
* an encoded `node_account_id` indexed map of [`SignatureMap`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/basic_types.proto#L780) structure that includes one or more signatures generated by the controller if a single `TransactionList` was submitted.

* Note: a `SignatureMap` is a list of public keys (or unique prefix) and corresponding signatures, in the event a `TransactionList` is passed, a single `SignatureMap` would not enable the signatures to be allocated to the appropriate `TransactionBody`. 

#### Parameters

`transactionBody` – a base64 encoding of the protobuf encoded Hedera API [`TransactionBody`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/transaction_body.proto#L90) message.  While the controller should decode the contents for security reasons, it should sign the literal bytes provided, not a re-encoding of the [`TransactionBody`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/transaction_body.proto#L90) message.  This is necessary because re-encoding the message could potentially result in slightly different array of bytes.
or
`transactionList` – a base64 encoding of the protobuf of the Hedera SDK [`TransactionList`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/sdk/transaction_list.proto#L17) message.  The contained transactions must include the [bodyBytes](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/transaction_contents.proto#L35C11-L35C11) field representing the transaction, but inclusion of a [sigMap](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/transaction_contents.proto#L40C13-L40C13) is optional.  If included, and if it is pre-populated with signatures, the pre-existing signatures must also be included in the signed transaction sent to the Hedera Node.

`signerAccountId` – an Hedera Account identifier in [HIP-30](https://hips.hedera.com/hip/hip-30) (`<nework>:<shard>.<realm>.<num>-<optional-checksum>`) form.  This value identifies the account (and therefore associated key set) that the dApp is requesting to sign the transaction.  It is permissible to omit this value if necessary for keys not associated with an account (for example, a token supply key).  The controller (wallet) may choose to reject the request based on the identifed account or omission of this property, or provide additional signatures beyond the request if the controller deems it necessary or proper.

#### Returns

`signatureMap` – a base64 encoding of the protobuf encoded Hedera API [`SignatureMap`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/basic_types.proto#L780) message.  The encoded structure must include at least one signature within the property’s [`SignatureMap`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/basic_types.proto#L780) structure.  It is allowed to provide more if the context warrants multiple signatures.
or
an encoded `node_account_id` indexed map of the protobuf encoded Hedera API [`SignatureMap`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/basic_types.proto#L780) message.  The encoded structure must include at least one signature within the property’s [`SignatureMap`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/services/basic_types.proto#L780) structure.  It is allowed to provide more if the context warrants multiple signatures.

### hedera_signAndExecuteTransaction

No changes from [Hip-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md)

### hedera_executeTransaction

No changes from [Hip-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md)

### hedera_signAndExecuteQuery

No changes from [Hip-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md)

### hedera_signMessage

No changes from [Hip-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md)

### hedera_getNodeAddresses

No changes from [Hip-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md)

## Backwards Compatibility

There are changes to the existing protocol for Hedera's implementation of wallet connect. 

Careful consideration should be made for backwards compatibility such that older applications are able to continue to work with the previous implementation.

It is expected that if an application wants to make use of the newer capabilities, a compatible wallet needs to be used.

## Security Implications

Wallet Connect 2.0 has been designed with a strong emphasis on security. 
Its architecture has undergone extensive peer review and has been adopted by numerous blockchain platforms. 
By leveraging this protocol, Hedera can ensure that the foundational communication between wallets and dApps is secure.  
The protocol implements end-to-end encryption between dApps and wallets.  
It employs a QR code-based pairing system ensuring the communication channel is established directly between the user’s wallet and the dApp.  
Controllers (wallets) have full control over actions such as signing and communicating with the Hedera Network.

## How to Teach This

The Wallet Connect documentation is quite comprehensive and can be leveraged to document most of the steps required to implement both dApps and controllers (wallets).  
Additionally, it might be useful to create reference implementations in various programming languages to help bootstrap adoption of this protocol.

## Reference Implementation

No reference implementation presently exists, however there are some non-conforming prototypes presently under development.

## Rejected Ideas

## Open Issues

SDK helpers may be useful to more easily generate and consume the data required in the messages in this specification.

## References

- [HIP-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md)
- [HIP-30](https://hips.hedera.com/hip/hip-30): CAIP Identifiers for the Hedera Network
- [HIP-179](https://hips.hedera.com/hip/hip-179): External Transaction Signing for SDK and other clients
- [HAPI](https://github.com/hashgraph/hedera-protobufs): Hedera API Protobuf Specification
- [CAIP-2](https://chainagnostic.org/CAIPs/caip-2): Blockchain ID Specification
- [CAIP-10](https://chainagnostic.org/CAIPs/caip-10): Account ID Specification
- [CAIP-19](https://chainagnostic.org/CAIPs/caip-19): Asset Type and Asset ID Specification
- [CAIP-25](https://chainagnostic.org/CAIPs/caip-25): JSON-RPC Provider Authorization
- [CAIP-27](https://chainagnostic.org/CAIPs/caip-27): JSON-RPC Provider Request
- [CAIP-217](https://chainagnostic.org/CAIPs/caip-217): Authorization Scopes
- [Wallet Connect Documentation](https://docs.walletconnect.com/)
- [Wallet Connect Specifications](https://github.com/WalletConnect/walletconnect-specs)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
