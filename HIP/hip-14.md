---
hip: 14
title: Token Hold Functionality
author: Fernando Paris <fer@io.builders>, Fernando Paris <@ferparishuertas>
type: Standards Track
category: Service
needs-council-approval: Yes
superseded-by: 24
status: Replaced
created: 2021-03-24
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/59
updated: 2021-11-30
---

## Abstract

This HIP defines a mechanism to put tokens on hold. This guarantees a future transfer and makes the held tokens unavailable for transfer in the meantime. Holds are similar to escrows in that they are firm and lead to final settlement.

## Motivation

A hold has to be used in different scenarios where an immediate transfer between accounts is not possible or has to be guaranteed beforehand:

* A regulated token may not allow a token transfer between accounts without verifying that it follows relevant regulations first. In this case a clearable transfer has to be used. During the clearing process a hold is created to ensure that the transfer is successful after all checks have passed. If the transfer violates any of the regulations, it is cleared and not further processed.

* In certain business situations a payment has to be guaranteed before its services can be used. For example, when checking into a hotel, the hotel will put a hold on the guest’s account to ensure that enough balance is available to pay for the room before handing over the keys.

* On other occasions a payment has to be guaranteed without knowing the exact amount beforehand. To stay with the hotel example, the hotel can put a hold on the guest’s account as a guarantee for any possible extras like room service. When the guest checks out, the hold is partially executed and the remaining amount is released to the guest’s account.

There are many use-cases that can benefit from the possibility of holding tokens, like:

* Allow sent or received amounts over the sendRecordThreshold or receiveRecordThreshold ( Deprecated) to be allowed by receiver or sender, at a given point of time, having enough funds when triggered.

* Auctions, crowdfunding, and group investments (NFT co-investing) to ensure that, once a target amount and auction time has been reached, the amount is available at buyer/investor side.

* Decentralized escrows, payment workflows, contractual linked settlements without having an intermediary or holding entity. This enables, with basic  building blocks at protocol level, a wide range of payment workflows.

## Rationale

The rationale behind this HIP is to address the mentioned use cases, and to promote the extension of the core HBAR and HTS functionality, enabling the _Hold_ functionality. The goals of the _Hold_ HIP are:  

1. Launch a proposal for a new functionality that is real need, can be solved at protocol level, enabling Appnets to create a variety of new business cases.

2. Define a first draft of functional specifications and usage

3. Envision an interaction with core functionalities and HTS service.

4. Define an alignment path between holds and scheduled transaction.

Simple signatures or multi-sig and expiration times bring a very close connection to scheduled transactions. A basic abstraction could be that a hold is a held balance with a linked scheduled transaction.

It's key for the _hold_ that there are no intermediate accounts or counterparty risk. Funds will always stay with the sender or transfered to receiver. For _holds_, we must distinguish between totalBalance and available balance.

* totalbalance = available + held balance
* available = fully unrestricted usage
* held = linked to a pending execution (use case trigger)

## Specification

A draft specification could be:

### Actors

#### Hold Operator
An account which has been approved by an account to create holds on its behalf.

#### Hold issuer
The account(s) (multiple source payments), that creates a hold. This can be the account owner itself, or any account, which has been approved as an operator for the account.

#### Trigger signature
The account, key list, or threshold key which decides if a hold should be executed or released.

#### Hold receiver
The account(s) (multiple destination payments), that receives a held amount.

### Functions

#### hold

Creates a hold on behalf of the account(s) in favor of the payee. It specifies a trigger signature that is responsible to either execute or release the hold. The function must revert if the operation ID has been used before. If `holdOperator` is another account, it needs to be allowed to issue holds on its behalf by calling `approveToHold`.

| Parameter | Description |
| ---------|-------------|
| operationId | The unique ID to identify the hold |
| to | The address of the payee, to whom the tokens are to be transferred if executed |
| triggerSig | The account(s) of the triggerSig who is going to determine whether the hold is to be executed or released |
| value | The amount to be transferred. Must be less or equal than the balance of the payer. |
| timeToExpiration | The duration until the hold is expired. If it is '0' the hold must be perpetual.  |

#### releaseHold

Releases a hold. Release means that the transfer is not executed and the held amount is available again for the payer. Until a hold has expired it can only be released by the triggerSig or the payee. After it has expired it can be released by anyone.

| Parameter | Description |
| ---------|-------------|
| operationId | The unique ID to identify the hold |

#### executeHold

Executes a hold. Execute means that the specified value is transferred from the payer to the payee. If the specified value is less than the hold value the remaining amount is available again to the payer. The implementation must verify that only the triggerSig is able to successfully call the function.

| Parameter | Description |
| ---------|-------------|
| operationId | The unique ID to identify the hold |
| value | The amount to be transferred. This amount has to be less or equal than the hold value |

#### renewHold

Renews a hold. The new expiration time must be the consensus timestamp plus the given `timeToExpiration`. A hold may be made perpetual by setting the `timeToExpiration` to '0'. The implementation must verify that only the payer or operator are able to successfully call the function. Only a hold that has not yet expired can be successfully renewed.

| Parameter | Description |
| ---------|-------------|
| operationId | The unique ID to identify the hold |
| timeToExpiration | The new duration until the hold is expired |

#### retrieveHoldData

Retrieves all the information available for a particular hold.

| Parameter | Description |
| ---------|-------------|
| operationId | The unique ID to identify the hold |

#### balanceOnHold

Retrieves how much of the balance is currently held and therefore not available for transfer.

| Parameter | Description |
| ---------|-------------|
| account | The address which held balance should be returned |

#### netBalanceOf

Retrieves the net balance, which is the sum of `balanceOf` and `balanceOnHold`.

| Parameter | Description |
| ---------|-------------|
| account | The address which net balance should be returned |

#### totalSupplyOnHold (HTS)

Retrieves the total sum of how many tokens are on hold.

| Parameter | Description |
| ---------|-------------|
| - | - |

#### authorizeHoldOperator

Approves an operator to issue holds on behalf of msg.sender.

| Parameter | Description |
| ---------|-------------|
| operator | The address to be approved as operator of holds |

#### revokeHoldOperator

Revokes the approval to issue holds on behalf of msg.sender.

| Parameter | Description |
| ---------|-------------|
| operator | The address to be revoked as operator of holds |

#### isHoldOperatorFor

Retrieves if an operator is approved to create holds on behalf of `from`.

| Parameter | Description |
| ---------|-------------|
| operator | The address to be a operator of holds |
| from | The address on which the holds would be created |

#### balanceOf

The standard implementation has to be changed in order to deduct the held balance from the global balance.

#### transfer

The standard implementation has to be changed in order to deduct the held balance from the global balance. Any amount that is held must not be transferred.

### Events

Possible events/notifications to be triggered, or gathered from mirror nodes.

#### HoldCreated

Emitted when a hold has been created.

| Parameter | Description |
| ---------|-------------|
| holdIssuer | The address of the hold issuer of the hold |
| operationId | The unique ID to identify the hold |
| from | The address of the payer, from whom the tokens are to be taken if executed |
| to | The address of the payee, to whom the tokens are to be paid if executed |
| triggerSig | The address of the triggerSig who is going to determine whether the hold is to be executed or released |
| value | The amount to be transferred. Must be less or equal than the balance of the payer. |
| expiration | The unix timestamp when the hold is expired |

#### HoldExecuted

Emitted when a hold has been executed.

| Parameter | Description |
| ---------|-------------|
| holdIssuer | The address of the hold issuer of the hold |
| operationId | The unique ID to identify the hold |
| triggerSig | The address of the triggerSig who executed the hold |
| heldValue | The amount which was put on hold during creation |
| transferredValue | The amount which was used for the transfer |

#### HoldReleased

Emitted when a hold has been released.

| Parameter | Description |
| ---------|-------------|
| holdIssuer | The address of the hold issuer of the hold |
| operationId | The unique ID to identify the hold |
| status | Can be one of the following values: `ReleasedByTriggerSig`, `ReleasedByPayee`, `ReleasedOnExpiration` |

#### HoldRenewed

Emitted when a hold has been renewed.

| Parameter | Description |
| ---------|-------------|
| holdIssuer | The address of the hold issuer of the hold |
| operationId | The unique ID to identify the hold |
| oldExpiration | The expiration time before the renewal |
| newExpiration | The expiration time after the renewal |

#### AuthorizedHoldOperator

Emitted when an operator has been approved to create holds on behalf of another account.

| Parameter | Description |
| ---------|-------------|
| operator | The address to be a operator of holds |
| account | Address on which behalf holds will potentially be created |

#### RevokedHoldOperator

Emitted when an operator has been revoked from creating holds on behalf of another account.

| Parameter | Description |
| ---------|-------------|
| operator | The address to be a operator of holds |
| account | Address on which behalf holds could potentially be created |

## Backwards Compatibility
N/A
## Security Implications
N/A

## How to Teach This
N/A

## Reference Implementation
N/A

## Rejected Ideas
N/A

## Open Issues
N/A

## References
N/A

## Copyright/license
This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
