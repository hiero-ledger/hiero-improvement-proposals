---
hip: 11
title: Layer-2 Smart Contract Network
author: Bryce Doganer (@BryceDoganer), Lucas Henning (@lucashenning)
type: Standards Track
category: Application
needs-council-approval: No
status: Active
last-call-date-time: 2021-11-23T07:00:00Z
created: 2021-02-23
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/49
updated: 2021-11-30
---

## Abstract

This HIP defines and discusses a way to create a network consisting of a plurality of nodes that provide an Ethereum-like smart contract service over Hedera at low cost and significantly higher transaction rate than the existing on-ledger Smart Contract service on Hedera.

## Motivation

There are many use-cases that can benefit from a Solidity-based Ethereum-like service on Hedera. The factors that make this desirable are:
1. There are many smart contracts that are already written and deployed over Ethereum
2. Several tools are available for developing, debugging and interacting with these smart contracts
3. There is a large set of dApp developers trained on these paradigms
 
 
Currently the on-ledger smart contracts on Hedera are:
1. Limited in transactions per second (throttled at 13 TPS for the entire network),
2. Limited in the size of the state
3. Use a Solidity VM that has been since deprecated.
 
As a result, it is difficult for some use cases to use a  smart contract on Hedera.


## Rationale

The rationale behind this HIP is to address the aforementioned issues, and to promote creation of a diverse set of smart-contract based dApps on Hedera, the goals of this HIP are:

1. Define an architecture that enables execution of smart contracts off-ledger
  * Existing Ethereum-based smart contracts should work with this architecture with minimal modifications.
  * Existing Ethereum tools and clients should work with this system
  * A typical developer on Ethereum should be able to develop against this system with relative familiarity and ease (i.e. no significant re-training required)
  * Deployment of such a network should be as easy as possible
 
2. Define the role of layer-2 network nodes and examples of possible incentive models
 
3. It should be possible to run multiple such networks in parallel. For example, one network might be configured such that it is optimal for DeFi applications, while another one is configured to serve the supply chains. These nodes are self-governing - without any interference from Hedera - and can specify their own rules about network size, code governance, and fees charged by the nodes.
 
This HIP does not attempt to address:
* On-ledger programmability and scalability
* Native compatibility/interoperability with Ethereum network nodes

## Specification

At a high level, this proposal works as follows:
1. Create a set of layer-2 network nodes
2. Each of these nodes run a standard Ethereum node (e.g. geth or parity) with a few pluggable modifications that replace the proof of work computation logic with interactions with Hedera APIs
3. Layer-2 network nodes have a predetermined algorithm to calculate fees (gas cost) in hbars. The user pays the gas cost when they invoke a smart contract function. The network nodes pay the fees for the Hedera transaction, and the remaining gas cost is split between the layer-2 network nodes that were active participants.

### Background on Scheduled Transactions feature on Hedera
It is helpful to understand how the Scheduled Transaction feature works on Hedera since this HIP is predicated on it. Essentially, this feature allows multiple keys to sign a multi-sig transaction at different points in time. Once sufficient signatures are collected on the network, the transaction is executed by the Hedera mainnet (there are configuration options to specify whether the transaction should be executed as soon as the last required signature is received, or at a pre-specified future time). This feature helps simplify the effort required to coordinate collection of a sufficient number of signatures prior to submitting a multi-sig transaction. The list of allowed signatories as well as the minimum threshold required to be met are determined by the keys associated with the accounts or entities involved (the same as for a normal, non-scheduled transaction).. Further, scheduled transactions have an expiration period, and if the scheduled transaction fails to collect sufficient signatures in that time, then it expires and is deleted from the mainnet node memory.

### Summary of a the layer-2 network
Multiple layer-2 nodes run the Ethereum node code with some modifications:
* Instead of gossiping transactions with each other, the layer-2 nodes send the transaction request to an HCS topic, and all other nodes listen to the stream of those transactions. In concept, this would be exactly the same format as that of the existing p2p gossip format.
* Honest nodes process the transactions in the order they are received from the HCS topic (no frontrunning)
* The typical accounts-balances map of the smart contract is actually maintained as Hedera accounts and token balances. The layer-2 smart contract only maintains the rest of the state in the smart contract.
* During processing, when there is an instruction to transfer from the account that the smart contract maintains, the node generates an appropriate crypto/token-transfer transaction on Hedera as a scheduled transaction and adds its signature to it. When sufficient signatures are collected, Hedera mainnet automatically executes the transaction.
 
### Execution of a smart contract call
Source code of the standard Ethereum full node (e.g. geth node) is forked and modified as described below.
 * These full nodes accept smart contract transactions from the users, do the same processing that they do today in a geth node, and send it to HCS (instead of sending it out as p2p gossip)
 * Listen to a mirror node stream for the specific HCS topic. When a new transaction appears on that topic, accept it as if it was heard from p2p gossip.
 * In the existing code of a miner, when it creates a block with a set of transactions (after collecting transactions, ommers and calculating the state), it starts the Proof of Work computation. Instead of that, the new code in the miner creates a scheduled transaction and submits it to the Hedera network. For example, if the result of the execution of a smart contract is that the smart contract account will pay 10 FooTokens to Alice and 20 BarTokens to Bob, then the full node constructs that transaction as a Hedera token-transfer transaction and submits it to Hedera as a scheduled transactions providing its signature.
 * The same process runs on other full nodes running in layer-2 in parallel. Other honest nodes will also execute this transaction in the correct order, and they will also add their signatures to the same transaction created by the first node.
 * As soon as a sufficient number of signature transactions are received, Hedera mainnet executes the transaction and transfers the tokens and/or hbars accordingly. Note that there is an account on Hedera corresponding to the smart contract in the layer-2 network and it is configured as an m-of-n multisig with the keys belonging to the layer-2 full nodes.
 * When the full nodes receive a receipt of this transaction execution from a mirror node, they add this transaction to the blockchain. Creation of block is done by any node elected with some deterministic algorithm with a fallback if the elected node is malicious, slow, or down. As discussed in the incentives section, each layer-2 full node that actively participated receives incentive rewards (instead of the current Ethereum policy of rewarding a single miner that completed the PoW algorithm first).
 
### Other considerations
* Modification of Solidity:
 . Hedera accounts instead of Ethereum addresses: We can devise a scheme to deterministically map (encode) Hedera account addresses into Ethereum addresses since Ethereum addresses are longer than Hedera account addresses. Note: Hedera accounts can already map to a solidity address and back, but these addresses aren't known to Ethereum. The modifications to the Hedera EVM perform this conversion natively already when transferring between addresses.
 . Generation of Hedera transaction: Either create a new opcode in ethereum, or create a precompiled function that generates a Hedera transaction for transferring tokens
 . Synchronizing the balance of the Hedera account controlled by the smart contract: Since the Hedera account can only be debited by a multi-sig transaction that is controlled by the operators of this layer-2 network, they could either agree to debit the account without going through a smart contract, or Hedera could implement a flag on the accounts that explicitly prevents that. This guarantees that the balance maintained by the smart contract is equal to or lower than the actual balance in the Hedera account.
 . Reading of the balances of other accounts: the layer-2 node could listen to the mirror node transaction records to find out the balances, and calculate the balances accordingly. We could modify the `BALANCE` opcode of the EVM to fetch this information from a mirror node.
 
### Properties of this solution
* Trust: End-users can trust this system as long as they can trust a configured number of community consensus nodes is honest.
* Transparency: All consensus node signatures can be verified through the record of the scheduled transactions. The p2p gossip for transactions between these layer-2 nodes is logged on HCS and can be verified/audited.
Ethereum tool chain: All existing Ethereum tools should continue to work without any modification, at least in theory.
* State: the state is maintained by the consensus nodes and it does not add any tax on Hedera. The state is maintained in the layer-2 smart contracts. Hedera only executes the HAPI transactions (including scheduled transactions), and maintains the accounts and their hbar/token balances.
* Cost: Expected to be significantly cheaper than Ethereum gas costs, but slightly more expensive than native HAPI transactions. Very comparable to the cost of interoperability transactions through decentralized bridges.
* Scale: The scale is really dependent on the number of parallel instances of these layer-2 nodes and the number of nodes in each of them. The scale from Hedera mainnet perspective is really the scale of the native cryptotransfer, HCS submit message transactions, and scheduled transactions.
* Latency: overall latency will involve sending transactions through HCS, and then submitting the scheduled transaction. Assuming each of these takes around 5-10 seconds, the overall latency is likely to be around 15-25 seconds. 
* Finality: Transactions notified by mirror node or HCS can be considered to be 100% final.
 
### Node incentives
To bootstrap, Hedera could incentivize a set of consensus nodes. But Hedera does not really define the incentive model for this network. There could be multiple independent instances of these networks and the participants can decide on the incentive models and prices depending on the use cases they serve. The incentive model could be as simple as “everyone who participates gets a share of fees”, which would incentivize smaller networks, or “a selected subset of consensus nodes (e.g. determined by a hashing function using the latest consensus timestamp) will get compensated”. In both cases making sure that there is some skin in the game for consensus nodes (maybe staked HBAR) would be good to prevent Sybil Attacks.
The consensus nodes are known to the smart contract, and the smart contract is coded to distribute the ‘fees’ to the consensus nodes equally between the consensus nodes who are “active” (defined as those who successfully signed the last m of n transactions). So, if a consensus node falls off the network, very quickly they will stop receiving payments. The community can write this logic so that this set of ‘active’ consensus nodes is deterministically calculated on each consensus node.


### Deployment and configuration:
There would have to be some consensus between layer-2 nodes of what is an acceptable configuration - in terms of the number of nodes allowed, whether they are permissioned or permissionless, number of signatures required on the scheduled transaction, incentive models, etc. There would also need to be the same consideration if creating a token for the different roles and behaviors.
 
## Backwards Compatibility
This solution is not expected to be compatible with the existing on-ledger Smart Contracts Service on Hedera mainnet. Neither is this solution expected to be compatible with the Ethereum network.
 
This solution is expected to be (almost) compatible with the developer — as well as user — tools and utilities existing on Ethereum today.

## Security Implications
* Security of keys in the layer-2 network: The layer-2 nodes will need to maintain their own keys on their computer. They could use industry-standard software and hardware security mechanisms to secure their keys as well as their nodes to defend against attackers.
* Security of the smart contract account: The smart contract account is a multi-sig account with the decentralized layer-2 nodes being the signatories on the account. The security of the smart contract account is as good or as bad as the security and integrity of individual node operators. If an attacker can compromise a majority/super-majority (as configured in the account) of these node operators, they can gain access to the smart contract accounts.
* Auditability: Since the submitted transactions are logged in HCS and the actual token transfers are executed by Hedera mainnet, this system offers a high level of transparency and auditability.

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
 
