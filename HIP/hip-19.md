---
hip: 19
title: Decentralized Identifiers in Memo Fields
author: Nick White <nick@recdefi.com>, Jonathan Padilla <jonathan@recdefi.com>, Atticus Francken <atticus@recdefi.com>, Steve Frenkel <steve@recdefi.com>, Alex McComb <alex@recdefi.com>, Daniel Norkin <daniel.norkin@envisionblockchain.com>
type: Standards Track
category: Active
needs-council-approval: No
status: Final
created: 2021-06-07
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/101 
updated: 2023-04-03
---

## Abstract

This specification provides a standard way to use Decentralized Identifiers (DIDs), Verifiable Credentials (VCs), or Verified Presentations within Hedera state entity memo fields and thereby support the issuance of Verifiable Credentials or Verifiable Presentations about Hedera state entities. Just as the owner of a Hedera entity demonstrates that ownership and so claims associated authorizations via signatures with the private key(s) corresponding to the entity, a controller of a DID demonstrates that control via signatures with (likely) a different private key. Consequently, the DID controller can, when engaging in off-Hedera interactions, effectively demonstrate their association to the Hedera state entity without any on-Hedera transaction.

## Motivation

Entities (such as accounts, topics, and tokens) on Hedera have a memo field, allowing for an arbitrary string of less than 100 bytes to be attached to the entity. Entity memos are distinct from memos on transactions. A memo on an entity is persisted in Hedera state.

Decentralized Identifiers (DIDs) [0], as supported by the Hedera DID Method [1], provide a useful format for populating the memo fields.

According to the W3C, a DID, is "a globally unique identifier that does not require a centralized registration authority because it is registered with distributed ledger technology or other form of decentralized network."

DIDs can be dereferenced or resolved to a DID Document - a set of data that describes the subject of a DID, including mechanisms like public keys that the DID subject can use to authenticate itself and prove association with the DID. DID Documents are graph-based data structures that are typically expressed using JSON-LD.

Alternatively, if a use case would require Verified Credentials (VC) or Verified Presentations (VP), then the IDs of these objects must be populated in Hedera memo fields.

We follow the definition of a [W3C Verifiable Credential](https://www.w3.org/TR/vc-data-model/#credentials)
> A credential is a set of one or more claims made by the same entity. Credentials might also include an identifier and metadata to describe properties of the credential, such as the issuer, the expiry date and time, a representative image, a public key to use for verification purposes, the revocation mechanism, and so on. The metadata might be signed by the issuer. A verifiable credential is a set of tamper-evident claims and metadata that cryptographically prove who issued it.
A verifiable presentation in the context of this document is used according to the [W3C Verifiable Credential Presentation Description](https://www.w3.org/TR/vc-data-model/#presentations)
> A verifiable presentation expresses data from one or more verifiable credentials, and is packaged in such a way that the authorship of the data is verifiable. If verifiable credentials are presented directly, they become verifiable presentations. Data formats derived from verifiable credentials that are cryptographically verifiable, but do not of themselves contain verifiable credentials, might also be verifiable presentations.
> The data in a presentation is often about the same subject, but might have been issued by multiple issuers. The aggregation of this information typically expresses an aspect of a person, organization, or entity.
A presentation of one or more credentials must follow the specification in [W3C Verifiable Credential Standard for a Verifiable Presentation](https://www.w3.org/TR/vc-data-model/#presentations-0) such that that the authorship of the data in the Verifiable Presentation is verifiable.

Relative to other identifier formats, DIDs, VCs, and VPs have the advantages of being:

- standardized
- guaranteed global uniqueness
- resolvable into a DID Document carrying useful metadata (e.g. keys, endpoints, etc)
- cryptographically ‘claimable’ by creating a signature with a private key that corresponds to the public key & signature within the DID Document
- provable when their lifecycle is tracked via HCS as in the Hedera DID Method

## Rationale

When used in a memo field of a Hedera entity, DIDs, VCs, and VPs could be used to

- Link a Hedera entity to associated metadata, such as an NFT description
- Link a Hedera entity to an external service, for instance a DID or a VC on an HTS token could represent the KYC provider that administers the KYC flag on user accounts
- Link a Hedera entity to a different public key than of the owner/admin – enabling off-ledger authenticated interactions between that owner and other parties (without reusing Hedera keys)
- Link two different Hedera entities, for instance an HCS topic and a corresponding HTS token
- Link a Hedera entity to appropriate certifications about the actors that own or manage that entity, for instance, the renewable energy certifications (using the Verifiable Credentials [2] standard) of an inverter as validated by a 3rd party

## Specification

### Terminology

- Hedera state entity
- State entity admin/controller
- DID
- DID Controller
- DID Document
- Verifiable Credentials
- Verifiable Credential Subject
- Verifiable Presentations
- Verifier
- Issuer

### DID Size

A DID complying with the Hedera DID method is composed of the following parameters separated by a ':'

- the string 'did:hedera'
- a Hedera network identifier, e.g. 'mainnet'
- the base58-encoded SHA-256 hash of a DID root public key
- a Hedera file identifier of the application network's address book file listing the member nodes and their IP addresses
- an optional Hedera topic identifier on which the DID document was registered

Below is an example Hedera DID in which the topic identifier parameter is omitted.

> did:hedera:mainnet:7Prd74ry1Uct87nZqL3ny7aR7Cg46JamVbJgk8azVgUm;hedera:mainnet:fid=0.0.123

A Hedera entity memo field can be at most 100 bytes and so the DIDs must be less than this size.

The above DID is 90 bytes.

To ensure that DIDs do not exceed the 100 byte maximum, the optional tid topic identifier should not be used.

### Processes

#### Associating a DID to a Hedera entity

A DID is associated with an entity by specifying the DID as the value of the memo field for that entity.

The DID can be associated either when the entity is first created or through a subsequent entity. If the entity is immutable (with no admin keys specified) then the association must happen on the entity creation.

If the DID is registered into an [appnet](https://hedera.com/blog/hedera-technical-insights-hedera-consensus-service-scaling) via a HCS message (as per the Hedera DID method), it can occur either before or after the association with the entity.

1. Create key pair and associated DID as per Hedera DID Method
2. Register DID into appnet with HCS message carrying DID Document against appropriate HCS topic as per Hedera DID Method
3. Include DID in memo field when creating or updating entity

#### Resolving Hedera Entity DID

 1. Query Hedera entity info from mainnet or mirror, e.g. HAPI TokenGetInfo
 2. Extract DID from memo field
 3. Resolve DID into DID Document as per Hedera DID Method
 4. Extract public key from DID Document to verify signatures
 5. Query listed endpoints for associated data, for instance a Verified Credential  

### Verifiable Credentials

Once a DID has been securely associated with a Hedera entity, then a Verifiable Credential (VC) issued to that DID can be interpreted as having been issued to the entity itself, or the actor that controls the entity. The VC can therefore be seen as having been issued to the entity.

This secure mapping between entity and VC could be used to, for example

- assert the KYC status of the owner of a Hedera account
- assert the environmental energy generation characteristics of an inverter, and its corresponding REC tokens
- etc.

When a verifier is presented with a VC, it should be possible to discover the Hedera entity to which the VC was issued.

The issuer of the VC should include the Hedera entity identifier as a HederaEntityID claim within the VC.

An example VC with a HederaEntityID claim identifying the Hedera entity to which is was issued.

```json
 {
  "@context": [
    "https://www.w3.org/2018/credentials/v1"
  ], 
  "id": "http://example.edu/credentials/1872",
  "type": ["VerifiableCredential", "HederaEntityCredential"],
  "issuer": "did:hedera:mainnet:dfjkghkdjfgjdjkfgjdnfjgdfg",
  "issuanceDate": "2021-01-01T19:73:24Z", 
  "credentialSubject": {
    "id": "did:hedera:mainnet:dkfgmkdfghdkjfgh",
    "HederaEntityID": {
      "id": "did:example:c276e12ec21ebfeb1f712ebc6f1",
      "name": {
        "value": "0.0.123456",
        "lang": "en"
      }
    }
  },
  "proof": {
    "type": "RsaSignature2018",  
    "created": "2017-06-18T21:19:10Z",  
    "proofPurpose": "assertionMethod",  
    "verificationMethod": "https://example.edu/issuers/keys/1",  
    "jws": "eyJhbGciOiJSUzI1NiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..TCYt5X
      sITJX1CxPCT8yAV-TVkIEq_PbChOMqsLfRoPsnsgw5WEuts01mq-pQy7UJiN5mgRxD-WUc
      X16dUEMGlv50aqzpqh4Qktb3rk-BuQy72IFLOqV0G_zS245-kronKb78cPN25DGlcTwLtj
      PAYuNzVBAh4vGHSrQyHUdBBPM"
  }
}
```

### Verifiable Presentations

Presentations MAY be used to combine and present credentials. They can be packaged in such a way that the authorship of the data is verifiable. The data in a presentation is often all about the same subject, but there is no limit to the number of subjects or issuers in the data. The aggregation of information from multiple verifiable credentials is a typical use of verifiable presentations. Below is the basic structure for a Verified Presentation:

```json
 {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://www.w3.org/2018/credentials/examples/v1"
  ],
  "id": "urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5",
  "type": ["VerifiablePresentation", "CredentialManagerPresentation"],
  "verifiableCredential": [{ ... }],
  "proof": [{ ... }]
}
```

The contents of the verifiableCredential property shown above are verifiable credentials, as described by this specification.

## Backwards Compatibility

This HIP is entirely opt-in, and does not break any existing functionality.

## Security Implications

Inserting a DID into an entity's memo field establishes an association between the entity and the controller of the DID, and so a connection between the entity and uses of that DID. For instance, if the same DID is used in a Verifiable Credential, then the identity attributes within that credential may be attributed to the controller of the entity.

The controller of the DID lays claim to the DID, and so the association to the Hedera entity, with a digital signature using the private key associated with the DID.

We consider different attacks against the association

### An attacker modifies the memo field to a different DID

Description - attacker is able to change the value of the DID within an entity's memo field to a DID the attacker controls, thereby claiming the association. Whenever some other actor queries the entity (using a TokenGetInfo for instance, the fraudulent DID would be returned as the value of the memo field in the response. That DID would be resolved into the attacker's DID Document and public key. As the attacker has the corresponding private key, they would be able to demonstrate they control the public key and so DID - effectively impersonating the valid entity owner.

Prevention - When a Hedera entity is created or updated, the keys that are authorized to subsequently make changes to the entity can be stipulated. If no such keys are stipulated, then the entity is immutable and the attack is thwarted as the memo field cannot be changed.

If a key is stipulated, then only the admin/owner of the entity with the private key corresponding to the stipulated public key can modify the entity and change the memo field.

Hedera supports multi-signature authorization rules on entity modifications - an entity can be created such that multiple keys must sign a modification like changing the memo field and thereby offering greater resistance to this attack.

### An attacker switches the DID Document that the DID resolves to

Description - The attacker is able to change the DID Document to which a DID in the memo field of an entity resolves into a DID Document that they control, and thereby effectively claim the association. The attacker sends an Update message via HCS with a new version of the DID Document, one containing the attacker's public key and not that of the valid DID controller.  The the members of the appnet receive this new DID Document and replace the existing valid DID Document with the new version. When subsequently asked to resolve the DID, the appnet members return the fraudulent DID Document, allowing the attacker to impersonate the valid DID controller.

Prevention - The attack is prevented because only the private key associated with the DID is able to update the DID Document - the update message (as per the Hedera DID method) must have a signature created with the private key associated with the DID's public key.

> signature - A Base64-encoded signature that is a result of signing a minified JSON string of a message attribute with a private key corresponding to the public key #did-root-key in the DID document.

Additionally, in the Hedera DID method, the DID itself is derived from the public key. A verifier would be able to determine that the public key of the attacker did not correspond to the claimed DID.

### An attacker reuses a DID in their entity

Description - An attacker creates a Hedera entity and includes some other actor's DID in the memo field in an attempt to falsely associate the new entity with that other DID.

Prevention - Nothing prevents the attacker from reusing a DID in this manner - the memo fields on entities are not guaranteed to be unique.

The attacker will however not have the private key associated with the DID and so will not be able to demonstrate control of the DID.

Note that it is not sufficient to have the private key sign the DID Document itself at the time of creation.

## How to Teach This

Note that the DID must fit within the memo size restrictions.

## Reference Implementation

## Rejected Ideas

This proposal uses the "memo" field to specify the DID for entities. An alternative would be to use a dedicated DID param added to each entity.

## Open Issues

N/A

## References

0. <https://www.w3.org/TR/did-core/>
1. <https://github.com/hashgraph/did-method>
2. <https://www.w3.org/TR/vc-data-model/>

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>
