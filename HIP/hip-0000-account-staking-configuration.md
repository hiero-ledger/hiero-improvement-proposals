---
hip: 0000 # Assigned by the HIP editor.
title: Account Staking Configuration via the Hedera Account Service
author: Stoyan Panayotov (@stoqnkpL)
discussions-to: # Filled by the HIP editor upon PR creation.
type: Standards Track
category: Service
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-07-22
updated: 2026-07-22
requires: 632, 906
---

## Abstract

The Hedera Account Service (HAS) system contract at address `0x16a`, introduced in
[HIP-632](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-632.md)
and extended in
[HIP-906](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-906.md),
lets accounts and contracts manage authorization and HBAR allowances from within the EVM. It does
not expose an account's **staking configuration** — the `staked_node_id` / `staked_account_id` and
`decline_reward` fields that today are settable only through the HAPI `CryptoUpdate` and
`ContractUpdate` transactions. As a result a smart contract that custodies HBAR cannot direct its
own balance to stake to a consensus node, or decline staking rewards, without an off-chain HAPI
transaction signed by an admin key it may deliberately not hold. This HIP adds staking-configuration
functions to the `IHederaAccountService` interface and its `IHRC632` account-address facade, so an
account (EOA or contract) can set or clear its own staking target and reward preference directly from
the EVM, gated by the existing HAS security model. The change is purely additive: no existing HAPI
transaction, protobuf message, or system-contract selector is altered.

## Motivation

Staking on Hedera is configured per account through `staked_node_id` (or `staked_account_id`) and
`decline_reward`, set at `CryptoCreate` / `ContractCreate` time or changed later with a
`CryptoUpdate` / `ContractUpdate`. Changing it later requires the account's admin key to sign that
HAPI transaction.

This is a hard limitation for smart contracts that hold HBAR:

- A UUPS-upgradeable custody contract intentionally has **no Hedera admin key** — an admin key is a
  ledger-level superuser that can re-key or delete the contract, bypassing the contract's own
  on-chain governance and access control. Such a contract can set staking *once* at
  `ContractCreate` time and then never again: it cannot follow a retired node, rebalance, or toggle
  reward-decline in response to policy, because there is no key to sign a `ContractUpdate` and no EVM
  path to do it keylessly.
- A contract that wants to make staking a governed, on-chain operation (e.g. "governance votes to
  move locked HBAR to a new node") has no mechanism at all: the decision lives on-chain but the
  effecting transaction lives off-chain in HAPI.

HAS already solved the analogous problem for HBAR allowances in HIP-906: functionality that
previously required a HAPI `CryptoApproveAllowance` was exposed to the EVM so a contract can approve
HBAR allowances on its own behalf under the security model. Staking configuration is the same shape
of gap — an account-level property that HAPI can change but the EVM cannot — and it should be closed
the same way.

Concretely, consider an HBAR-custody contract that locks user HBAR and wants that balance to
stake to a chosen consensus node with `decline_reward = true` (contribute to network security without
accruing rewards), under governance control. Today it must either (a) bake staking in immutably at
`ContractCreate` and accept that a retired node can never be re-tracked, or (b) hold an admin key and
accept a ledger-level superuser over a funds-custody contract. Neither is acceptable; both are
symptoms of the missing EVM surface this HIP provides.

## Rationale

**Reuse the HAS security model and the HIP-906 dual-interface shape.** HIP-906 established the pattern
for account-level mutations in HAS: a low-level `IHederaAccountService` interface at `0x16a` whose
functions name the target account explicitly, plus an `IHRC632` facade that is called *on an account
address* and implicitly targets that account (a contract calling `IHRC632(address(this)).f()` acts on
itself; an EOA is redirected to `0x16a`). Staking configuration fits this shape exactly, so this HIP
extends both interfaces rather than inventing a new address or a new authorization model. The
authorization rule is unchanged from HIP-632/906: a mutation on an account succeeds only if the
transaction satisfies that account's key under the smart-contract security model — a contract is
inherently authorized for its own account, and any other caller must carry the account's signature.

**Offer precise per-field setters, plus one combined convenience call.** The underlying
`CryptoUpdate` staking fields are a `oneof staked_id { staked_account_id, staked_node_id }` plus a
wrapped `decline_reward` whose "unset" state means "leave unchanged". The primary surface is a set of
orthogonal setters — `stakeToNode`, `stakeToAccount`, `unstake`, `setDeclineReward` — each mapping to
exactly one field, so a caller changes precisely what it intends and leaves the rest untouched, the
same way HIP-906 kept `hbarAllowance` and `hbarApprove` as distinct, single-purpose calls. For the
common case of pointing an account at a node and setting its reward preference together,
`updateStakingConfig(nodeId, decline)` combines those two most-used fields in a single call. Callers
that need to set several fields atomically can also compose the setters in one EVM transaction: the
calling contract reverts on any non-`SUCCESS` response code, so no partial update persists.

**A system-contract call, not a new HAPI transaction.** The functions are implemented as a
system-contract call that dispatches the existing `CryptoUpdate` staking logic against the target
account, producing a synthetic update child record — exactly as HIP-906's `hbarApprove` dispatches
the existing allowance logic. No new `HederaFunctionality`, transaction body, or protobuf message is
required, which keeps the surface minimal and the mirror-node / SDK impact near zero.

**How other ecosystems handle it.** On account-abstraction and validator-staking chains, a contract
directs its own stake through a precompile or a staking module call (e.g. Cosmos `x/staking`
messages, or EVM staking precompiles on Cosmos-EVM chains). Exposing staking to the contract that
owns the balance — rather than to an external key — is the norm; Hedera is the outlier in requiring
an off-chain key-signed transaction.

## User stories

1. As a smart-contract developer whose contract custodies HBAR, I want the contract to stake its own
   balance to a consensus node from within a contract call, so that locked HBAR contributes to
   network security under my contract's on-chain governance rather than an off-chain admin key.
2. As a smart-contract developer, I want my contract to set `decline_reward` on its own account from
   the EVM, so that I can choose to contribute to security without accruing rewards (or reverse that)
   as a governed on-chain action.
3. As a smart-contract developer, I want my contract to re-point or clear its staking when a node is
   retired, without holding a ledger-level admin key over a funds-custody contract.
4. As an EOA user, I want to set or clear my own account's staking configuration by calling the
   `IHRC632` facade on my account address from a wallet that speaks the EVM JSON-RPC relay.

## Specification

This HIP extends the Hedera Account Service system contract (`0x16a`) with staking-configuration
functions on two interfaces, mirroring HIP-906:

- **`IHRC632`** — the account-address facade. A call `IHRC632(account).f(...)` targets `account`. A
  contract calling `IHRC632(address(this)).f(...)` configures its own staking; an EOA calls the facade
  on its own address through the redirect mechanism described in HIP-632/906.
- **`IHederaAccountService`** — the `0x16a` interface whose functions name the target `account`
  explicitly, for callers that satisfy that account's key under the security model.

All functions return an `int64` Hedera response code (`22 = SUCCESS`; see Response codes). Node ids
follow HAPI convention: a non-negative `int64` selects a consensus node; `unstake` clears any staking
target (equivalent to setting `staked_node_id = -1` via HAPI).

### `IHRC632` additions (account-address facade)

| Selector     | Function signature                | Response       | Description                                                                 |
| ------------ | --------------------------------- | -------------- | --------------------------------------------------------------------------- |
| `0x5fbd84d5` | `stakeToNode(int64 nodeId)`       | `(int64)`      | Stake the account's balance to consensus node `nodeId`.                     |
| `0xa69431fe` | `stakeToAccount(address account)` | `(int64)`      | Stake the account's balance to another account `account` (staked-account).  |
| `0x2def6620` | `unstake()`                       | `(int64)`      | Clear the account's staking target.                                         |
| `0x293d496f` | `setDeclineReward(bool decline)`  | `(int64)`      | Set the account's `decline_reward` flag.                                    |
| `0xcb9ebb71` | `updateStakingConfig(int64 nodeId, bool decline)` | `(int64)` | Set the account's staking node to `nodeId` and `decline_reward` to `decline` in one call; a negative `nodeId` clears the staking target. |

```solidity
interface IHRC632 {
    // ... existing HIP-632 / HIP-906 functions (isAuthorizedRaw, isAuthorized, hbarAllowance, hbarApprove) ...

    /// @notice Stake the calling account's balance to a consensus node.
    /// @param nodeId The consensus node id to stake to (non-negative).
    /// @return responseCode 22 (SUCCESS) on success; otherwise a Hedera error code.
    function stakeToNode(int64 nodeId) external returns (int64 responseCode);

    /// @notice Stake the calling account's balance to another account.
    /// @param account The account to stake to.
    /// @return responseCode 22 (SUCCESS) on success; otherwise a Hedera error code.
    function stakeToAccount(address account) external returns (int64 responseCode);

    /// @notice Clear the calling account's staking target (no node / account staking).
    /// @return responseCode 22 (SUCCESS) on success; otherwise a Hedera error code.
    function unstake() external returns (int64 responseCode);

    /// @notice Set the calling account's decline-staking-reward flag.
    /// @param decline Whether the account declines staking rewards.
    /// @return responseCode 22 (SUCCESS) on success; otherwise a Hedera error code.
    function setDeclineReward(bool decline) external returns (int64 responseCode);

    /// @notice Set the calling account's staking node and decline-reward flag in one call.
    /// @param nodeId The consensus node id to stake to; a negative value clears the staking target.
    /// @param decline Whether the account declines staking rewards.
    /// @return responseCode 22 (SUCCESS) on success; otherwise a Hedera error code.
    function updateStakingConfig(int64 nodeId, bool decline) external returns (int64 responseCode);
}
```

Usage from a contract configuring its own account:

```solidity
// e.g. inside a governance-gated function of a custody contract
int64 rc = IHRC632(address(this)).stakeToNode(nodeId);
require(rc == 22, "stakeToNode failed");
rc = IHRC632(address(this)).setDeclineReward(true);
require(rc == 22, "setDeclineReward failed");
```

Usage from an EOA (via the JSON-RPC relay, calling the facade on the EOA's own address):

```solidity
IHRC632(myAddress).stakeToNode(nodeId);
```

### `IHederaAccountService` additions (`0x16a`, explicit account)

| Selector     | Function signature                                  | Response  | Description                                             |
| ------------ | --------------------------------------------------- | --------- | ------------------------------------------------------ |
| `0x7a852f7c` | `stakeToNode(address account, int64 nodeId)`        | `(int64)` | Stake `account` to consensus node `nodeId`.            |
| `0x7563f477` | `stakeToAccount(address account, address stakedTo)` | `(int64)` | Stake `account` to another account `stakedTo`.         |
| `0xf2888dbb` | `unstake(address account)`                          | `(int64)` | Clear `account`'s staking target.                      |
| `0xf8afc6b4` | `setDeclineReward(address account, bool decline)`   | `(int64)` | Set `account`'s `decline_reward` flag.                 |
| `0x1f34ce63` | `updateStakingConfig(address account, int64 nodeId, bool decline)` | `(int64)` | Set `account`'s staking node and `decline_reward` in one call; a negative `nodeId` clears the target. |

```solidity
interface IHederaAccountService {
    // ... existing HIP-632 / HIP-906 functions ...

    function stakeToNode(address account, int64 nodeId) external returns (int64 responseCode);
    function stakeToAccount(address account, address stakedTo) external returns (int64 responseCode);
    function unstake(address account) external returns (int64 responseCode);
    function setDeclineReward(address account, bool decline) external returns (int64 responseCode);
    function updateStakingConfig(address account, int64 nodeId, bool decline) external returns (int64 responseCode);
}
```

### Authorization (security model)

A staking mutation on an account is authorized only when the smart-contract security model would
authorize a `CryptoUpdate` / `ContractUpdate` of that account's staking fields:

- A contract calling on its **own** account (`IHRC632(address(this))`, or `0x16a` with
  `account == msg.sender` in the executing frame) is inherently authorized for its own account — no
  additional signature is required, exactly as a contract may approve HBAR allowances on its own
  behalf under HIP-906.
- Any call targeting a **different** account must be authorized by that account's key having signed
  the top-level transaction; absent that signature the call returns `INVALID_SIGNATURE (7)`.

### Response codes

The functions reuse the existing `ResponseCodeEnum`. Relevant codes:

| Code | Name                          | When                                                                         |
| ---- | ----------------------------- | ---------------------------------------------------------------------------- |
| 22   | `SUCCESS`                     | The staking configuration was applied.                                       |
| 7    | `INVALID_SIGNATURE`           | The caller is not authorized for the target account.                         |
| 13   | `NOT_SUPPORTED`               | The network build does not implement these functions.                        |
| 15   | `INVALID_ACCOUNT_ID`          | The target (or staked-to) account does not exist.                            |
| 321  | `SELF_STAKING_IS_NOT_ALLOWED` | `stakeToAccount` names the account itself.                                   |
| 322  | `INVALID_STAKING_ID`          | The node id or staked-account id is invalid or does not exist.               |
| 323  | `STAKING_NOT_ENABLED`         | Native staking is not enabled on the network.                                |

Consistent with HAS convention, these functions **return** a response code rather than reverting on a
business failure; only a malformed call or an out-of-gas condition reverts.

### Impact on Mirror Node

None beyond existing staking ingestion. Each successful call produces a synthetic
`CryptoUpdate` / `ContractUpdate` child record carrying the changed staking fields, which the mirror
node already ingests and exposes on the account (`staked_node_id`, `staked_account_id`,
`decline_reward`, `stake_period_start`). No schema change is required; the change is observable
through the account's existing staking fields and the child transaction of the contract call.

### Impact on SDK

Minimal and additive. No protobuf or HAPI transaction change, so no SDK regeneration is required.
SDKs should publish the ABI for the new `IHRC632` / `IHederaAccountService` functions and may add
convenience helpers for building these contract calls, mirroring the HIP-906 HBAR-allowance helpers.

## Backwards Compatibility

Fully backward compatible. The change adds new function selectors to existing interfaces at an
existing address; it introduces no new HAPI transaction, alters no existing selector or protobuf
message, and changes no existing behavior. Accounts that never call these functions are unaffected.
On a network build that predates the feature, the new selectors return `NOT_SUPPORTED (13)` (or the
call reverts on an unrecognized selector), so callers can detect availability before relying on it.

## Security Implications

- **Authorization is the crux.** These functions must not let a contract or EOA change the staking of
  an account it does not control. The security model is identical to HIP-906's account mutations: a
  contract is authorized for its own account, and any cross-account call requires the target
  account's signature. Implementations MUST route the mutation through the same authorization checks
  as a HAPI `CryptoUpdate` of the staking fields — this HIP adds an EVM entry point, not a new
  privilege.
- **No new fund-moving capability.** Staking configuration moves no balances; it only changes which
  node an account's existing balance counts toward and whether it accrues rewards. The maximum effect
  of an authorized call is to redirect or decline the caller's own staking rewards.
- **Reduces a worse pattern.** Absent this HIP, contracts that need mutable staking are pushed toward
  holding a ledger-level admin key (which can re-key or delete the contract) purely to sign
  `ContractUpdate`. Providing a keyless, authorization-gated EVM path removes the incentive to grant
  a funds-custody contract that superuser key, which is a net security improvement.
- **`decline_reward` griefing is not possible cross-account** because the reward preference can only
  be changed by the account itself or a signer of the account's key.

## How to Teach This

Document the five operations alongside the existing HIP-906 HBAR-allowance examples, since they share
the `IHRC632` / `IHederaAccountService` structure and the response-code convention. The mental model
for developers: "the account that owns the balance configures its own staking, from the EVM, the same
way it approves its own HBAR allowances." Provide a worked example of a governance-gated custody
contract that calls `IHRC632(address(this)).stakeToNode(nodeId)` and `setDeclineReward(true)` inside
a role-gated function, and note that several calls in one transaction apply atomically.

## Reference Implementation

To be completed before the HIP moves to `Final`. The reference implementation covers the HAS system
contract dispatch for the five functions on both interfaces, the authorization wiring to the existing
`CryptoUpdate` staking path, the synthetic child-record emission, response-code mapping, and gas
schedule, with unit and end-to-end tests (including a contract configuring its own staking with no
admin key, and a rejected cross-account call). A downstream consumer — an HBAR-custody contract —
will exercise the `IHRC632(address(this))` path on testnet: a real transaction that stakes
the contract's balance to a node with `decline_reward = true`, verified via mirror-node queries on the
contract account.

## Rejected Ideas

## Open Issues

- Final gas schedule for the five functions (expected comparable to the HIP-906 `hbarApprove` call).
- Whether to additionally expose read accessors for staking metadata
  (`staked_node_id` / `decline_reward` / `stake_period_start`) on `IHederaAccountService`, or leave
  reads to the mirror node. This HIP scopes to the mutating functions.
- Confirmation of the exact authorization semantics for a contract configuring staking of an account
  other than itself (whether any use case beyond self-configuration is required).

## References

- [HIP-632: Hedera Account Service (HAS) System Contract](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-632.md)
- [HIP-906: Proxy Redirect Contract for Hbar Allowance and Approval](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-906.md)
- [Hedera staking for developers](https://hedera.com/blog/staking-on-hedera-for-developers-back-to-the-basics/)
- `ResponseCodeEnum` staking codes (`SELF_STAKING_IS_NOT_ALLOWED = 321`, `INVALID_STAKING_ID = 322`, `STAKING_NOT_ENABLED = 323`) — hedera-protobufs `services/response_code.proto`
- HAS system-contract address: `0x16a`

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
