---
hip: 29
title: JavaScript DID SDK
author: Daniel Norkin <daniel.norkin@envisionblockchain.com>
type: Standards Track
category: Application
needs-council-approval: No
status: Active
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/166
created: 2021-10-11
updated: 2021-10-11
---

## Abstract

The Hedera Hashgraph ecosystem has been extremely busy regarding the decentralized development of Hedera’s developer tools/services. While vertical solutions are important, horizontal solutions are just as imperative. A great example of a horizontal solution gaining popularity is the Hedera DID Method for Decentralized Identifiers (DIDs) and Verified Credentials (VCs). Up until now, the only way to implement the Hedera DID Method was through the Java DID SDK but many applications are built using other languages, such as JavaScript. Hence, this Hedera Improvement Proposal discusses the DID SDK written in JavaScript.

## Motivation

When in an implementation scenario, it’s good to have options for development team. The only way originally to implement the Hedera DID method was using the Java DID SDK. We anticipate the release of the Hedera JavaScript DID SDK to be appealing to an extremely large JavaScript development community.

## Rationale

Identity networks are set of artifacts on Hedera Consensus Service that allow applications to share common channels to publish and resolve DID documents, issue verifiable credentials and control their validity status. These artifacts include:

- address book - a file on Hedera File Service that provides information about HCS topics and appnet servers,
- DID topic - an HCS topic intended for publishing DID documents,
- and VC topic - an HCS topic playing a role of verifiable credentials registry.

This SDK is designed to simplify :

- creation of identity networks within appnets, that is: creation and initialization of the artifacts mentioned above,
- generation of decentralized identifiers for [Hedera DID Method][did-method-spec] and creation of their basic DID documents,
- creation (publishing), update, deletion and resolution of DID documents in appnet identity networks,
- issuance, revocation and status verification of [Verifiable Credentials][vc-data-model].

The SDK does not impose any particular way of how the DID or verifiable credential documents are constructed. Each appnet creators can choose their best way of creating those documents and as long as these are valid JSON-LD files adhering to W3C standards, they will be handled by the SDK.

## User stories

TBA

## Specification

### Identity Network
```
const client = ... // Client
const identityNetwork = new HcsIdentityNetworkBuilder()
  .setNetwork("testnet")
  .setAppnetName("MyIdentityAppnet")
  .addAppnetDidServer("https://appnet-did-server-url:port/path-to-did-api")
  .setPublicKey(publicKey)
  .setMaxTransactionFee(new Hbar(2))
  .setDidTopicMemo("MyIdentityAppnet DID topic")
  .setVCTopicMemo("MyIdentityAppnet VC topic")
  .execute(client);
```

### DID Generation
From already instantiated network:
```
const identityNetwork = ...; //HcsIdentityNetwork
// From a given DID root key:
const didRootKey = ...; //PrivateKey
const hcsDid = identityNetwork.generateDid(didRootKey.publicKey, false);
```
or:
```
// Without having a DID root key - it will be generated automatically:
// Here we decided to add DID topic ID parameter `tid` to the DID.
const hcsDidWithDidRootKey = identityNetwork.generateDid(true);
const didRootKeyPrivateKey = hcsDidWithDidRootKey.getPrivateDidRootKey().get();
```
or by directly constructing HcsDid object:
```
const didRootKey = HcsDid.generateDidRootKey();
const addressBookFileId = FileId.fromString("<hedera.address-book-file.id>");
const hcsDid = new HcsDid(HederaNetwork.TESTNET, didRootKey.publicKey, addressBookFileId);
```
Existing Hedera DID strings can be parsed into HcsDid object by calling fromString method:
```
const didString = "did:hedera:testnet:7c38oC4ytrYDGCqsaZ1AXt7ZPQ8etzfwaxoKjfJNzfoc;hedera:testnet:fid=0.0.1";
const did = HcsDid.fromString(didString);
```

### Transaction
```
const client = ...; //Client
const identityNetwork = ...; //HcsIdentityNetwork
const didRootKey = ...; //PrivateKey
const hcsDid = ...; //HcsDid
const didDocument = hcsDid.generateDidDocument().toJson();
// Build and execute transaction
await identityNetwork.createDidTransaction(DidMethodOperation.CREATE)
  // Provide DID document as JSON string
  .setDidDocument(didDocument)
  // Sign it with DID root key
  .signMessage(doc => didRootKey.sign(doc))
  // Configure ConsensusMessageSubmitTransaction, build it and sign if required by DID topic
  .buildAndSignTransaction(tx => tx.setMaxTransactionFee(new Hbar(2)))
  // Define callback function when consensus was reached and DID document came back from mirror node
  .onMessageConfirmed(msg => {
    //DID document published!
  })
  // Execute transaction
  .execute(client);
```

[did-method-spec]: https://github.com/hashgraph/did-method
[did-core]: https://www.w3.org/TR/did-core/
[vc-data-model]: https://www.w3.org/TR/vc-data-model/

## Backwards Compatibility

No issues.

## Security Implications

Permissions are defined in Policy Workflow Workgroups.

## How to Teach This

One example of how the Hedera JS DID SDK should be leveraged can be found in the reference implementation of the open-source Guardian solution.

## Reference Implementation

Reference implementation can be found in the open-source Guardian repo.

## Rejected Ideas

None.

## Open Issues

None.

## References

- <https://github.com/hashgraph/did-method>
- <https://github.com/hashgraph/hedera-sdk-js>
- <https://docs.hedera.com/hedera-api/>
- <https://www.hedera.com/>
- <https://www.w3.org/TR/did-core/>
- <https://www.w3.org/TR/vc-data-model/>

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
