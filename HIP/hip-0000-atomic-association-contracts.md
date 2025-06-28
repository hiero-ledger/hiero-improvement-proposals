---
hip: 0000
title: Optimstic token association for smart contracts
author: Matthew DeLorenzo <mdelore.ufl@gmail.com>, Vae Vecturne <vea.vecturne@gmail.com>
type: Standards Track
category: Service
needs-council-approval: Yes
status: Draft
created: 2023-04-06
updated: 2023-05-12
discussions-to: https://github.com/hashgraph/hedera-improvement-proposal/discussions/696
---

## Abstract

Smart contracts are required to be associated with all tokens they custody. This makes sense when the contract has a long lived balance > 0; Hedera state is expanded and must be paid for in ongoing maintenance and storage costs to the network. However, there are many use cases that call for smart contracts atomically taking custody of a token, often to transfer to another entity within the same contract call. In this case, association is still required but Hedera state is not expanded.

We propose that association not be required for Hedera entities that only custody a token during an atomic transaction.

## Motivation

Currently, a smart contract attempting to custody an unassociated token will be immediately rejected by the network. This presents a problem in some decentralized finance (DeFi) applications that use smart contracts to atomically custody tokens. Decentraliztion may be achieved by allowing contracts to remain token agnostic, but also prevent spamming attacks by allowing any user to associate tokens to a DeFi smart contract. 

`MAX_AUTOMATIC_ASSOCIATION` would not be sufficient for technical and some practical reasons. A decentralized contract that mediates transfers between two parties using auto-association slots would have to dissociate the token to free a slot for the next transfer upon completion. However, this process can be corrupted by a third party by sending tokens directly to the contract (without the execution of contract code), thereby requiring another party to dissociate the undesired tokens from the contract. 

Another example is the contract caller would need to pay for dissociation of the token each time. For contracts that self-custody a variable number of tokens in a contract call (for example, UniswapV3 Swap Router), the burden of calculating how much gas to send is placed on the front end application. Due to the relatively high cost of associating and dissociating tokens using smart contract precompiles, a comparatively low upper limit is placed on the number of tokens that can be custodied by the contract. If instead tokens could optimistically be associated to contracts, the gas cost of association/disociation is not needed, and contracts are instead bounded primarily by computation and transfer costs.

## Rationale

Periphery contracts for decentralized exchanges (DEXes), such as Uniswap V2 and V3, are designed to atomically custody tokens. For DEXes on Hedera, gas-inefficient workarounds are used to associate and dissociate tokens to periphery smart contracts, paid by end-users.

## Specification

Hedera Smart Contract Service optimistically allows custody of any token for smart contracts, and checks at the end of a contract call that tokens are associated to entities whose balance is changing from zero to nonzero. 

### Successful

The response code for token transfer of a token not associated to a smart contract, whose balance is equal to zero at the end of the transaction, is SUCCESS = 22.

### Revert

The response code for token transfer of a token not associated to a smart contract, whose balance is nonzero at the end of the transaction, is TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 184, or a new enum TOKEN_NOT_ASSOCIATED_TO_CONTRACT.

## User stories

As a solidity developer, I do not want to associate tokens to a smart contract that custodies tokens but is not designed to have token balances.

## Backwards Compatibility

This would be backward compatible.

## Security Implications

Incorrect implementation of optimistic token association could result in expansion of global token state for very little cost, resulting in a potentially large storage burden.

## How to Teach This

N/A

## Reference Implementation
#### Example :
Example of a transfer transaction that should be allowed:

```
/**
     * @dev Example function to transfer entire balance of unassociated tokens
     * @param token The HTS token to transfer
     * @param treasury The recipient of the token transfer (is associated to token)
     */
     function function1(address token, address recipient) external {
        require(IERC20(token).balanceOf(address(this)) == 0);
        HederaTokenService.dissociateToken(token, address(this));
        // assumes msg.sender approved an allowance to address(this)
        HederaTokenService.transferToken(token, msg.sender, address(this), 1);
        int respCode = HederaTokenService.transferToken(token, address(this), recipient, 1);
        assert(respCode == 22);
     }
```
Example of a transfer transaction that should not be allowed:

```
/**
     * @dev Example of a function call that should fail because address(this) balance is nonzero at end of function call
     * @param token The HTS token to transfer
     * @param treasury The recipient of the token transfer (is associated to token)
     */
     function function2(address token, address recipient) external {
        require(IERC20(token).balanceOf(address(this)) == 0);
        HederaTokenService.dissociateToken(token, address(this));
        // assumes msg.sender approved an allowance to address(this)
        HederaTokenService.transferToken(token, msg.sender, address(this), 2);
        HederaTokenService.transferToken(token, address(this), recipient, 1);
     }
 ```

## Rejected Ideas

None as of yet.

## Open Issues

None as of yet.

## References

- 1 - https://eips.ethereum.org/EIPS/eip-20
- 2 - https://hips.hedera.com/hip/hip-23
- 3 - https://hips.hedera.com/hip/hip-367
- 4 - https://github.com/LimeChain/HeliSwap-contracts/blob/13ba01b9ed89201888283c56e76a4e266489a7ff/contracts/periphery/UniswapV2Router02.sol#L141
- 5 - https://github.com/Uniswap/v3-periphery/blob/6cce88e63e176af1ddb6cc56e029110289622317/contracts/SwapRouter.sol#L147


## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
