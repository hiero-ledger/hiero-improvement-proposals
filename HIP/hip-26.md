---
hip: 26
title: Migrate Smart Contract Service EVM to Hyperledger Besu EVM
author: Daniel Ivanov <daniel@limechain.tech>, Danno Ferrin <danno.ferrin@hedera.com>
type: Standards Track
category: Service
needs-council-approval: Yes
status: Final
release: v0.22.0
created: 2021-09-16
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/140
updated: 2023-02-01
---

## Abstract

Replace the Ethereum Virtual Machine (EVM) engine in Hedera Services, moving
from an EthereumJ based engine to a Hyperledger Besu based engine

## Motivation

The current codebase that implements EVM Smart Contract transactions is out of
date. It is based on EthereumJ and the upstream project has not implemented any
hard forks since the St. Petersburg hard fork in early 2019. Some changes to
opcodes and precompiled contracts make support of newer Solidity versions
difficult. The integration also required inclusion of the entire EthereumJ
codebase, as the EVM was not fully segregated from the client code.

## Rationale

Hyperledger Besu is an Ethereum Mainnet compatible EVM client with an EVM that
is severable from the codebase. It is also supported by an active maintainer
community and is a "Graduated Project" from the Hyperledger Project. The
codebase is also up-to-date with current Ethereum Mainnet hard forks (London as
of the writing of this HIP) and has a roadmap aiming to support future Ethereum
features such as Proof of Stake migration and MEV integration.

With Besu's current maintainers it will be possible to extract the EVM code
needed to form a reusable library and not include any unneeded support code such
as Ethereum networking and merkle tree support. Going forward it will be easier
to maintain parity with Ethereum Mainnet evolutions such as the EVM container
formats and new opcodes/precompiled contracts.

## User stories

As a developer I want to execute EVM contracts with current versions of Solidity
and with an EVM that is more compatible with Ethereum Mainnet than our current
EVM.

## Specification

This release targets a swap between EthereumJ and Besu with a minimum of
compatibility changes.

### Hedera

The current `EthereumJ` dependency is to be removed from the codebase and Hedera
optimised fork of `Besu` based on the upcoming 21.10.0 release is to be
introduced as a dependency. The `Besu` integrations will be configured to use
the "London" hard fork of Ethereum Mainnet with some necessary changes outlined
in [Backwards Compatibility].

All operations (transition logics) in the Smart Contract Service will be
refactored to a new model-based design.

The current `SmartContractRequestHandler` is to be removed along with the
related EthereumJ execution logic. Instead, two new components will be
introduced - `EvmExecutor` and `HederaWorldUpdater`. The executor will be
preparing and running the `MessageFrames` of the EVM until halt.

Account and State access (read/write) will be provided to Besu through
implementation of a `WorldUpdater`. The updater will expose an API to Besu. The
component will utilise Postgres for bytecode and storage persistence (same as
the current EthereumJ integration).

#### Account Abstraction

The Smart Contract internal logic will be updated to more fully conform to
Hedera's account abstractions.

1) Addresses in Hedera are utilising sequence number design compared to the hash
   based design in the default EVM implementation.
2) Hedera's account abstraction requires a `sponsor` and `expiry` for every
   contract/account created.

The following changes will be made to Besu in order to mitigate the fundamental
changes described above:

- New `HederaCreate` operation in Besu will be introduced to support
  the `CREATE` opcode. The operation will compute new contract addresses based
  on `sequence numbers`, and matches existing behavior with EthereumJ.
- `AbstractWorldUpdater` will be extended to handle `MessageFrame` reverts to
  reclaim the allocated `sequence numbers`
  during `MessageFrame` execution.
- `MutableAccount` will be extended to support `sponsor` and `expiry`
  properties.

## Backwards Compatibility

### Changes unrelated to "London" hard fork

The following changes will be made to the Opcodes, outside of London hard fork
support. These are done to better reflect the nature of the Hedera platform.

#### `CREATE2`

The `CREATE2` operation will not be supported and return an illegal opcode
failure. The implementation in hedera of `CREATE` and `CREATE2` are identical,
and this creates a usability problem with contracts that expect `CREATE2` to
operate in the specified manner. This stems from the differences in Hedera's and
Ethereum's account mapping.

#### `COINBASE`

The `COINBASE` operation will return the funding account (Hedera Fee collecting
account which on mainnet is `0.0.98`). The implementation at the moment returns
the `0.0.0` account and `0x0` EVM address.

#### `GASLIMIT`

The `GASLIMIT` operation will return the `gasLimit` of the transaction. The
transaction `gasLimit` will be the lowest of the gas limit requested in the
transaction or a global upper gas limit configured for all smart contracts. The
current maximum configured gas limit per transaction is 300,000 gas.

#### Enumerating created contracts in ContractCreateResult

Previously in `ContractCreateResult` responses we would list sub-contracts
created as a part of the `ContractCreate` operation in the `createdContractIDs`
field, but not the contract that was directly created as part of the call. Now
all contracts that are created as a consequence of the `ContractCreate` call are
enumerated, including the primary new contract.

#### Self Destruct during Contract Creation

If a contract was being created and the new contract called `SELFDESTRUCT` in
the initcode we would not mark the `MerkleAccount` `isDeleted` field as true. If
the `SELFDESTRUCT` was called as part of a function call we would mark it as
true.

Now regardless of whether the call to `SELFDESTRUCT` occurred in initcode or in
a function call the `isDeleted` field is set to true.

#### Errors moving from PreCheck errors to Transaction Errors

Code relating to validation errors has been cleaned up. Only errors detectable
in GRPC objects will cause precheck errors and all other errors will be reported
as part of the transaction.

The following errors in contract creation are moving out of precheck errors and
into transaction errors: `INVALID_RENEWAL_PERIOD`,
`AUTORENEW_DURATION_NOT_IN_RANGE`, `CONTRACT_NEGATIVE_GAS`,
`CONTRACT_NEGATIVE_VALUE`, `MEMO_TOO_LONG`, `INVALID_ZERO_BYTE_IN_STRING`.

The following errors in contract call are moving out of precheck errors and into
transaction errors: `CONTRACT_NEGATIVE_GAS`, `CONTRACT_NEGATIVE_VALUE`.

#### Deprecated HAPI properties

The `fileID` property in the `ContractUpdate` operation (found in the `ContractUpdateTransactionBody` protobuf) will be deprecated. The wording of the field implies it updates the contract code while the comments indicate that it the assertion of where the initcode originated from will be changed. Ethereum contracts are expected to be immutable once deployed and so neither variation is appropriate, hence the field will be deprecated.

The `maxResultSize` property in the `ContractCallLocal` operation (found in the `ContractCallLocalQuery`) will be deprecated. In order to calculate the effective result size the entire operation needs to be executed, and then at the last moment an error is returned if the result is too large. The result is not stored in server ram nor is it stored in storage, so there is no fees associated with larger queries. Because of this any errors that setting it is hoping to avoid would still occur on the server and different errors would be returned instead. The limitations of Ethereum Gas already provide a reasonable limitation on unexpectedly large results. Hence this property will be ignored if specified and all results will be returned.

### Upgrade to "London" Hard Fork

The smart contract platform will be upgraded to support the EVM visible changes
for the "London" hard fork. This includes changes introduced in the "Istanbul"
and "Berlin" hard forks. Changes relating to block production and data
serialization (such as the fee market, intrinsic gas costs, and transaction
formats) will not be implemented because they are not relevant to Hedera's
architecture.

#### `BASEFEE`

The `BASEFEE` opcode will return zero. Hedera does not use the Fee Market
mechanism this is designed to support.

#### Reject Contracts starting with `0xFE`

Hedera `ContractCreate` transactions and `CREATE` opcode calls will fail if the
first bytes of the smart contract is `0xFE`. Extending this to
the `ContractCreate` transaction mirrors how Ethereum contract deployments
typically operate.

#### `SELFBALANCE`

This opcode will operate as expected with no change from Ethereum Mainnet.

#### `CHAINID`

The `CHAINID` opcode will return `295` (hex `0x0127`) for mainnet, `296` (
hex `0x0128`) for testnet, and `297` (hex `0x0129`) for previewnet.

#### Blake2 compression function F precompile

The precompiled contract operates the same as on Ethereum Mainnet.

### Gas Schedule Changes

The Smart Contract Service will use the Gas Schedule from the "London" hard
fork. Notable changes include warm/cold account access and refund reductions.

#### Warm and Cold Account and Slot Access

Berlin introduced the notion of warm and cold accounts and storage slots. The
first access to an account or storage slot in a transaction will need to pay
the "cold" costs and all subsequent calls will pay the lower "warm" access
costs. [EIP-2929](https://eips.ethereum.org/EIPS/eip-2929) contains the full
details of the new cost scheduling.

Hedera does not at this time allow for "pre-warming" addresses and storage slots
as part of the transaction as seen
in [EIP-2930](https://eips.ethereum.org/EIPS/eip-2929). Future HIPs may support
this scheme.

#### Gas Refund Reductions and Eliminations

In the London gas schedule the amount of gas that can be returned from storage
access usage patterns has been significantly reduced. Account refunds
from `SELFDESTRUCT` have been completely removed.

#### Table of Gas Cost Changes

| Operation                                           |                            Current Hedera |                      London Cost |                      HIP-26 Cost |
| --------------------------------------------------- | ----------------------------------------: | -------------------------------: | -------------------------------: |
| Code deposit                                        | Floating Hedera<br/>Storage Cost per byte |                      200 * bytes |      Max of London<br/>or Hedera |
| BALANCE <br/>(cold account)                         |                                        20 |                             2600 |                             2600 |
| BALANCE <br/>(warm account)                         |                                        20 |                              100 |                              100 |
| EXP                                                 |                              10 + 10/byte |                     10 + 50/byte |                     10 + 50/byte |
| EXTCODECOPY <br/>(cold account)                     |                                  20 + Mem |                       2600 + Mem |                       2600 + Mem |
| EXTCODECOPY <br/>(warm account)                     |                                  20 + Mem |                        100 + Mem |                        100 + Mem |
| EXTCODEHASH <br/>(cold account)                     |                                       400 |                             2600 |                             2600 |
| EXTCODEHASH <br/>(warm account)                     |                                       400 |                              100 |                              100 |
| EXTCODESIZE <br/>(cold account)                     |                                        20 |                             2600 |                             2600 |
| EXTCODESIZE <br/>(warm account)                     |                                        20 |                              100 |                              100 |
| LOG0, LOG1, LOG2,<br/> LOG3, LOG4                   |     Floating Hedera<br/>Ram Cost per byte |  375 + 375*topics<br/>+ data Mem |      Max of London<br/>or Hedera |
| SLOAD <br/>(cold slot)                              |                                        50 |                             2100 |                             2100 |
| SLOAD <br/>(warm slot)                              |                                        50 |                              100 |                              100 |
| SSTORE <br/>(new slot)                              | Floating Hedera<br/>Storage Cost per byte |                           22,100 |      Max of London<br/>or Hedera |
| SSTORE <br/>(existing slot, <br/>cold access)       |                                     5,000 |                            2,900 |                            2,900 |
| SSTORE <br/>(existing slot, <br/>warm access)       |                                     5,000 |                              100 |                              100 |
| SSTORE <br/>refund                                  |                  All new<br/>slot charges | Only transient<br/>storage slots | Only transient<br/>storage slots |
| CALL <i>et al</i>.<br/> (cold recipient)            |                                        40 |                            2,600 |                            2,600 |
| CALL <i>et al</i>.<br/> (warm recipient)            |                                        40 |                              100 |                              100 |
| CALL <i>et al</i>.<br/> Hbar/Eth Transfer Surcharge |                                     9,000 |                            9,000 |                            9,000 |
| CALL <i>et al</i>.<br/> New Account Surcharge       |                             <i>revert</i> |                           25,000 |                    <i>revert</i> |
| SELFDESTRUCT <br/>(cold beneficiary)                |                                         0 |                             2600 |                             2600 |
| SELFDESTRUCT <br/>(warm beneficiary)                |                                         0 |                                0 |                                0 |

<!--| CREATE | | REVERT | | RETURNDATACOPY | | RETURNDATASIZE |-->

The terms 'warm' and 'cold' in the above table correspond with whether the
account or storage slot has been read or written to within the current smart
contract transaction, even if within a child call frame.

'CALL <i>et al.</i>' includes with limitation CALL, CALLCODE, DELEGATECALL, and
STATICCALL

## Security Implications

Between Besu and EthereumJ there is no material difference in the security
attack surfaces. The same specifications and Hedera integrations will exist.

<!--
## How to Teach This

> For a HIP that adds new functionality or changes interface behaviors, it is helpful to include a section on how to teach users, new and experienced, how to apply the HIP to their work.
-->

## Reference Implementation

Hedera Services
PR [#2208](https://github.com/hashgraph/hedera-services/pull/2208)

## Rejected Ideas

### Migration to another Smart Contract VM

The EVM is not the only smart contract platform, however it is the platform that
has the most widespread use in terms of total users and total numbers of DLTs
supporting the EVM. One alternative of note is WASM and eWASM. The Ethereum
Foundation's eWASM project has stagnated over the last two years and is not
under active development. It also did not achieve the performance goals it had
set, often running slower than optimized EVM implementations. WASM as a
standalone technology lacks determinism in some instructions it supports (mostly
floating point operations) as well as lacking resource metering and limitations.

Other leading smart contract platforms (TEAL, Michelson, MoveVM, etc.) are
strongly tied to their host chain and are not used with other chains and have
not gained cross-DLT support. A few chains that have custom smart contract
platforms have added EVM compatability layers or libraries for their systems
too (Aurora/NEAR and Arbitrum most notably).

Apart from EVM being one of the best choices there are also issues relating to
migrating to other smart contract systems that staying with EVM avoids. While
there may be future changes in supported services keeping the Smart Contract
Service on the EVM provides the least amount of backwards compatibility issues.

### Eliminating Smart Contract Service Support

Eliminating the EVM as a whole would foreclose future growth of the Hedera
Platform in the "on-chain" smart contract arena.

## Open Issues

Currently, no open issues.

## References

* [Hyperledger Besu](http://github.com/hyperledger/besu)
* [Ethereum London Hard Fork](https://github.com/ethereum/execution-specs/blob/main/network-upgrades/mainnet-upgrades/london.md)
* [Ethereum Berlin Hard Fork](https://github.com/ethereum/execution-specs/blob/main/network-upgrades/mainnet-upgrades/berlin.md)
* [Ethereum Istanbul Hard Fork](https://github.com/ethereum/execution-specs/blob/main/network-upgrades/mainnet-upgrades/istanbul.md)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 --
see [LICENSE](../LICENSE)
or (https://www.apache.org/licenses/LICENSE-2.0)
