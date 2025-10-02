---
hip: 27
title: DID improvements to offer a broader support and interoperability for the Hedera DID method
author: Jo Vercammen <jo.vercammen@meeco.me>
type: Standards Track
category: Application
needs-council-approval: No
status: Active
last-call-date-time: 2022-01-19T07:00:00Z
created: 2021-06-06
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/103
updated: 2022-01-05
---

## Abstract

This HIP describes improvements to the existing DID-method solution for Hedera. The main goal is the further adoption and support for the Hedera DID Method. Therefore, we propose the following approvements:
* Update of the current DID method specification, so it is in line with the current W3C DID Core Specification version 1.0.
* Update of the DID SDKs (Java and javascript) to adhere to the above specification. 
* Separate the Appnet from the DID SDK impementation and update the Appnet so that it serves as a reference implementation in caching and retrieving DID documents.
* Extend the DIF Universal Resolver with a Hedera DID Resolver. So that there is better support and interopability with other identity fabrics in the wider community and provide for interoperability between different DID methods.  

## Motivitation

The main goal of this Hedera Improval Proposal is to have the Hedera DID method supported under the DIF Univeral Resolver Project. DIF’s Universal Resolver provides a unified interface which can be used to resolve any kind of decentralized identifier. The DIF Universal Resolver system is designed to fulfil a similar purpose as bind in a DNS system - the recursive resolver that enables the resolution of identifiers. However, this new system uses self-sovereign identifiers to replace domain names. The introduction of DIF Universal Resolver is an important step in a decentralized identity framework, as it allows identity-driven applications and communication systems to retrieve DID-Documents as a basic component to prove the identity of the different actors. This enables higher level data formats (such as Verifiable Claims) and protocols to be built on top of the identifier layer, no matter which blockchain or other system has been used to register the identifier.

The interface itself is a web-hosted solution that resolves supported DIDs and retrieves their respective DID documents through a REST API. Through the community it has grown up to support more than 30 DID methods, enabling more and more interoperability across ledgers and DID methods. The DIF Universal Resolver, now hosted as a community service, is seen as a reference for providing easily accessible services to resolve different DID methods.

By adding the Hedera did method to the DIF universal resolver, it will enable further compatibility with other identity frameworks that will create the possibility to verify credentials that are issued by the Hedera network and leverage these credentials in different ecosystems. This will potentially increase the adoption of Hedera as an identity layer and recognise Hedera as a cooperative identity framework within the community. 

Further, it allows Hedera identity wallet providers to leverage credentials that are issued outside of the Hedera identity framework. Hence, creating a richer product offering and enabling more market opportunities.

However, we discovered that certain prerequisites needed to be done, before we're able to offer support for the DID method under the DIF Universal Resolver project. It means that following prerequisites need to be actioned first:
* Having the DID method specification in line with the current W3C DID Core Specification.
* Updating the respective SDKs to adhere the DID method specification
* Update the Appnet that it is a reference implementation for handling/caching DIDs and providing a means to pass on the transaction costs to the relying party.



## Rationale

The target is to have a community driver that offers an interoperable solution between the different ledgers and DID methods. The solution needs to enable services to verify identity holders and their associated DIDs, independent from the ledger they were issued. 
The solution needs to be compliant with the current W3C standards specification around decentralized identities and the Universal Resolver initiative.

## Specification

The specification consists of 3 main parts:

### Hedera DID Method Specification

We have updated the existing DID Method specification based upon our own experiences and validating with the lastest published W3C DID Core specification Version 1.0. The new draft is found on the [Meeco github repository] (https://github.com/Meeco/did-method/blob/master/did-method-specificationV1.md) and is part of this HIP process under review for community feedback.
The specification targets specific issues in the DID method:
* Misuse of certain reserved characters in the DID method URN: The current specification contains a semicolon to identify the network and file storage ID (did:hedera:mainnet:7Prd74ry1Uct87nZqL3ny7aR7Cg46JamVbJgk8azVgUm;hedera:mainnet:fid=0.0.123). The semicolon character is reserved character for URLs.
* Misalginment with the current DID Speficiation standard
* Reduce the footprint of DID-document on the Hedera network.
* Offering direct support of registering, updating and resolving DIDs onto the Hedera Network.


### Hedera Appnet Specification

The Appnet application will serve as reference implementation on how an application can perform:

#### DID Management

* Construct the DID document, based upon the CRUD events that happened on a specific DID.
* Register, update and resolve DIDs on the Hedera network.
* Cache certain DID documents for reuse and network cost-reduction. 

##### VC Hash Management

* Create credentials hash
* Prepare Ledger specific message for signing (e.g. Hedera message structure with timestamp)
* Issuer/verifier simulator:  sign ledger specific message with the private key
* Register Hash to DLT
* Store and Sync submitted ledger records in the local file system (CRUD)
* Resolve DID Document from the local file system


### Hedera DID Method support for DIF 

The contribution for a new DID method driver to the universal resolver consists of a Docker image which exposes an HTTP interface for resolving DIDs. New contributions are submitted as Pull Requests to the Universal Resolver repository.

The driver offers an HTTP GET call under the following structure: http://<your-image>:8080/1.0/identifiers/<your-did>. The driver receives an Accept header with a value in application/ld+json format. The response is a valid DID Document or a DID Resolution Result in the HTTP body. Specification on the API definition is available through the following link: https://github.com/decentralized-identity/universal-resolver/blob/main/swagger/api-driver.yml



## Backwards Compatibility

Current SDK's will still support the Hedera DID Specification v0.1, however the old specification is under deprecation. DID Controllers should take actions to migrate their current did-documents to the new standards. The SDK will offer DID Controllers the means to migrate their current DID-documents to the new DID Specifications. 


## Security Implications

There are no direct security implications, since the uniresolver only exposes the resolution of DID documents trough an API backend that integrates with the existing driver. This means that there is no possibility that mutable actions on data can take place.

## How to Teach This
N/A

## Reference Implementation
N/A

## Rejected Ideas
N/A

## Open Issues

## References

* https://github.com/decentralized-identity/universal-resolver 
* https://github.com/peacekeeper/uni-resolver-driver-did-example
* https://github.com/decentralized-identity/universal-resolver/blob/main/docs/driver-development.md
