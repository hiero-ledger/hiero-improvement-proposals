---
hip: 23
title: Make the need for token association opt-in
author: Gerbert Vandenberghe (@gerbert-vandenberghe)
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
release: v0.19.0
created: 2021-06-22
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/107
updated: 2023-02-01
---

**Abstract**

The need to associate a Hedera account with a certain token in order to be able to receive this token on the account poses usability issues and makes some business flows that are common practice in the blockchain and NFT space impossible.
The proposal is to provide an ability for Hedera accounts to pre-approve a number of token association slots that can be used for any tokens without the need to explicitly associate.

**Motivation**

The need for token associations makes the user flow much more complex as every time the user wants to be able to receive a certain token he has to explicitly allow the account to receive this token. Since every NFT is a different token, the user should associate their account with each NFT he wants to receive.
We want to build applications that everyone can use, without the need to know anything about blockchain or cryptocurrencies. Users have to be able to log in on e.g. games with their web wallet using social logins, where in the background a web wallet for them is created and linked to the games they play. While playing the game they can earn NFTs and should be able to receive them in their wallet, without having to go to their wallet and find a way to associate the wallet with these game tokens.
When these users log in with their web wallet on a store to buy fantokens or other NFTs, they should be able to immediately receive these tokens in their wallet, without complicating the user flow.
We build apps on Hedera for the masses and not for people that are knowledgeable on blockchain and crypto and to be able to do so we have to remove t
need for token associations.
****

**Rationale**

The token association is an advanced feature for users who are well aware of blockchain and cryptocurrency. For this, we would make the need for token association an opt-in instead of an opt-out.
****

**Background on why the explicit token association is required:**

Here are the reasons why the explicit token association is required (as articulated by Cooper Kuntz):

1. DDoS risk on the network (a botnet can flood the network with incredibly cheap airdrops)
2. Memory bloat risk on the network (fear that a large number of useless tokens will be created & distributed)
3. Spam risk on accounts (attackers could fill public accounts with tokens rendering apps/their accounts wasted)
4. Reputational risk (see Vitalik not wanting to hold billions of [$SHIB](https://www.coindesk.com/vitalik-buterin-burns-6b-in-shib-tokens-says-he-doesnt-want-the-power))
5. Tax burden risk (unclear regulatory environment on airdrop management)

Above all, really, storage of the token associations uses up RAM on the mainnet nodes, and therefore there is a real cost for storing the token associations that needs to be paid by the account holder (or, in the future, by someone else). That requires the user to say which and how many tokens they want their accounts to be associated with.

**Specification**

Here is how the feature will work:

1. Define a new configurable setting on the account, called `numberOfAutomaticAssociations`. This attribute defines the number of token slots that the account holder wants to allow for automatic or implicit associations.
2. During `cryptoTransfers` of tokens, if the receiving account is not associated with the given token, and if the number of automatic associations used by this account (this needs to be another variable in the account, something like `automaticAssociationsCount`) is less than `numberOfAutomaticAssociations`, then that token transfer is allowed, and the `automaticAssociationsCount` is incremented. Otherwise, the transfer will fail with an appropriate error code.
3. Update: It should be possible to update the value of `numberOfAutomaticAssociations` using an `updateAccount` transaction. For example, if a user has initially requested 100 automatic association slots and has used them, they can request for additional 100 automatic association slots.
4. In any case, the total number of associations (automatic + explicit) will still remain under the current limit of 1000 associations/account.
5. Mirror nodes will have to show these attributes - the `numberOfAutomaticAssociations` and `automaticAssociationsCount`.
6. `AccountCreate`, `accountUpdate`, and `accountRenewal` calls will charge more to account for the additional memory used for automatic associations.

Corner cases:

1. If the user receives a token through automatic association that they don't want to hold for reasons such as reputational risk or tax burdens, then they can manually dissociate that token. However, please note that this will not prevent somebody else from sending that token back to the user. This feature does not envisage a concept of a blacklist of tokens that the account holder doesn't want to be associated with. Implementing such a list will be as memory-intensive as the token association itself.

**Backward compatibility**

1. The default value of this `numberOfAutomaticAssociations` attribute will be `0`. This means that the user needs to explicitly associate every token. This is compatible with how the system works today.
2. For the existing accounts, this `numberOfAutomaticAssociations` attribute will be set to `0` during migration.

**User stories**

1. As a wallet developer (or a game developer), who wants to create a Hedera account on behalf of a user, I want to specify the number of tokens that the account will automatically associate with so that I can subsequently transfer tokens to that account without any explicit action from the user. I understand that I will have to pay for the additional memory usage, and there is no guarantee that somebody else won't send a flood of bogus transactions to use up that memory.
    1. I should be able to do the same as an account holder for my account.
2. As a wallet developer (or a game developer), if/when a user's account runs out of automatic association slots in their account, I can increase the number of associations up to a system-configured max limit on a number of total associations.
    1. In addition, I can also decrease the number of associations, and that call will succeed if the new (decreased) number that I have specified is greater than or equal to the current number of automatic associations that I have already used.
    2. I should be able to do the same as an account-holder for my account.
3. As a wallet developer (or a game developer) or as an individual account holder, if I don't like a token to be associated with my account, I should be able to transfer that token out and dissociate that automatically created token association. I understand that even if I do that, there is no guarantee that somebody else won't send me that same token and re-associate it with my account if there is an available slot in the automatic token associations.
4. As a wallet developer, I want to query the mirror nodes to find which tokens an account is associated with, how many more tokens can this account be automatically associated with, etc.
    1. I should be able to do the same as an account holder or just a curious bystander (I just want to know which NFTs does a given account hold)

**Security Implications**

Hedera mainnet: For the network, there is additional memory usage per account. However, the user will pay for the additional memory and therefore there is no additional security risk to the network.

Account holders: The account holder could have potentially adverse consequences for enabling automatic associations as articulated above (reputation risk, tax burden, etc.). Since the proposed default value of `numberOfAutomaticAssociations` is `0`, the user will only undertake this risk if they choose to modify this attribute.

**Reference Implementation**

**Rejected Ideas**

**Open Issues**

**References**

**Copyright/license**

This document is licensed under the Apache License, Version 2.0 -- see LICENSE or ([https://www.apache.org/licenses/LICENSE-2.0](https://www.apache.org/licenses/LICENSE-2.0))

