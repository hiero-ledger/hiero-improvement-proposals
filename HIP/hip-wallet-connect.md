---
hip: TBD
title: Improvements to the Wallet Connect implementation for dApps on Hedera
author: Greg Scullard
working-group: TBD
type: Standards Track
category: Application
needs-hiero-review: No
needs-hedera-approval: No
status: Draft
created: 2025-05-07
discussions-to:
requires: [820](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-820.md)
replaces: [820](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-820.md)
updated:
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

> The account address is the standard account identifier format. Each of realm, shard, and account ID separated with a ~~dash~~ [period] (`.`). The format of the realm, shard, and account ID are unsigned integer in decimal representation…

The identifiers described above shall be used during the Wallet Connect 2.0 pairing session negotiation to identify the hedera ledgers and accounts that will participate in transaction signing and submission to the Hedera network.  

What is not included in previous work is the definition of the Wallet Connect custom methods and events that complete the support for the use cases identified above.  The following namespace methods shall be supported:

### hedera_signTransaction

No changes from [Hip-820](https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/refs/heads/main/HIP/hip-820.md)

### hedera_signTransactions

When a dApp requires only the signature from the controller (wallet), it can use the `hedera_signTransactions` method which contrary to the `hedera_signTransaction` method will accept a list of transactions with unique `node account id`s.  
This method accepts a base64 encoded protobuf representation of a [`TransactionList`](https://github.com/hashgraph/hedera-protobufs/blob/f36e05bd6bf3f572707ca9bb338f5ad6421a4241/sdk/transaction_list.proto) message which is obtained by using the `toBytes()` method of an sdk Transaction.  
The controller decodes and interprets the contents, and if valid and approved, returns:

Note: In the event this feature is used to collect signatures in a multi-sig scenario, it is essential that the `Transaction` sent for signatures includes one or more `node account id`s, else the wallet may allocate them and different wallets may generate a different list which will result in errors.

#### Parameters

`transactionList` – a base64 encoding of the Hedera SDK's Transaction bytes `transaction.toBytes()`.

`signerAccountId` – an Hedera Account identifier in [HIP-30](https://hips.hedera.com/hip/hip-30) (`<nework>:<shard>.<realm>.<num>-<optional-checksum>`) form.  
This value identifies the account (and therefore associated key set) that the dApp is requesting to sign the transaction.  
It is permissible to omit this value if necessary for keys not associated with an account (for example, a token supply key).  
The controller (wallet) may choose to reject the request based on the identified account or omission of this property, or provide additional signatures beyond the request if the controller deems it necessary or proper.

#### Returns

`signedTransaction`: a base64 encoding of the Hedera SDK's Transaction bytes `transaction.toBytes()`

`publicKey`: a base64 encoding of the public key used to sign the transactions. The application will need this in order to add the newly provided signatures to an existing transaction.

#### Example

The application having created and submitted a `transaction` object, and got `signedTransaction` and `publicKey` as a response can add the new signatures to the `transaction` as follows:

```javascript
    // create a transaction with the SDK
    // request that transaction is signed via wallet connect
    // returns a response called result

    const publicKey = result.publicKey
    const signedTransaction = result.transaction
    transaction.addSignature(publicKey, signedTransaction.getSignatures())
```

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

Old applications will continue to work with newer wallets.
Applications using `hedera_signTransactions` introduced in this improvement proposal will not work with wallets that have not yet implemented support for this feature.

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

The [hedera-wallet-connect repository](https://github.com/hashgraph/hedera-wallet-connect) contains sample code and demos that serves as a reference implementation.

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
