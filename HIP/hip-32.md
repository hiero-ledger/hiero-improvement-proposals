---
hip: 32
title: Auto Account Creation
author: Leemon Baird <leemon@hedera.com>
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/187
last-call-date-time: 2021-12-03T07:00:00Z
release: v0.21.0
created: 2021-11-01
updated: 2024-07-24
requires: 15
---

## Abstract

This hip introduces a new way to create accounts on Hedera using a public key.
  
## Motivation
If a user has an account on Hedera, it is easy to create new accounts, paying for the new accounts from the old one. But if a user has no account, then it is inconvenient to create a new account, because they need the help of someone else to pay for the creation of the account. 

## Rationale

A possible solution would have been to make all account creation free, but this would encourage denial of service attacks that over-use the free service. So this is not ideal.

A better solution is to allow users to create "accounts" for free that are not actually accounts on Hedera that use resources, but that convert into Hedera accounts in a way that is automatic and invisible to the user.

The Hedera API (HAPI) can be modified very slightly, so that HBAR transfers can continue to send to account IDs (such as 0.0.123), but can optionally send to an account identified only by a long-form of account ID, which is actually its initial public key. When such an account doesn't yet exist, then it will be automatically created, with the fee being subtracted from the HBAR amount being transferred.

### Wallets
  
Wallet software can allow the user to create an "account" instantly, for free, even without an internet connection. In this case, it will not create an actual account on Hedera. Instead, it will simply create a public/private key pair for the user. The software will then display this as an "account" with a zero balance, with a "long account ID". This long form doesn't look like `0.0.123`, but instead is an alias consisting of `<shard>.<realm>.<bytes>`, where the `bytes` is a [base32url](https://datatracker.ietf.org/doc/html/rfc4648#section-6) representation of the bytes of a serialized HAPI primitive `Key`, with the trailing `=` padding characters removed.  For example, `0.0.CIQNOWUYAGBLCCVX2VF75U6JMQDTUDXBOLZ5VJRDEWXQEGTI64DVCGQ` is the alias address of shard 0 realm 0 with a serialization of a HAPI `Key` for the ed25519 public key `0xd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a`. So a long-form account ID will always match the following regex:

`\d+\.\d+\.[2-7A-Z]+`

The user can then buy HBAR on an exchange, or receive HBAR sent from a friend, or receive HBAR paid by a customer. In all those cases, they will tell the other party that their "account ID" is that long-form account ID. And the transfer will actually create an actual Hedera account, deducting the creation fee from the amount transferred.

The wallet software can then query a mainnet node (or a mirror node) for info about their "account" using the long form of the account ID, and the reply will indicate whether it exists, what its actual account ID in short format is, and what its current balance is. At that point, the wallet can start displaying the short-format account ID rather than the long format. The long form will continue to work as an alias. 

That alias will continue to be associated with that account for as long as it exists. If the account is deleted and removed from Hedera, then the alias can be associated with a new account.

## User stories

As a wallet provider, I would like to create free Hedera accounts for users.
 
## Specification
  
### Implementation for Hedera

HAPI will need to be updated so that the account ID can support aliases. It currently has 3 components (`shard`, `realm`, `account`), where the third component is an integer. The modification will allow the third component to be a `oneof` either an integer or an `alias`. The `alias` is a byte array (protobuf `bytes`) that is formed by serializing a protobuf `Key` that represents a primitive public key (not a threshold key or key list, etc.).

Each account in memory will need to store an additional field for the `alias`. This is a single public key. It is the one that was used to create the account, if it was automatically created.  It will be set to null if that account was created normally.  An account update can change this from null to a valid alias, but only if the update is signed by the private key corresponding to the public key in that alias.  Only one account can exist with a given alias, so updates will fail if they try to give another account the same alias.

An automatically-created account will be created with only one public key (the one that is in its long-form account ID). It will have "received signature required" turned off. It will be created with whatever is the default expiration time at the time it is created (currently about 3 months). Its initial balance will be the amount transferred, minus the creation fee. If the amount is insufficient to pay the fee, then the transaction fails, and nothing is created.

At most one account can ever have a given alias. If a transaction auto-creates the account, any further transfers to that alias will simply be deposited in that account, without creating anything, and with no creation fee being charged.

An account created normally has no alias. ~~It can be given an alias with an account update, but only if that alias is not currently used by any other account, and only if the update transaction is signed by the private key corresponding to the public key in the alias.~~
* **UPDATE:** This intent has been revisited and retracted by [HIP-583](https://hips.hedera.com/hip/hip-583#update-account-with-alias),
which provides other ways to set the alias.

Once an account has an alias, the alias can never be changed, and can never be associated with any other account until the first account is deleted and removed from the ledger. Only then could another account be created or updated to be associated with that alias.

Hedera Services will then need to store a map from alias to the created account. This can be a rebuilt data structure, that is regenerated each time a new state is loaded from disk. It is only populated with (alias,account) pairs for existing accounts that have aliases.  

When an account expires, it is frozen for a period of time, then eventually deleted. At the moment it is deleted, its alias (if any) is removed from the map. It could then be used again for a new account, by auto-creation or by account update.

The `getAccountInfo` query will return all the standard information, including the short account ID, and the alias, if there is one.

The receipt and record for a transaction should also be updated as appropriate.

### Implementation for mirror nodes

Mirror nodes will need to record the new information, and allow queries by long-form account number, in addition to the current short-form queries.

### Implementation for wallet software

The wallet software will need to support the workflow described in the summary. It should allow the creation of an "account" for free, that is purely local. For that account, it would display the long form of the account ID, and show it as having zero balance. If it ever checks the account balance and discovers that the account now exists on the ledger, it will get the short form of the account ID, and display that.

From the user's point of view, these virtual "accounts" should be indistinguishable from normal accounts, other than the fact that their "account ID" is in a long format. And that eventually, they also have a short-format account ID.

## Backwards Compatibility
* This is backwards compatible
* Existing accounts have no alias, and cannot be accessed by an alias
* New accounts that are auto-created will have an alias, and can be queried and transferred to using that alias.
* Checksums from [HIP-15](https://hips.hedera.com/hip/hip-15) apply to long-form IDs unchanged, except that capital letters are allowed, and are represented by their ASCII value in the `d[]` array.
  
## Security Implications

## How to Teach This

* Generate a key pair offline, send hbar to the long-form account ID, and see that the account is successfully created

## Reference Implementation

## Rejected Ideas

## Open Issues

## References

* [HIP-583](https://hips.hedera.com/hip/hip-583) - "Expand alias support in CryptoCreate & CryptoTransfer Transactions"

## Copyright/license
This document is licensed under the Apache License, Version 2.0 -- see LICENSE or (https://www.apache.org/licenses/LICENSE-2.0)
