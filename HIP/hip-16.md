---
hip: 16
title: Entity Auto-Renewal
author: Leemon Baird (@lbaird), Nosh Mody (@noshmody), Quan Nguyen (@qnswirlds)
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
created: 2021-03-29
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/64
updated: 2021-05-12
---

## Abstract

When a Hedera entity is created (e.g., an account, file, smart contract, HCS topic, TokenType, etc.), the payer account is charged enough hbars (as a rental fee) for the entity to stay active in the ledger state until consensus time passes its _expiration time_. Users can extend the expiration time of an entity by paying an extension fee via an update transaction. This HIP defines and discusses another mechanism to be implemented by Hedera Services to automatically renew expired entities using funds of linked _autorenew accounts_, and automatically remove expired entities that have not been renewed by either update or auto-renewal.

## Motivation

For a public ledger to avoid suffering a tragedy of the commons it is important that all participants in the ledger share in the cost of ledger resources used. Renewal and auto-renewal fees are the implementation of this principal.

## Rationale

Prior to this HIP, the expiration time of a Hedera entity has not been checked or enforced. An entity remains active in the ledger even after its expiration time, without additional fees being charged. Upon implementation of this HIP, Hedera Services will __begin to charge rent__ for entities, and will eventually remove from the ledger expired entities that have not been renewed, either manually or by auto-renewal from a funded auto-renew account at the time renewal fees are due.

The expiration time of an entity still can be extended via an update transaction, as it is currently supported. Anyone can initiate this update, not just the owner or the admin of the entity. Users will not be overcharged for the extension fee.

## Specification

### Terminology
- Deletion - A successful delete transaction will mark an entity as deleted and that entity cannot be operated upon.
The entity will remain in the ledger, marked as deleted, until it expires.
- Expiration - the entity has passed its expiration time and has not been renewed, so it is temporarily disabled.
- Renewal - the extension of an entity's expiration time, either by an update transaction, or by auto-renewal.
- Removal - The entity is permanently removed from the state of the decentralized ledger.
- Grace period - The time during which an expired entity is disabled, but not yet removed, and can still be renewed.
- Action - An operation performed by the network that isn't during the processing of its transaction, such as an auto-renewal, or the execution of a scheduled transaction.

Every entity in Hedera fill have fields for `expirationTime`, `autorenewPeriod`, and `autorenewAccount`. These can be set when it is created, and can be changed with an `update` transaction. The `expirationTime` is the date and time when it will expire, unless extended at that time by an auto-renew, or extended earlier by an `update` transaction. Each auto-renew will attempt to extend the expiration by `autorenewPeriod` seconds. The `autorenewAccount` is the account that will automatically pay for the auto-renew. If it is null, or invalid, or has an empty balance, then the entity will try to pay for the auto-renew itself (if it's an account or smart contract containing hbars). 

All Hedera Services nodes will perform a synchronous scanning of active entities. When a node finds a non-deleted, expired
entity, it will try to renew the entity by charging its auto-renew account the renewal fee, for an extension
period given in seconds. 

This extension period can be customized by the `autoRenewPeriod` property of the entity (e.g., a crypto account,
a topic, a smart contract, or a token type). For a file, the extension period will be 8 million seconds (about 92 days). (Future protobuf changes will
permit customizing this extension period as well.) Records of auto-renew charges will appear as `actions` in the record stream, and
will be available via mirror nodes. __No__ receipts or records for auto-renewal actions will be available via HAPI queries.

If the linked auto-renew account cannot cover the fee required for the default extension period, then the entity itself is charged (if it is an account or smart contract). If there still are insufficient hbars, the remaining balance
will be wholly used for a shorter extension of the entity. This might be shorter than the min allowed for setting an auto-renew period for an entity. If the linked account (and entity itself) already has a zero balance at the time that
renewal fees are due, the entity will be marked as `expired`. 

An expired entity will still have a grace period before it is removed. During that period, it is inactive, and all transactions involving it will fail, except for an update transaction to extend its expiration time. If it is not manually extended during the grace period, and if it and its auto-renewal account still have a zero balance at the end of the grace period, then at the end of the grace period it will be permanently removed from the ledger. Its entity ID number will not be reused. Any tokens in it will be transferred to their treasury accounts. The length of the grace period is a single, global setting for the entire ledger, such as 30 days. If it is renewed during the grace period (by a transaction, or by auto-renewal at the end of the grace period, then the renewal must include payment for the portion of the grace period that has already passed.

If an entity was marked as deleted, then it cannot have its expiration time extended. Neither an update transaction nor an auto-renew will be able to extend it. It can only be deleted by a `delete` transaction, and the transaction will only succeed if it contained no hbars or tokens.

Hedera Services will generate an [autorenewal-record](https://github.com/hashgraph/hedera-services/blob/main/docs/autorenew-feature.md#autorenewal-record)
for the action on each entity that is automatically renewed. Hedera Services will generate an
[entity-removal-record](https://github.com/hashgraph/hedera-services/blob/main/docs/autorenew-feature.md#entity-removal-record)
for the action on each entity that is automatically removed.

If an entity `E` is created with auto-renew account `A`, then the `create` transaction will extend the expiration time of `A` to be at least equal to `E` (unless it's already equal or greater).  That ensures that if `E` is an entity that can't be updated (e.g., an immutable smart contract with no admin key), then `A` will never expire before `E`. Similarly, if an update or auto-update to `E` extends its expiration, then `A` must also be extended to last at least as long. This is also true if `E` is a TokenType, and `A` is its treasury.

Crypto accounts will be prioritized for implementation of the auto-renewal feature, followed by consensus topics, tokens and smart contracts. Schedule entities
do not auto-renew, and cannot be manually renewed with a transaction, and are always removed from the ledger when they expire.

To summarize, the state of an entity can change like this:
```
                                     (success)                                       (success)
    +------------------------------------+-----------------------------------------------+
    |                                    |                                               |
    |                                    |                                               |
    v  (wait until expiration time)      |     (fail)         (wait for grace period)    |       (fail)
ACTIVE ---------------------------> AUTO-RENEW -----> EXPIRED ----------------------> AUTO-RENEW -----> REMOVED
 |  ^                                                    |
 |  |                                                    |
 |  |       (update transaction from any account)        |
 |  +----------------------------------------------------+
 |
 |
 |
 |
 | (delete transaction)               (wait until expiration time)
 +---------------------> DELETED -------------------------------------> REMOVED
```

## Backwards Compatibility

There is no change in existing protobufs, other than adding optional `autorenewAccount` fields to entities that currently lack them. Account and entity owners must ensure that linked auto-renew accounts have sufficient balances for auto-renewal fees, or risk permanent removal of their entity.

Every entity will receive one free auto renewal at implementation of this feature. This will have the effect of extending the initial period for auto-renewal ~92 days. Entities that are already past their expiration time will have it set to ~92 days after the date the feature is first deployed.

## Security Implications

A Hedera Account with zero hbar balance (in itself and its auto-renew account) at the point of renewal would become expired, and be removed after the grace period, if not renewed before then.

A Hedera Account with non-zero hbar balance that is not sufficient to cover the entire cost of renewal will have its remaining balance wholly used for a shorter extension of the entity.

If the `autoRenewAccount` of a topic does not have sufficient balance the topic would be deleted. The ledger cannot enforce agreements regarding funding of the topic made by participants in the topic. 

Any entity can have its expiration time extended by anyone, not just by the owner or admin account. The expiration time is the only field that can be changed in an update without being signed by the owner or the admin. (One exception: scheduled transactions cannot be renewed).

Users who leverage omnibus entities for services including wallets, exchanges, and custody will need to account for the deduction of hbar from any Hedera auto-renewal accounts used in their system at the time of auto-renewal.

Users who hold multiple tokens in their Hedera Account will have their accounts marked as expired if they have zero hbar balance at the time of auto-renewal. If it reaches the end of the grace period without being renewed and without funding to allow it to auto-renew, then all tokens in it will be transferred to their treasury accounts, and the account will be removed. All hbars and tokens must be transferred out of an account before it can be deleted with a delete transaction.

## How to Teach This

This feature has been documented in the initial White Paper and protobuf document.

Implementation of this feature will be referenced in release notes, supported by SDKs, as well as supported at docs.hedera.com.

Key partners operating mirror nodes, wallets, exchanges, etc. should notify users when supporting account or entity creation of both the auto-renew period and anticipated cost for auto-renew.

## Reference Implementation

```
ledger.autoRenewPeriod.maxDuration=8000001 seconds // ~92 days
ledger.autoRenewPeriod.minDuration=6999999 seconds // ~81 days
```

For the most up-to-date pricing, please refer to https://docs.hedera.com/guides/mainnet/fees#transaction-and-query-fees 

Please note that the renewal fees depend on the resources, such as state size for the Hedera Smart Contracts Service, file size for Hedera File Service, number of token associations for the Hedera Token Service and duration into consideration. 

https://github.com/hashgraph/hedera-services/blob/main/docs/autorenew-feature.md#autorenewal-record

https://github.com/hashgraph/hedera-services/blob/main/docs/autorenew-feature.md#entity-removal-record

> **Note: This Entity Auto-Renewal feature has been implemented in Hedera Services via [PR #1376](https://github.com/hashgraph/hedera-services/pull/1376).**

## Rejected Ideas

N/A

## Open Issues

New issues will be created to track implementation in the hedera-services repo: https://github.com/hashgraph/hedera-services/issues

## References

N/A

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
