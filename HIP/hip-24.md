---
hip: 24
title: Pause feature on Hedera Token Service
author: chung@xfers.com <chung@xfers.com>, junhao@xfers.com <junhao@xfers.com>, zhikai@xfers.com <zhikai@xfers.com>
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
release: v0.19.0
created: 2021-08-09
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/126
updated: 2023-02-01
---

## **Abstract**

Stablecoin tokens issued on various protocols usually have a pause function included as part of their smart contract. This allows the token issuer to pause the whole smart contract for contract upgrading, emergencies and other scenarios. This function is currently not available in the Hedera Token Service. Therefore, we propose to establish a standard format for pause feature in HTS. 

## **Motivation**

There are several reasons that would justify the need for a pause feature;

1. Compliance with regulatory frameworks across jurisdictions in the case of regulated token issuance (e.g. stablecoins)
2. Compliance with law enforcement requests
3. Parity with functionalities offered by other blockchain protocols in the case of multichain asset issuance.

We propose to establish a standard for HTS where a pause feature can be included for tokens deployed via HTS. This will be opt-in and allows token issuers the flexibility of including or excluding the pause functionality based on the token issuers' requirements. 

## **Specification**

- Add a `pauseKey` to create token spec. The key can do both pause and unpause a token

    ```protobuf
    message TokenCreateTransactionBody {
        string name = 1; // The publicly visible name of the token, limited to a UTF-8 encoding of length <tt>tokens.maxSymbolUtf8Bytes</tt>.
        string symbol = 2; // The publicly visible token symbol, limited to a UTF-8 encoding of length <tt>tokens.maxTokenNameUtf8Bytes</tt>.
        uint32 decimals = 3; // For tokens of type FUNGIBLE_COMMON - the number of decimal places a token is divisible by. For tokens of type NON_FUNGIBLE_UNIQUE - value must be 0
        uint64 initialSupply = 4; // Specifies the initial supply of tokens to be put in circulation. The initial supply is sent to the Treasury Account. The supply is in the lowest denomination possible. In the case for NON_FUNGIBLE_UNIQUE Type the value must be 0
        AccountID treasury = 5; // The account which will act as a treasury for the token. This account will receive the specified initial supply or the newly minted NFTs in the case for NON_FUNGIBLE_UNIQUE Type
        Key adminKey = 6; // The key which can perform update/delete operations on the token. If empty, the token can be perceived as immutable (not being able to be updated/deleted)
        ...
        ...
        ...
        Key fee_schedule_key = 20; // The key which can change the token's custom fee schedule; must sign a TokenFeeScheduleUpdate transaction
        repeated CustomFee custom_fees = 21; // The custom fees to be assessed during a CryptoTransfer that transfers units of this token
        Key pauseKey = 22; // [New] The key which can pause the token. If empty, pause is not possible

    }
    ```

- Add a HAPI transaction called `pauseToken` and `unpauseToken` to Hedera Token Service, representing `TokenPauseTransaction` and `TokenUnpauseTransaction`

    ```protobuf
    /* Transactions and queries for the Token Service */
    service TokenService {
        // Creates a new Token by submitting the transaction
        rpc createToken (Transaction) returns (TransactionResponse);
        // Updates the account by submitting the transaction
        rpc updateToken (Transaction) returns (TransactionResponse);
        // Mints an amount of the token to the defined treasury account
        rpc mintToken (Transaction) returns (TransactionResponse);
        // Burns an amount of the token from the defined treasury account
        rpc burnToken (Transaction) returns (TransactionResponse);
    	...
    	...
		...
    	// [New] Pause the token
        rpc pauseToken (Transaction) returns (TransactionResponse);
    	// [New] Unpause the token
        rpc unpauseToken (Transaction) returns (TransactionResponse);
    	...
    	...
    	...
    	// Retrieves the metadata of an NFT by TokenID and serial number
        rpc getTokenNftInfo (Query) returns (Response);
        // Gets info on NFTs N through M on the list of NFTs associated with a given Token of type NON_FUNGIBLE
        rpc getTokenNftInfos (Query) returns (Response);
    }
    ```

## **Backwards Compatibility**

This HIP idea is entirely opt-in, and does not break any existing functionality. It simply provides standard of pause for HTS and the issuer can follow in order to meet requirement and integrity.

## **Security Implications**

No known security concerns. Community comment is welcome here.

## **How to Teach This**

N/A

## **Reference Implementation**

N/A

## **Rejected Ideas**

N/A

## **Open Issues**

N/A

## **References**

[0] XSGD fiat token contract: [https://etherscan.io/address/0x2e21613c4eed4a5af1e9223edcfc8640138da7fb](https://www.notion.so/4eed4a5af1e9223edcfc8640138da7fb)

[1] Hedera Token Service SDK documentation: 
[https://docs.hedera.com/guides/docs/hedera-api/token-service/tokenservice](https://docs.hedera.com/guides/docs/hedera-api/token-service/tokenservice)

## **Copyright/license**

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](https://github.com/hiero-ledger/hiero-improvement-proposals/LICENSE) or ([https://www.apache.org/licenses/LICENSE-2.0](https://www.apache.org/licenses/LICENSE-2.0))
