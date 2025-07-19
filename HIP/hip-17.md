---
hip: 17
title: Non-Fungible Tokens
author: Daniel Ivanov (@Daniel-K-Ivanov)
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
release: v0.17.2
created: 2021-04-22
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/74
updated: 2023-02-01
---

## Abstract

This HIP defines the changes that must be applied in order for the Hedera Token Service to support non-fungible tokens.

## Motivation

The growing demand and use-cases for tokenization point out that the current HTS design does not support all the needs of the community. In this HIP we would like to describe a set of changes that would enable non-fungible types of tokens to be issued natively on Hedera Hashgraph. Having support for such tokens will allow an extended range of applications to be built on top of HTS.

## Rationale

The following proposal is building on top of the current HTS API instead of creating a brand-new service. There are 2 major reasons for that:
- Developers desire the tokenization APIs to look similar for both fungible and non-fungible tokens
- Though fungible and non-fungible tokens are different, there are a lot of commonalities - admin keys, KYC, supply, mint and burn behaviours

## Specification

Based on the [IWA specification](https://github.com/InterWorkAlliance/TokenTaxonomyFramework) we can define the following subset of token combinations:

```
 HTS
│
└─── Fungible Common     ---> Currently supported by HTS
└─── Fungible Unique     ---> Currently not addressed in this Proposal  
└─── Non-Fungible Common ---> Currently not addressed in this Proposal            
└─── Non-Fungible Unique ---> Addressed in this proposal
```

### Fungible Common

Tokens that have interchangeable value with one another, where any quantity of them has the same value as another equal quantity if they are in the same class or series.
Common tokens share a single set of properties, are not distinct from one another, and their only representation is via a balance or quantity,
attributed to an owner (Hedera Account).

#### Fractional
Describes a token that can be divided into smaller fractions, represented as decimals. The current version of HTS supports these types of tokens. They can be implicitly defined and created by setting `decimals != 0`.

#### Whole
Describes a token that cannot be divided into smaller fractions. Meaning subdivision is not allowed - just whole number quantities. The current version of HTS supports these types of tokens. They can be implicitly defined and created by setting `decimals=0`.

### Non-fungible Unique
The NFT type is not interchangeable with other tokens of the same type as they typically have different values.
Unique tokens have their own identities and can be individually traced. Each unique token can carry unique properties that cannot be changed in one place.

#### Whole
Each instance of a token in the class can share some property values with other tokens in the class and have distinctly unique values between them. They cannot be divided into smaller fractions, represented as decimals. Whole NFTs can be created by defining the `tokenType` as `NON_FUNGIBLE_UNIQUE` and executing `Mint` operation on the Token.

#### Fractional
Similar to `Whole`, in terms that each instance of a token in the class can share some property values with other tokens in the class and have distinctly unique values between them, but unlike `Whole`, they CAN be divided into smaller fractions.
The proposed specification does not support Fractional NFTs natively. They can be supported using the [Hybrid](#Hybrid-Tokens) approach.

#### Singleton
There can only be one instance in the deployed token class and that instance is indivisible. Useful when there is an asset or object to be tokenized that shares no properties or values with any other object. Singleton NFTs can be created by defining the `tokenType` as `NON_FUNGIBLE_UNIQUE`, setting `maxSupply=1` and executing `Mint` operation on the token.

### Hybrid Tokens

TODO

### Explicit vs Implicit definition
There are 2 approaches available when it comes to the HTS API and the configuration of the Token. 
1. **Explicit**

	The [IWA specification](https://github.com/InterWorkAlliance/TokenTaxonomyFramework)  uses an explicit approach when it comes to defining the different types of tokens. This can be seen by the `Token Type (Fungible/Non-Fungible)`, `Token Unit(Fractional, Whole or Singleton)`, `Value Type(Intrinsic or Reference)`, `Representation Type(Common or Unique)` or `Supply(Fixed, Capped-Variable, Gated or Infinite)` categories.
2. **Implicit**

	It is fair to say that some described properties above are not necessary to be explicitly defined, f.e instead for HAPI to request a separate `enum` for `WHOLE/FRACTIONAL` to be set, it can implicitly derive the types of the token based on the `decimals` property that is passed.

The proposed solution uses a hybrid approach, meaning that only the required properties categorising the Tokens are added as one enum (a mixture of `TokenType` and `TokenRepresentationType`), and the rest of the configuration is derived implicitly from the provided variables (deriving `Fractional/Whole` from `decimals`)

The following matrix provides information on the mapping between token types/properties and the corresponding configuration:

**Fungible Common Token Matrix**

|                     	| Fractional, Fixed             	| Fractional, Capped-Variable              	| Fractional, Infinite                     	| Whole, Fixed                  	| Whole, Capped-Variable                   	| Whole, Infinite                          	|
|---------------------	|-------------------------------	|------------------------------------------	|------------------------------------------	|-------------------------------	|------------------------------------------	|------------------------------------------	|
| **decimals**            	| decimals != 0                 	| decimals != 0                            	| decimals != 0                            	| 0                  	| 0                             	| 0                             	|
| **maxSupply**           	| N                   	| N                              	| INT64_MAX_VALUE               	| N                   	| N                              	| INT64_MAX_VALUE               	|
| **initialSupply**       	| N               	| x, where x <= N 	| x, where x <= N 	| N               	| x, where x <= N 	| x, where x <= N 	|
| **supplyKey & wipeKey** 	| supplyKey=null & wipeKey=null 	| supplyKey=* & wipeKey=*                  	| supplyKey=* & wipeKey=*                  	| supplyKey=null & wipeKey=null 	| supplyKey=* & wipeKey=*                  	| supplyKey=* & wipeKey=*                  	|


**Non-fungible Unique Token Matrix**

|                     	| Whole, Fixed* 	| Whole, Capped-Variable      	| Whole, Infinite             	| Singleton**                 	|
|---------------------	|---------------	|-----------------------------	|-----------------------------	|-----------------------------	|
| **decimals**            	| N/A           	| 0                           	| 0                           	| 0                           	|
| **maxSupply**           	| N/A           	| n                           	| INT64_MAX_VALUE            	| 1                           	|
| **initialSupply**       	| N/A           	| 0                           	| 0                           	| 0                           	|
| **supplyKey & wipeKey** 	| N/A           	| supplyKey!=null & wipeKey=* 	| supplyKey!=null & wipeKey=* 	| supplyKey!=null & wipeKey=* 	|

*Non-fungible tokens cannot have `Fixed` supply since the creation of  `N` number of NFTs will not be supported in version 1. `initialSupply` must always be `0` for tokens of type `NON_FUNGIBLE_UNIQUE`.

**Fixed/Capped-Variable or Infinite are invalid properties for NFT of type Singleton.

***The proposal does not support Fractional NFTs.

## HAPI Changes

### Legend

```diff
+ Green represents new property/message added
! Orange represents modified property/message
```

### TokenService
The current proposal requires the addition of 3 new RPC endpoints to the existing `HTS` service - `getNftInfo`, `getTokenNftInfo` and `getAccountNftInfo`

Other than adding new `rpc` calls the following, already existing, operations must be modified: `createToken`, `mintToken`, `burnToken`, `wipeTokenAccount`, `getTokenInfo`

```diff
service TokenService {
   // Creates a new Token by submitting the transaction
   rpc createToken (Transaction) returns (TransactionResponse);
   // Updates the account by submitting the transaction
   rpc updateToken (Transaction) returns (TransactionResponse);
   // Mints an amount of the token to the defined treasury account
   rpc mintToken (Transaction) returns (TransactionResponse);
   // Burns an amount of the token from the defined treasury account
   rpc burnToken (Transaction) returns (TransactionResponse);
   // Deletes a Token
   rpc deleteToken (Transaction) returns (TransactionResponse);
   // Wipes the provided amount of tokens from the specified Account ID
   rpc wipeTokenAccount (Transaction) returns (TransactionResponse);
   // Freezes the transfer of tokens to or from the specified Account ID
   rpc freezeTokenAccount (Transaction) returns (TransactionResponse);
   // Unfreezes the transfer of tokens to or from the specified Account ID
   rpc unfreezeTokenAccount (Transaction) returns (TransactionResponse);
   // Flags the provided Account ID as having gone through KYC
   rpc grantKycToTokenAccount (Transaction) returns (TransactionResponse);
   // Removes the KYC flag of the provided Account ID
   rpc revokeKycFromTokenAccount (Transaction) returns (TransactionResponse);
   // Associates tokens to an account
   rpc associateTokens (Transaction) returns (TransactionResponse);
   // Dissociates tokens from an account
   rpc dissociateTokens (Transaction) returns (TransactionResponse);

   // Retrieves the metadata of a token
   rpc getTokenInfo (Query) returns (Response);
+  // Gets info on NFTs N through M on the list of NFTs associated with a given account
+  rpc getAccountNftInfo (Query) returns (Response);
+  // Retrieves the metadata of an NFT by TokenID and serial number
+  rpc getTokenNftInfo (Query) returns (Response);
+  // Gets info on NFTs N through M on the list of NFTs associated with a given Token of type NON_FUNGIBLE
+  rpc getTokenNftInfos (Query) returns (Response);
}
```

### BaseTypes
```diff
+/**
+ * Possible Token Types (IWA Compatibility).
+ * Apart from fungible and non-fungible, Tokens can have either a common or unique representation. This distinction might seem subtle, but it is important when considering
+ * how tokens can be traced and if they can have isolated and unique properties.
+ */
+enum TokenType {
+    /**
+     * Interchangeable value with one another, where any quantity of them has the same value as another equal quantity if they are in the same class.
+     * Share a single set of properties, not distinct from one another. Simply represented as a balance or quantity to a given Hedera account.
+     */
+    FUNGIBLE_COMMON = 0;
+    /**
+     * Unique, not interchangeable with other tokens of the same type as they typically have different values.
+     * Individually traced and can carry unique properties (e.g. serial number).
+     */
+    NON_FUNGIBLE_UNIQUE = 1;
+}

+/**
+ * Possible Token Supply Types (IWA Compatibility).
+ * Indicates how many tokens can have during its lifetime.
+ */
+enum TokenSupplyType {
+    INFINITE = 0; // Indicates that tokens of that type have an upper bound of Long.MAX_VALUE.
+    FINITE = 1; // Indicates that tokens of that type have an upper bound of maxSupply, provided on token creation.
+}
```

### TokenCreateTransactionBody

- By default, already existing tokens will be of type `FUNGIBLE_COMMON` (backwards compatible)
- By default, if `maxSupply` is not provided, the token will be defined as having `INFINITE` supply. (backwards compatible)

```diff
message TokenCreateTransactionBody {
    string name = 1; // The publicly visible name of the token, limited to a UTF-8 encoding of length <tt>tokens.maxSymbolUtf8Bytes</tt>.
    string symbol = 2; // The publicly visible token symbol, limited to a UTF-8 encoding of length <tt>tokens.maxTokenNameUtf8Bytes</tt>.
!   uint32 decimals = 3; // For tokens of type FUNGIBLE_COMMON - the number of decimal places a token is divisible by. For tokens of type NON_FUNGIBLE_UNIQUE - value must be 0
!   uint64 initialSupply = 4; // Specifies the initial supply of tokens to be put in circulation. The initial supply is sent to the Treasury Account. The supply is in the lowest denomination possible. In the case for NON_FUNGIBLE_UNIQUE Type the value must be 0
!   AccountID treasury = 5; // The account which will act as a treasury for the token. This account will receive the specified initial supply or the newly minted NFTs in the case for NON_FUNGIBLE_UNIQUE Type
    Key adminKey = 6; // The key which can perform update/delete operations on the token. If empty, the token can be perceived as immutable (not being able to be updated/deleted)
    Key kycKey = 7; // The key which can grant or revoke KYC of an account for the token's transactions. If empty, KYC is not required, and KYC grant or revoke operations are not possible.
    Key freezeKey = 8; // The key which can sign to freeze or unfreeze an account for token transactions. If empty, freezing is not possible
    Key wipeKey = 9; // The key which can wipe the token balance of an account. If empty, wipe is not possible
    Key supplyKey = 10; // The key which can change the supply of a token. The key is used to sign Token Mint/Burn operations
    bool freezeDefault = 11; // The default Freeze status (frozen or unfrozen) of Hedera accounts relative to this token. If true, an account must be unfrozen before it can receive the token
    Timestamp expiry = 13; // The epoch second at which the token should expire; if an auto-renew account and period are specified, this is coerced to the current epoch second plus the autoRenewPeriod
    AccountID autoRenewAccount = 14; // An account which will be automatically charged to renew the token's expiration, at autoRenewPeriod interval
    Duration autoRenewPeriod = 15; // The interval at which the auto-renew account will be charged to extend the token's expiry
    string memo = 16; // The memo associated with the token (UTF-8 encoding max 100 bytes)
+   TokenType tokenType = 17; // IWA compatibility. Specifies the token type. Defaults to FUNGIBLE_COMMON
+   TokenSupplyType supplyType = 18; // IWA compatibility. Specified the token supply type. Defaults to INFINITE
+   int64 maxSupply = 19; // IWA Compatibility. Depends on TokenSupplyType. For tokens of type FUNGIBLE_COMMON - the maximum number of tokens that can be in circulation. For tokens of type NON_FUNGIBLE_UNIQUE - the maximum number of NFTs (serial numbers) that can be minted. This field can never be changed!
}
```

### TokenAssociateTransactionBody 

```diff
message TokenAssociateTransactionBody {
    AccountID account = 1; // The account to be associated with the provided tokens
!   repeated TokenID tokens = 2; // The tokens to be associated with the provided account. In the case of NON_FUNGIBLE Type, once an account is associated, it can hold any number of NFTs (serial numbers) of that token type.
}
```
### TokenMintTransactionBody

The property `amount` is now used only for tokens of type `FUNGIBLE_COMMON`.
Property `metadata` is introduced for tokens of type `NON_FUNGIBLE_UNIQUE`.

Once created, an NFT instance cannot be updated, only transferred/wiped or burned.
```diff
message TokenMintTransactionBody {
    TokenID token = 1; // The token for which to mint tokens. If token does not exist, transaction results in INVALID_TOKEN_ID
!   uint64 amount = 2; // Applicable to tokens of type FUNGIBLE_COMMON. The amount to mint to the Treasury Account. Amount must be a positive non-zero number represented in the lowest denomination of the token. The new supply must be lower than 2^63.
+   repeated bytes metadata = 3; // Applicable to tokens of type NON_FUNGIBLE_UNIQUE. A list of metadata that are being created. Maximum allowed size of each metadata is 100 bytes
}

```

### TransactionReceipt
The transaction receipt is to be updated with a new field `serialNumber` used to represent the newly created NFT instance.

```diff
message TransactionReceipt {
    // The consensus status of the transaction; is UNKNOWN if consensus has not been reached, or if the
    // associated transaction did not have a valid payer signature
    ResponseCodeEnum status = 1;
    // In the receipt of a CryptoCreate, the id of the newly created account
    AccountID accountID = 2;
    // In the receipt of a FileCreate, the id of the newly created file
    FileID fileID = 3;
    // In the receipt of a ContractCreate, the id of the newly created contract
    ContractID contractID = 4;
    // The exchange rates in effect when the transaction reached consensus
    ExchangeRateSet exchangeRate = 5;
    // In the receipt of a ConsensusCreateTopic, the id of the newly created topic.
    TopicID topicID = 6;
    // In the receipt of a ConsensusSubmitMessage, the new sequence number of the topic that received the message
    uint64 topicSequenceNumber = 7;
    bytes topicRunningHash = 8;
    // In the receipt of a ConsensusSubmitMessage, the version of the SHA-384 digest used to update the running hash.
    uint64 topicRunningHashVersion = 9;
    // In the receipt of a CreateToken, the id of the newly created token
    TokenID tokenID = 10;
    // In the receipt of TokenMint, TokenWipe, TokenBurn, the current total supply of this token
    uint64 newTotalSupply = 11;
    // In the receipt of a ScheduleCreate, the id of the newly created Scheduled Entity
    ScheduleID scheduleID = 12;
    // In the receipt of a ScheduleCreate or ScheduleSign that resolves to SUCCESS, the TransactionID that should be used to query for the receipt or record of the relevant scheduled transaction
    TransactionID scheduledTransactionID = 13;
+
+   // In the receipt of a TokenMint for tokens of type NON_FUNGIBLE_UNIQUE, the serial numbers of the newly created NFTs
+   repeated int64 serialNumbers = 14;
}
```

### TokenBurnTransactionBody
The property `amount` is now used only for tokens of type `FUNGIBLE_COMMON`.
A repeated list of serial numbers called `serialNumbers` is introduced for tokens of type `NON_FUNGIBLE_UNIQUE`.

All serial numbers specified must be owned by the Treasury account in order for them to be burned successfully.
```diff
message TokenBurnTransactionBody {
	TokenID token = 1; // The token for which to burn tokens. If token does not exist, transaction results in INVALID_TOKEN_ID
!	uint64 amount = 2; // Applicable to tokens of type FUNGIBLE_COMMON. The amount to burn from the Treasury Account. Amount must be a positive non-zero number, not bigger than the token balance of the treasury account (0; balance], represented in the lowest denomination
+	repeated int64 serialNumbers = 3; // Applicable to tokens of type NON_FUNGIBLE_UNIQUE. The list of serial numbers to be burned.
}
```

### TokenWipeAccountTransactionBody
The property `amount` is now used only for tokens of type `FUNGIBLE_COMMON`.
A repeated list of serial numbers called `serialNumbers` is introduced for tokens of type `NON_FUNGIBLE_UNIQUE`.

All serial numbers specified must NOT be owned by the Treasury account in order for them to be wiped successfully.
```diff
message TokenWipeAccountTransactionBody {
	TokenID token = 1; // The token for which the account will be wiped. If token does not exist, transaction results in INVALID_TOKEN_ID
	AccountID account = 2; // The account to be wiped
!	uint64 amount = 3; // Applicable to tokens of type FUNGIBLE_COMMON. The amount of tokens to wipe from the specified account. Amount must be a positive non-zero number in the lowest denomination possible, not bigger than the token balance of the account (0; balance]
+	repeated int64 serialNumbers = 4; // Applicable to tokens of type NON_FUNGIBLE_UNIQUE. The list of serial numbers to be wiped
}

```

### TokenGetInfo
New `tokenType` and `maxSupply` fields to be added in the `TokenInfo` query. 

```diff
message TokenInfo {
   	TokenID tokenId = 1; // ID of the token instance
   	string name = 2; // The name of the token. It is a string of ASCII only characters
   	string symbol = 3; // The symbol of the token. It is a UTF-8 capitalized alphabetical string
!  	uint32 decimals = 4; // The number of decimal places a token is divisible by. Always 0 for tokens of type NON_FUNGIBLE_UNIQUE 
!  	uint64 totalSupply = 5; // For tokens of type FUNGIBLE_COMMON - the total supply of tokens that are currently in circulation. For tokens of type NON_FUNGIBLE_UNIQUE - the number of NFTs created of this token instance
  	AccountID treasury = 6; // The ID of the account which is set as Treasury
   	Key adminKey = 7; // The key which can perform update/delete operations on the token. If empty, the token can be perceived as immutable (not being able to be updated/deleted)
   	Key kycKey = 8; // The key which can grant or revoke KYC of an account for the token's transactions. If empty, KYC is not required, and KYC grant or revoke operations are not possible.
   	Key freezeKey = 9; // The key which can freeze or unfreeze an account for token transactions. If empty, freezing is not possible
   	Key wipeKey = 10; // The key which can wipe the token balance of an account. If empty, wipe is not possible
   	Key supplyKey = 11; // The key which can change the supply of a token. The key is used to sign Token Mint/Burn operations
   	TokenFreezeStatus defaultFreezeStatus = 12; // The default Freeze status (not applicable, frozen or unfrozen) of Hedera accounts relative to this token. FreezeNotApplicable is returned if Token Freeze Key is empty. Frozen is returned if Token Freeze Key is set and defaultFreeze is set to true. Unfrozen is returned if Token Freeze Key is set and defaultFreeze is set to false
   	TokenKycStatus defaultKycStatus = 13; // The default KYC status (KycNotApplicable or Revoked) of Hedera accounts relative to this token. KycNotApplicable is returned if KYC key is not set, otherwise Revoked
   	bool deleted = 14; // Specifies whether the token was deleted or not
   	AccountID autoRenewAccount = 15; // An account which will be automatically charged to renew the token's expiration, at autoRenewPeriod interval
   	Duration autoRenewPeriod = 16; // The interval at which the auto-renew account will be charged to extend the token's expiry
   	Timestamp expiry = 17; // The epoch second at which the token will expire
   	string memo = 18; // The memo associated with the token
+	TokenType tokenType = 19; // The token type
+	TokenSupplyType supplyType = 20; // The token supply type
+	int64 maxSupply = 21; // For tokens of type FUNGIBLE_COMMON - The Maximum number of fungible tokens that can be in circulation. For tokens of type NON_FUNGIBLE_UNIQUE - the maximum number of NFTs (serial numbers) that can be in circulation
}

```

### TokenTransferList

**Rationale**

With the current proposal, HTS API is being extended to support `NON_FUNGIBLE_UNIQUE` types of tokens. All the changes to the HAPI are being contained under the HTS service. Transfers in the HAPI are unified, meaning there is only 1 `CryptoTransferTransactionBody` that is used to represent both `hbar` and HTS token transfers. The proposed solution keeps the consistency of containing the changes under the HTS specific API by extending the `TokenTransferList` with a new type of transfer - Non fungible token transfer.

The major difference between `FUNGIBLE_COMMON` and `NON_FUNGIBLE_UNIQUE` transfers is the representation type. As per the [IWA specification](https://github.com/InterWorkAlliance/TokenTaxonomyFramework/blob/main/token-taxonomy.md#representation-type), we can distinguish 2 types of representations - `common` and `unique`. `AccountAmount` message type uses the `common` representation type and `NftTransfer` uses the `unique` representation type.

```diff
message CryptoTransferTransactionBody {
   TransferList transfers = 1;
   repeated TokenTransferList tokenTransfers = 2;
}

+ /* A sender account, a receiver account, and the serial number of an NFT of a Token with NON_FUNGIBLE_UNIQUE type. */
+message NftTransfer {  
+   AccountID senderAccountID = 1;  // Sending account
+   AccountID receiverAccountID = 2;  // Receiving account
+   int64 serialNumber = 3;  // Serial number that is being transferred
+}

/* A list of token IDs and amounts representing the transferred out (negative) or into (positive) amounts, represented in the lowest denomination of the token */
message TokenTransferList {
    TokenID token = 1; // The ID of the token
!   repeated AccountAmount transfers = 2; // Applicable to tokens of type FUNGIBLE_COMMON. Multiple list of AccountAmounts, each of which has an account and amount
+   repeated NftTransfer nftTransfers = 3; // Applicable to tokens of type NON_FUNGIBLE_UNIQUE. Multiple list of NftTransfers, each of which has a sender and receiver account, including the serial number of the NFT
}
```

If a HAPI client submits a `CryptoTransfer` with a `TokenTransferList` that combines a fungible token with a non-empty `nftTransfers` list, it will fail with `NFT_TRANSFERS_ONLY_ALLOWED_FOR_NON_FUNGIBLE_UNIQUE`. Similarly, a `TokenTransferList` that combines a non-fungible token with a non-empty `transfers` list fails with `ACCOUNT_AMOUNT_TRANSFERS_ONLY_ALLOWED_FOR_FUNGIBLE_COMMON`.

### CryptoGetInfoResponse

```diff
/* Response when the client sends the node CryptoGetInfoQuery */
message CryptoGetInfoResponse {
    ResponseHeader header = 1; //Standard response from node to client, including the requested fields: cost, or state proof, or both, or neither
    message AccountInfo {
        AccountID accountID = 1; // The account ID for which this information applies
        string contractAccountID = 2; // The Contract Account ID comprising of both the contract instance and the cryptocurrency account owned by the contract instance, in the format used by Solidity
        bool deleted = 3; // If true, then this account has been deleted, it will disappear when it expires, and all transactions for it will fail except the transaction to extend its expiration date
        AccountID proxyAccountID = 4; // The Account ID of the account to which this is proxy staked. If proxyAccountID is null, or is an invalid account, or is an account that isn't a node, then this account is automatically proxy staked to a node chosen by the network, but without earning payments. If the proxyAccountID account refuses to accept proxy staking , or if it is not currently running a node, then it will behave as if proxyAccountID was null.
        int64 proxyReceived = 6; // The total number of tinybars proxy staked to this account
        Key key = 7; // The key for the account, which must sign in order to transfer out, or to modify the account in any way other than extending its expiration date.
        uint64 balance = 8; // The current balance of account in tinybars
        // [Deprecated]. The threshold amount, in tinybars, at which a record is created of any transaction that decreases the balance of this account by more than the threshold
        uint64 generateSendRecordThreshold = 9 [deprecated=true];
        // [Deprecated]. The threshold amount, in tinybars, at which a record is created of any transaction that increases the balance of this account by more than the threshold
        uint64 generateReceiveRecordThreshold = 10 [deprecated=true];
        bool receiverSigRequired = 11; // If true, no transaction can transfer to this account unless signed by this account's key
        Timestamp expirationTime = 12; // The TimeStamp time at which this account is set to expire
        Duration autoRenewPeriod = 13; // The duration for expiration time will extend every this many seconds. If there are insufficient funds, then it extends as long as possible. If it is empty when it expires, then it is deleted.
        repeated LiveHash liveHashes = 14; // All of the livehashes attached to the account (each of which is a hash along with the keys that authorized it and can delete it)
        repeated TokenRelationship tokenRelationships = 15; // All tokens related to this account
        string memo = 16; // The memo associated with the account
+       int64 ownedNfts = 17; // The number of NFTs owned by this account
    }
    AccountInfo accountInfo = 2; // Info about the account (a state proof can be generated for this)
}
```

### TokenRelationship

```diff
/* Token's information related to the given Account */
message TokenRelationship {
    TokenID tokenId = 1; // The ID of the token
    string symbol = 2; // The Symbol of the token
!   uint64 balance = 3; // For token of type FUNGIBLE_COMMON - the balance that the Account holds in the smallest denomination. For token of type NON_FUNGIBLE_UNIQUE - the number of NFTs held by the account
    TokenKycStatus kycStatus = 4; // The KYC status of the account (KycNotApplicable, Granted or Revoked). If the token does not have KYC key, KycNotApplicable is returned
    TokenFreezeStatus freezeStatus = 5; // The Freeze status of the account (FreezeNotApplicable, Frozen or Unfrozen). If the token does not have Freeze key, FreezeNotApplicable is returned
!   uint32 decimals = 6; // The number of decimal places a token is divisible by. Always 0 for tokens of type NON_FUNGIBLE_UNIQUE
}
```

### AccountBalanceFile

```diff
message TokenUnitBalance {
    TokenID tokenId = 1; // A unique token id
!	uint64 balance = 2; // Number of transferable units of the identified token. For token of type FUNGIBLE_COMMON - balance in the smallest denomination. For token of type NON_FUNGIBLE_UNIQUE - the number of NFTs held by the account
}
```

### TokenBalances

```diff
/* A number of <i>transferable units</i> of a certain token.

The transferable unit of a token is its smallest denomination, as given by the token's <tt>decimals</tt> property---each minted token contains <tt>10<sup>decimals</sup></tt> transferable units. For example, we could think of the cent as the transferable unit of the US dollar (<tt>decimals=2</tt>); and the tinybar as the transferable unit of hbar (<tt>decimals=8</tt>).

Transferable units are not directly comparable across different tokens. */
message TokenBalance {
     TokenID tokenId = 1; // A unique token id
!    uint64 balance = 2; // Number of transferable units of the identified token. For token of type FUNGIBLE_COMMON - balance in the smallest denomination. For token of type NON_FUNGIBLE_UNIQUE - the number of NFTs held by the account
!    uint32 decimals = 3; // Tokens divide into <tt>10<sup>decimals</sup></tt> pieces. Always 0 for tokens of type NON_FUNGIBLE_UNIQUE
}
```

### TokenGetNftInfo
The following messages must be added in order to support the new `TokenGetNftInfo` rpc call added to `HTS`.

```diff
+/* Represents an NFT on the Ledger */
+message NftID {
+    TokenID tokenID = 1; // The (non-fungible) token of which this NFT is an instance
+    int64 serialNumber = 2; // The unique identifier of this instance
+}
+
+/* Applicable only to tokens of type NON_FUNGIBLE_UNIQUE. Gets info on a NFT for a given TokenID (of type NON_FUNGIBLE_UNIQUE) and serial number */
+message TokenGetNftInfoQuery {
+    QueryHeader header = 1; // Standard info sent from client to node, including the signed payment, and what kind of response is requested (cost, state proof, both, or neither).
+    NftID nftID = 2; // The ID of the NFT
+}
+
+message TokenNftInfo {
+    NftID nftID = 1; // The ID of the NFT
+    AccountID accountID = 2; // The current owner of the NFT
+    Timestamp creationTime = 3; // The effective consensus timestamp at which the NFT was minted
+    bytes metadata = 4; // Represents the unique metadata of the NFT
+}
+
+message TokenGetNftInfoResponse {
+    ResponseHeader header = 1; // Standard response from node to client, including the requested fields: cost, or state proof, or both, or neither
+    TokenNftInfo nft = 2; // The information about this NFT
+}
```

### TokenGetNftInfos

:warning: :x: This functionality has been deprecated on Hedera Network and isn't available on the Mainnet, Testnet or Previewnet networks.

The following messages must be added in order to support the new `TokenGetNftInfos` rpc call added to `HTS`.

Global dynamic variable must be added in the node configuring the maximum value of `maxQueryRange`. Requests must meet the following requirement: `end-start<=maxQueryRange`

```diff
+/* Applicable only to tokens of type NON_FUNGIBLE_UNIQUE. Gets info on NFTs N through M on the list of NFTs associated with a given NON_FUNGIBLE_UNIQUE Token.
+ * Example: If there are 10 NFTs issued, having start=0 and end=5 will query for the first 5 NFTs. Querying +all 10 NFTs will require start=0 and end=10
+ */
+message TokenGetNftInfosQuery {
+    QueryHeader header = 1; // Standard info sent from client to node, including the signed payment, and what kind of response is requested (cost, state proof, both, or neither).
+    TokenID tokenID = 2; // The ID of the token for which information is requested
+    int64 start = 3; // Specifies the start index (inclusive) of the range of NFTs to query for. Value must be in the range [0; ownedNFTs-1]
+    int64 end = 4; // Specifies the end index (exclusive) of the range of NFTs to query for. Value must be in the range (start; ownedNFTs]
+}
+
+message TokenGetNftInfosResponse {
+    ResponseHeader header = 1; // Standard response from node to client, including the requested fields: cost, or state proof, or both, or neither
+    TokenID tokenID = 2; // The Token with type NON_FUNGIBLE that this record is for
+    repeated TokenNftInfo nfts = 3; // List of NFTs associated to the specified token
+}
```

### TokenGetAccountNftInfo

:warning: :x: This functionality has been deprecated on Hedera Network and isn't available on the Mainnet, Testnet or Previewnet networks.

The following messages must be added in order to support the new `TokenGetAccountNftInfo` rpc call added to `HTS`.

Global dynamic variable must be added in the node configuring the maximum value of `maxQueryRange`. Requests must meet the following requirement: `end-start<=maxQueryRange`

`ownedNFTs` is the number of NFTs that the specified account owns. The value can be retrieved from the `CryptoGetInfo` query.

```diff
+/* Applicable only to tokens of type NON_FUNGIBLE_UNIQUE. Gets info on NFTs N through M owned by the specified accountId.
+ * Example: If Account A owns 5 NFTs (might be of different Token Entity), having start=0 and end=5 will return all of the NFTs
+ */
+message TokenGetAccountNftInfoQuery {
+    QueryHeader header = 1; // Standard info sent from client to node, including the signed payment, and what kind of response is requested (cost, state proof, both, or neither).
+    AccountID accountID = 2; // The Account for which information is requested
+    int64 start = 3; // Specifies the start index (inclusive) of the range of NFTs to query for. Value must be in the range [0; ownedNFTs-1]
+    int64 end = 4; // Specifies the end index (exclusive) of the range of NFTs to query for. Value must be in the range (start; ownedNFTs]
+}
+
+message TokenGetAccountNftInfoResponse {
+    ResponseHeader header = 1; // Standard response from node to client, including the requested fields: cost, or state proof, or both, or neither
+    repeated TokenNftInfo nfts = 2; // List of NFTs associated to the account
+}
```

## Example

The following operations must be performed in order to create new `NON_FUNGIBLE_UNIQUE` token, issue NFTs and transfer them:
1. Creating `NON_FUNGIBLE_UNIQUE` Token - Execute `TokenCreate` operation setting the `tokenType` to `NON_FUNGIBLE_UNIQUE`. There must be a `supplyKey` set in order to create new NFT instances.
2. Create new `NFT` instance - Execute `TokenMint` operation. The `memo` field is used for storing the metadata of the `NFT`. Once executed, the newly created `NFT` will have `serialNumber` set as part of the transaction receipt. The newly minted `NFT`s are owned by the treasury account specified on Token create operation.
3. Associate `NON_FUNGIBLE_UNIQUE` Token - Similarly to fungible token transfers, non-fungible transfers require the receiver of the account to be associated to the specified `Token` first. In order for an account to receive `NFT` instances, he must execute `TokenAssociate` operation. 
4. Transferring `NFT` instances -  Execute `CryptoTransfer` transaction, populating the `TokenTransfer` list with a `nftTransfer` entry. Example:
```
cryptoTransferTransactionBody = {
    tokenTransferList = [
        {
            token = "0.0.1500"
            nftTransfers = [
                {
                    sender = "0.0.1234"
                    receiver = "0.0.1235"
                    serialNumber = 42
                }
            ]
        }
    ]
}
```
  

## Backwards Compatibility

There are several implications for already existing HTS integrations. Due to the significant changes in the HAPI the following operations are not backwards compatible:

- [Mint](#TokenMintTransactionBody)
- [Burn](#TokenBurnTransactionBody)
- [Wipe](#TokenWipeAccountTransactionBody)

## Security Implications

### Fees

The existing fee schedule must be updated to support two separate fee schedule definitions for the same operation depending on the type of the Token. The current fee schedule for the HTS operations will be preserved for tokens of type `FUNGIBLE_COMMON` and new fee schedule will be added for tokens of type `NON_FUNGIBLE_UNIQUE` that will define the costs for executing operations on `NON_FUNGIBLE_UNIQUE` token types.

### Throttling

One trade off that must be clarified is that by extending HTS with `NON_FUNGIBLE_UNIQUE` support its impossible to throttle the operations separately. All HTS related operations (independent on the token type) will be using one throttling configuration and it will be applied for both token types.

## How to Teach This

The Hedera documentation is to be updated with the new version of HTS once implemented. Blog posts and guides can be written and distributed in the social media channels for educating the community on the new functionality.

## Reference implementation

Reference implementation for the protobuf will be implemented once the HAPI is finalised and approved

## Rejected Ideas

No rejected ideas so far

## Open Issues

### 1. Populating Redundant information on Queries

The `NftInfo` message contains the information related to a given `NFT` instance. In the case of `TokenGetNftInfo` query, there are no redundant properties populated, however, the message is used in `TokenGetNftInfos`, as well as in `TokenGetAccountNftInfo`. Depending on the query, some properties will be redundant. For example:
- When querying for `TokenGetNftInfos`, the `NFT`s returned will populate the `tokenId` property inside `NftID` message even though it will be redundant
- When querying for `TokenGetAccountNftInfo`, the `NFT`s returned will populate the `owner` property inside `NftInfo` message even though it will be redundant.

Initially the plan was to **NOT** populate `tokenId` on `TokenGetNftInfos` and `owner` on `TokenGetAccountNftInfo`, however with the introduction of the `NftID` message it does not seem consistent to populate only the `serialNumber` property of the `NftID` message on `GetTokenInfoQueries`.

When it comes to `TokenGetAccountNftInfo` query, the `NFT`s returned **could** not populate the `owner` property of the `TokenNftInfo` message, however this will introduce inconsistencies since in one of the queries redundant properties are populated (`TokenGetNftInfos`), but in others, they are skipped (`TokenGetAccountNftInfo`). 

## References

- [IWA Specification](https://github.com/InterWorkAlliance/TokenTaxonomyFramework/blob/main/token-taxonomy.md)

## Copyright
This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
