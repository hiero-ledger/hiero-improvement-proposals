---
hip: 33
title: Add Network ID Field to Info Responses
author: Simi Hunjan <simi@hedera.com>, David Matusevich <davidmatusevich@swirlds.com>, Leemon Baird <leemon@hedera.com>, Mark Williamson <mark.williamson@hedera.com>, Alex Popowycz <a@hedera.com>
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
last-call-date-time: 2021-11-30T07:00:00Z
release: v0.22.0
created: 2021-10-19
updated: 2022-04-26
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/159
---

## **Abstract**

Proposal to add a network ID field to info responses for all entities.


## **Motivation**

In the Hedera Transaction Tool application, users will have the ability to request account infos for accounts on previewnet, testnet, mainnet or a custom network. 
You can then take the response, write it to a file, and distribute that file for others to update that account's information.
Since you can request account infos from multiple different networks you can't tell which network the response came from the file the response is stored in unless the user who requested it forwards that information to the other users. This is true for all entity info responses from the network.

## **Rationale**

To solve this issue, we think it would make sense for all enitity info responses to include a `ledger_id` field. Please reference [HIP-198](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-198.md) for the latest information regarding ledger IDs.

## **User Stories**
As a developer I want to know which network the entity info response came from when the response information is written to a file that is then shared with other users of the application.

## **Specification**

HAPI Changes

**Accounts**

```diff
      message AccountInfo {
        /**
         * The account ID for which this information applies
         */
        AccountID accountID = 1;

        /**
         * The Contract Account ID comprising of both the contract instance and the cryptocurrency
         * account owned by the contract instance, in the format used by Solidity
         */
        string contractAccountID = 2;

        /**
         * If true, then this account has been deleted, it will disappear when it expires, and all
         * transactions for it will fail except the transaction to extend its expiration date
         */
        bool deleted = 3;

        /**
         * The Account ID of the account to which this is proxy staked. If proxyAccountID is null,
         * or is an invalid account, or is an account that isn't a node, then this account is
         * automatically proxy staked to a node chosen by the network, but without earning payments.
         * If the proxyAccountID account refuses to accept proxy staking , or if it is not currently
         * running a node, then it will behave as if proxyAccountID was null.
         */
        AccountID proxyAccountID = 4;

        /**
         * The total number of tinybars proxy staked to this account
         */
        int64 proxyReceived = 6;

        /**
         * The key for the account, which must sign in order to transfer out, or to modify the
         * account in any way other than extending its expiration date.
         */
        Key key = 7;

        /**
         * The current balance of account in tinybars
         */
        uint64 balance = 8;

        /**
         * [Deprecated]. The threshold amount, in tinybars, at which a record is created of any
         * transaction that decreases the balance of this account by more than the threshold
         */
        uint64 generateSendRecordThreshold = 9 [deprecated=true];

        /**
         * [Deprecated]. The threshold amount, in tinybars, at which a record is created of any
         * transaction that increases the balance of this account by more than the threshold
         */
        uint64 generateReceiveRecordThreshold = 10 [deprecated=true];

        /**
         * If true, no transaction can transfer to this account unless signed by this account's key
         */
        bool receiverSigRequired = 11;

        /**
         * The TimeStamp time at which this account is set to expire
         */
        Timestamp expirationTime = 12;

        /**
         * The duration for expiration time will extend every this many seconds. If there are
         * insufficient funds, then it extends as long as possible. If it is empty when it expires,
         * then it is deleted.
         */
        Duration autoRenewPeriod = 13;

        /**
         * All of the livehashes attached to the account (each of which is a hash along with the
         * keys that authorized it and can delete it)
         */
        repeated LiveHash liveHashes = 14;

        /**
         * All tokens related to this account
         */
        repeated TokenRelationship tokenRelationships = 15;

        /**
         * The memo associated with the account
         */
        string memo = 16;

        /**
         * The number of NFTs owned by this account
         */
        int64 ownedNfts = 17;

        /**
         * The maximum number of tokens that an Account can be implicitly associated with.
         */
        int32 max_automatic_token_associations = 18;
        
+       /**
+        * The ledger ID the response was returned from. Please reference HIP-198 for the ledger ID used for each network.
+        */
+       bytes ledger_id = 19;

    }
```
**Tokens**

```diff
message TokenInfo {
    /**
     * ID of the token instance
     */
    TokenID tokenId = 1;

    /**
     * The name of the token. It is a string of ASCII only characters
     */
    string name = 2;

    /**
     * The symbol of the token. It is a UTF-8 capitalized alphabetical string
     */
    string symbol = 3;

    /**
     * The number of decimal places a token is divisible by. Always 0 for tokens of type
     * NON_FUNGIBLE_UNIQUE
     */
    uint32 decimals = 4;

    /**
     * For tokens of type FUNGIBLE_COMMON - the total supply of tokens that are currently in
     * circulation. For tokens of type NON_FUNGIBLE_UNIQUE - the number of NFTs created of this
     * token instance
     */
    uint64 totalSupply = 5;

    /**
     * The ID of the account which is set as Treasury
     */
    AccountID treasury = 6;

    /**
     * The key which can perform update/delete operations on the token. If empty, the token can be
     * perceived as immutable (not being able to be updated/deleted)
     */
    Key adminKey = 7;

    /**
     * The key which can grant or revoke KYC of an account for the token's transactions. If empty,
     * KYC is not required, and KYC grant or revoke operations are not possible.
     */
    Key kycKey = 8;

    /**
     * The key which can freeze or unfreeze an account for token transactions. If empty, freezing is
     * not possible
     */
    Key freezeKey = 9;

    /**
     * The key which can wipe token balance of an account. If empty, wipe is not possible
     */
    Key wipeKey = 10;

    /**
     * The key which can change the supply of a token. The key is used to sign Token Mint/Burn
     * operations
     */
    Key supplyKey = 11;

    /**
     * The default Freeze status (not applicable, frozen or unfrozen) of Hedera accounts relative to
     * this token. FreezeNotApplicable is returned if Token Freeze Key is empty. Frozen is returned
     * if Token Freeze Key is set and defaultFreeze is set to true. Unfrozen is returned if Token
     * Freeze Key is set and defaultFreeze is set to false
     */
    TokenFreezeStatus defaultFreezeStatus = 12;

    /**
     * The default KYC status (KycNotApplicable or Revoked) of Hedera accounts relative to this
     * token. KycNotApplicable is returned if KYC key is not set, otherwise Revoked
     */
    TokenKycStatus defaultKycStatus = 13;

    /**
     * Specifies whether the token was deleted or not
     */
    bool deleted = 14;

    /**
     * An account which will be automatically charged to renew the token's expiration, at
     * autoRenewPeriod interval
     */
    AccountID autoRenewAccount = 15;

    /**
     * The interval at which the auto-renew account will be charged to extend the token's expiry
     */
    Duration autoRenewPeriod = 16;

    /**
     * The epoch second at which the token will expire
     */
    Timestamp expiry = 17;

    /**
     * The memo associated with the token
     */
    string memo = 18;

    /**
     * The token type
     */
    TokenType tokenType = 19;

    /**
     * The token supply type
     */
    TokenSupplyType supplyType = 20;

    /**
     * For tokens of type FUNGIBLE_COMMON - The Maximum number of fungible tokens that can be in
     * circulation. For tokens of type NON_FUNGIBLE_UNIQUE - the maximum number of NFTs (serial
     * numbers) that can be in circulation
     */
    int64 maxSupply = 21;

    /**
     * The key which can change the custom fee schedule of the token; if not set, the fee schedule
     * is immutable
     */
    Key fee_schedule_key = 22;

    /**
     * The custom fees to be assessed during a CryptoTransfer that transfers units of this token
     */
    repeated CustomFee custom_fees = 23;
    
+   /**
+    * The ledger ID the response was returned from. Please reference HIP-198 for the ledger ID used for each network.
+    */
+   bytes ledger_id = 24;
    
    
}
```

**Topics**

```diff

message ConsensusTopicInfo {

    /**
     * The memo associated with the topic (UTF-8 encoding max 100 bytes)
     */
    string memo = 1;


    /**
     * When a topic is created, its running hash is initialized to 48 bytes of binary zeros.
     * For each submitted message, the topic's running hash is then updated to the output
     * of a particular SHA-384 digest whose input data include the previous running hash.
     * 
     * See the TransactionReceipt.proto documentation for an exact description of the
     * data included in the SHA-384 digest used for the update.
     */
    bytes runningHash = 2;

    /**
     * Sequence number (starting at 1 for the first submitMessage) of messages on the topic.
     */
    uint64 sequenceNumber = 3;

    /**
     * Effective consensus timestamp at (and after) which submitMessage calls will no longer succeed on the topic
     * and the topic will expire and after AUTORENEW_GRACE_PERIOD be automatically deleted.
     */
    Timestamp expirationTime = 4;

    /**
     * Access control for update/delete of the topic. Null if there is no key.
     */
    Key adminKey = 5;

    /**
     * Access control for ConsensusService.submitMessage. Null if there is no key.
     */
    Key submitKey = 6;

    /**
     * If an auto-renew account is specified, when the topic expires, its lifetime will be extended
     * by up to this duration (depending on the solvency of the auto-renew account). If the
     * auto-renew account has no funds at all, the topic will be deleted instead.
     */
    Duration autoRenewPeriod = 7;

    /**
     * The account, if any, to charge for automatic renewal of the topic's lifetime upon expiry.
     */
    AccountID autoRenewAccount = 8;
    
+  /**
+   * The ledger ID the response was returned from. Please reference HIP-198 for the ledger ID used for each network.
+   */
+  bytes ledger_id = 9;

}
```

**Files**

```diff
message FileInfo {
        /**
         * The file ID of the file for which information is requested
         */
        FileID fileID = 1;

        /**
         * Number of bytes in contents
         */
        int64 size = 2;

        /**
         * The current time at which this account is set to expire
         */
        Timestamp expirationTime = 3;

        /**
         * True if deleted but not yet expired
         */
        bool deleted = 4;

        /**
         * One of these keys must sign in order to modify or delete the file
         */
        KeyList keys = 5;

        /**
         * The memo associated with the file
         */
        string memo = 6;
        
+      /**
+        * The ledger ID the response was returned from. Please reference HIP-198 for the ledger ID used for each network.
+        */
+      bytes ledger_id = 7;
    }
```
**Smart Contracts**

```diff
message ContractInfo {
        /**
         * ID of the contract instance, in the format used in transactions
         */
        ContractID contractID = 1;

        /**
         * ID of the cryptocurrency account owned by the contract instance, in the format used in
         * transactions
         */
        AccountID accountID = 2;

        /**
         * ID of both the contract instance and the cryptocurrency account owned by the contract
         * instance, in the format used by Solidity
         */
        string contractAccountID = 3;

        /**
         * the state of the instance and its fields can be modified arbitrarily if this key signs a
         * transaction to modify it. If this is null, then such modifications are not possible, and
         * there is no administrator that can override the normal operation of this smart contract
         * instance. Note that if it is created with no admin keys, then there is no administrator
         * to authorize changing the admin keys, so there can never be any admin keys for that
         * instance.
         */
        Key adminKey = 4;

        /**
         * the current time at which this contract instance (and its account) is set to expire
         */
        Timestamp expirationTime = 5;

        /**
         * the expiration time will extend every this many seconds. If there are insufficient funds,
         * then it extends as long as possible. If the account is empty when it expires, then it is
         * deleted.
         */
        Duration autoRenewPeriod = 6;

        /**
         * number of bytes of storage being used by this instance (which affects the cost to extend
         * the expiration time)
         */
        int64 storage = 7;

        /**
         * the memo associated with the contract (max 100 bytes)
         */
        string memo = 8;

        /**
         * The current balance, in tinybars
         */
        uint64 balance = 9;

        /**
         * Whether the contract has been deleted
         */
        bool deleted = 10;

        /**
         * The tokens associated to the contract
         */
        repeated TokenRelationship tokenRelationships = 11;
        
+      /**
+       * The ledger ID the response was returned from. Please reference HIP-198 for the ledger ID used for each network.
+       */
+      bytes ledger_id = 12;
    }
```

**Schedule**

```diff

message ScheduleInfo {  
  /**
   * The id of the schedule
   */
  ScheduleID scheduleID = 1;

  oneof data {
    /**
     * If the schedule has been deleted, the consensus time when this occurred
     */
    Timestamp deletion_time = 2;

    /**
     * If the schedule has been executed, the consensus time when this occurred
     */
    Timestamp execution_time = 3;
  }

  /**
   * The time at which the schedule will expire
   */
  Timestamp expirationTime = 4;

  /**
   * The scheduled transaction
   */
  SchedulableTransactionBody scheduledTransactionBody = 5;

  /**
   * The publicly visible memo of the schedule
   */
  string memo = 6;

  /**
   * The key used to delete the schedule from state
   */
  Key adminKey = 7;

  /**
   * The Ed25519 keys the network deems to have signed the scheduled transaction
   */
  KeyList signers = 8;

  /**
   * The id of the account that created the schedule
   */
  AccountID creatorAccountID = 9;

  /**
   * The id of the account responsible for the service fee of the scheduled transaction
   */
  AccountID payerAccountID = 10;

  /**
   * The transaction id that will be used in the record of the scheduled transaction (if it
   * executes)
   */
  TransactionID scheduledTransactionID = 11;
  
+ /**
+  * The ledger ID the response was returned from. Please reference HIP-198 for the ledger ID used for each network.
+  */
+ bytes ledger_id = 12;
}  
```



## **Backwards Compatibility**

This change should be backwards compatible as it returns an extra field in a response, but does not modify an existing field.


## **Security Implications**

N/A

## **How to Teach This**

- Updated to the hedera-protobufs repository 
- Hedera docs update
- Reviewed in Engineering Insights

## **Reference Implementation**
N/A


## **Rejected Ideas**

N/A

## **Open Issues**
- What happens in the event a user requests an info response from a custom network where the ledger ID is not one of 00, 01, or 02?


## **References**
- https://github.com/hashgraph/hedera-protobufs/blob/main/services/crypto_get_info.proto
- https://github.com/hashgraph/hedera-protobufs/blob/main/services/consensus_topic_info.proto
- https://github.com/hashgraph/hedera-protobufs/blob/main/services/file_get_info.proto
- https://github.com/hashgraph/hedera-protobufs/blob/main/services/schedule_get_info.proto
- https://github.com/hashgraph/hedera-protobufs/blob/main/services/token_get_info.proto

## **Copyright/license**

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](https://github.com/hiero-ledger/hiero-improvement-proposals/LICENSE) or ([https://www.apache.org/licenses/LICENSE-2.0](https://www.apache.org/licenses/LICENSE-2.0))
