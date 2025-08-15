---
hip: 13
title: Hedera Name Service
author: H. Bart <hbart.lit@gmail.com>
type: Standards Track
category: Application
needs-council-approval: No
status: Active
last-call-date-time: 2021-11-23T07:00:00Z
created: 2021-03-13
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/56
updated: 2021-11-30
---

## Abstract

The Public Key Infrastructure (PKI) of today is highly centralised with a handful of certificate authorities(CAs) being responsible to process digital identities(such as domains) by vouching for public keys associated with said identities. This system if highly vulnerable as if any one of the existing list of trusted CAs is compromised so is the entire security of the internet. One solution to this is DNS-based Authentication of Named Entities(DANE) which enables domain owners to store a TSLA record in the Domain Name System(DNS) that defines a contract for how clients can trust a public key is in fact owned by said domain before proceeding to establish a TLS connection. However DANE relies on DNSSEC which relies on a chain of trust akin to that in existing CA PKI as previously mentioned hence is susceptible to similar attacks.

By moving DNS (w/ DANE enabled) onto a secure decentralised network such as Hedera security issues resulting from the chain of trust in existing systems are mitigated and if widely adopted would render all existing CAs, DNS stakeholders(ICANN, domain registrars) obsolete.

## Motivation

The Hedera Public Ledger is a secure scalable decentralised ledger making it an ideal candidate to supersede existing centralised DNS and PKI systems. Currently the most secure implementations of these systems rely on a chain of trust which is compromised if at least 1-of-m entities in the chain is compromised. The shortcomings inherent to this chain of trust can be mitigated by being replaced with the aBFT consensus of Hedera, hence in order to compromise even a single DNS Resource Record(RR) an attacker must control at least 1/3 of the consensus vote.

Furthermore, the proposed Hedera Name Service(HNS) excels existing systems by enabling the principal owner/s of a domain registered on HNS the ability to update any of their domain's RR at consensus finality speeds(currently <5 seconds), whereas existing infrastructure takes about 1 day for domain propagation. The effective latency would be slightly higher than this as client browsers making for example domain resolution requests would do so to Hedera Mirror Nodes to reduce unnecessary load on MainNet nodes, hence the effective latency would be the MainNet latency offset by the time it takes for any given Mirror Node to reflect the latest consensus round HNS updates. Furthermore, Mirror Nodes(possibly serving as dedicated HNS/DNS resolvers) would respond to requests with a state proof that the client browser would process either via an HNS browser extension client or the browser's built-in HNS client(assuming browser developers find value in doing so). In addition, any other operations facilitated by HNS such as domain atomic swaps or transfers would also be executed at such speeds, which again is orders of magnitude faster than existing systems that can take up to 7 days to process a domain transfer.

## Rationale

The Hedera Name Service offers numerous benefits to both domain owners and internet users over existing centralised systems. It enables domain owners to:
* near instantly update their domains DNS RR, which includes A/AAAA records enabling increased website uptime and censorship resistance amongst other use cases, and TLSA records for near instant approval/revocation of TLS public keys/certificates,
* near instantly transfer or trade domains via atomic swaps, and
* add multisig control of a domain for enhanced security.

Besides the mutual security benefits shared by both domain owners and their respective clients, other potential benefits include:
* the ability for clients to issue payments directly to a given domain owner's wallet, by specifying the domain name in the transaction address field as opposed to the Hedera Hashgraph address alias, as the latter isn't as user friendly as a human readable domain name. 

## Specification

Backwards Compatibility will be described more completely in the next section. To allow for backwards compatibility with existing DNS infrastructure Hedera will initially only allow for HNS native second-level domains(SLD) to be registered under the top-level domain(TLD) ".hh"(which is an initialism for Hedera Hashgraph). Furthermore, an SLD owner can register subdomains under their SLD, noting that the SLD comprises the subdomains in a non-fungible manner, hence any transfer of a given SLD entails the transfer of that SLD's subdomains if any. It is suggested that the Hedera Council secure ownership of the TLD ".hh" from ICANN.

HNS native SLDs can be registered in a fair equitable manner that mitigates issues such as domain hoarding and domain sniping(i.e. the early registration of potentially lucrative domains at a fixed cost in the hopes of selling at significant profits) by early adopters as follows:
* on registration of an SLD by an *initial domain registrant* the SLD is auctioned off by the Hedera network as described below.
* Decentralised auction marketplaces typically use either of 2 auction styles to mitigate price sniping; namely *Vickrey* or *Candle* styled auctions. The proposed auction format is as follows.
* The auction style is an *absolute* auction which is divided into 2 phases of suitably defined durations.
    1. The first and opening phase is initialised by the Hedera network on a successful SLD registration attempt by the *initial domain registrant* and should have a duration suitably long enough for all potential and globally distributed participants to be informed of the auction and arrange the necessary funds to participate therein(possibly 3 days long).
    2. The second and closing phase of the auction is a *Candle* styled auction which as previously mentioned is used to mitigate price sniping(possibly an equiprobable distribution over a day with a mean duration of 12 hours).
* To further mitigate the issue of domain hoarding by early adopters a hard cap on the number of active SLD registration auctions can be defined to allow for a more gradual release of SLDs into the market. Say this hard cap is set to 1000 auctions and the mean auction duration is 3.5 days(Phase 1: 3 days + Phase 2: ~0.5 days), this would allow for ~100 thousand SLDs to be registered per year. This hard cap can be increased as adoption of HNS grows and demand of native HNS domains increases.
* Once an auction has concluded and ownership of the SLD has been granted to the winning bidder, the new domain owner can now proceed to setup their domain's associated DNS resource records(A/AAAA, TLSA RR, etc).

To incentivise HNS native SLD registration regardless of an *initial domain registrant's* financial capacity to win an auction a small commission of the winning bid can be awarded to the *initial domain registrant*, whilst the remaining and largest portion of the winning bid can be allocated to the Hedera treasury to be used at the discretion of the Hedera Council.

## Backwards Compatibility

To ensure backwards compatibility with existing DNS infrastructure all domain owners that can prove ownership of a domain and its associated public key to the Hedera network can be onboarded onto HNS. This can be achieved by a domain owner proving ownership of a public key vouched for in SSL certificate for said domain that must be signed by any one CA in the list of trusted CAs vetted by the Hedera Council. If HNS were to be widely adopted the Hedera network may decide to enable registration of SLDs under TLDs other than the TLD ".hh" and TLDs still managed by ICANN. However if HNS were to become the de facto domain name system, the Hedera network may assume management of all TLDs.

## Security Implications

The Hedera Council may have to continuously update the list of trusted CA's to enable the secure onboarding of existing DNS domain owners. 

If the keys to a Hedera Account that owns a given domain are lost that may render the domain indefinitely inactive. A potential solution would be to have a domain owner periodically prove a domain's activeness and if rendered inactive the domain is re-auctioned by the Hedera network.

## How to Teach This

Frontend interfaces would have to be developed for enabling users to register HNS native SLDs or for onboarding existing domains and should have their respective tutorials educating their userbase on proper interaction with their application. In addition the Hedera developer tutorials/documentation should be sufficiently detailed to enable the development of the aforementioned user facing applications.

## Reference Implementation

N/A

## Rejected Ideas

N/A

## Open Issues

N/A

## References

DANE: https://tools.ietf.org/html/rfc7671
Handshake: https://handshake.org/files/handshake.txt
Namebase: https://www.namebase.io/
DPKI: https://danubetech.com/download/dpki.pdf
Namecoin Whitepapers: https://www.namecoin.org/resources/whitepaper/
ENS: https://docs.ens.domains/
Unstoppable Domains: https://docs.unstoppabledomains.com/
Polkadot Parachain Slots Candle Auctions: https://wiki.polkadot.network/docs/en/learn-auction

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
