---
hip: 31
title: Add Token Transfer Decimal Information
author: Chris Campbell <chris@launchbadge.com>
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
last-call-date-time: 2021-12-21T07:00:00Z
release: v0.22.0
created: 2021-10-14
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/issues/165
updated: 2022-04-26
---

## Abstract

This specification proposes a way to provide on wire token decimal information, by splitting the amount field in token transfers into a whole and fractional part.

## Motivation

As of drafting this HIP, [Ledger](https://www.ledger.com/) is the only hardware wallet to support Hedera Hashgraph. In a recent review of the Ledger [BOLOS application for Hedera](https://github.com/LedgerHQ/app-hedera), the Ledger development team flagged the current scheme for providing decimal information for display of token transfers on device as posing a security risk. The current version of the Ledger BOLOS app provides decimals as a parameter passed separately from the transaction body that will be signed. This can potentially lead to manipulation of display of the token transfer amount to shift the decimal place for an attacker's benefit (i.e by tricking a user into signing a transaction that is off by orders of magnitude). The app currently works this way because the protobuf messages for token transfers do not include decimal information, and client wallets must therefore look up this information using a query (at cost) or a mirror node, and then pass this information to the device using a general parameter. 

The motivation for the proposed change is to solve this problem. Token transfers can be modified to provide enough information in their transaction bodies that applications parsing on wire token transfer messages can correctly and verifiably display the transfer information.

## Rationale

The below change to token transfer protobuf messages is formulated to incur a minimal operational cost to the network while providing enough information to address hardware wallet security concerns. 

## Specification

```
message TokenTransferList {
    // [...]
    
    /**
     * If present, the number of decimals this fungible token type is expected to have. The transfer
     * will fail with UNEXPECTED_TOKEN_DECIMALS if the actual decimals differ.
     */
    UInt32Value expected_decimals = 4;
}
```

## Backwards Compatibility

It shouldn't break existing token transfer messages, and will provide needed information for some applications going forward. 

## Security Implications

A Ledger hardware wallet user would be able to trust that the fractional display of a token transfer is coming from an on wire message that they are signing with their private key. 
