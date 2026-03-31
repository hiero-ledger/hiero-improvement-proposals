---
hip: 1068
title: Sponsored Fees
author: Nana Essilfie-Conduah <@Nana-EC>
working-group: Nana Essilfie-Conduah <@Nana-EC>, Greg Scullard <@gregscullard>, Ivan Kavaldzhiev <@IvanKavaldzhiev>, Hendrik Ebbers <@hendrikebbers>, Edward Wertz <@edward-swirldslabs>, Richard Bair <@rbair23>, Tyler <@ty-swirldslabs>
requested-by: Hedera Community
type: Standards Track
category: Service
needs-council-approval: Yes
status: Review
created: 2024-10-25
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1068
updated: 2026-03-31
requires: 336
---

## Abstract

This HIP proposes an expansion to the existing approval and allowance network logic (i.e., `CryptoApproveAllowance`,
`NftAllowance`, and `TokenAllowance` as defined in [HIP-336](https://hips.hedera.com/hip/hip-336)) by allowing any
account on the network to provide allowances that sponsor the payment of fees for another account's submitted
transactions.

Account Alice may assign an HBAR or token transaction fee allowance for EOA account Bob or contract account Carol and
pay the fees due to nodes, the network, and accounts for any transactions they submit — thus allowing Bob or Carol to
have zero balance and still transact on-chain.

This proposal extends the existing Approval and Allowance API by adding the concept of a **scope** that designates the
type of value transfer an allowance applies to. The defined scopes are `CRYPTO_TRANSFER` (existing HIP-336 behavior),
`TRANSACTION_FEE`, `TOKEN_CUSTOM_FEE`, and `GAS_FEE`. This enables fee payments on behalf of another account without
requiring one-off approval for each transaction. The feature enhances flexibility and efficiency in managing transaction
costs, particularly for high-volume and enterprise applications.

## Motivation

Currently, every Hedera transaction requires the submitting account (the payer) to hold sufficient HBAR to cover all
applicable fees — node fees, network fees, service fees, gas fees, and any token custom fees. Every user who wishes to
transact on-chain must first acquire HBAR, which creates significant onboarding friction for Web2 users, enterprise
employees, and dApp end-users who have no familiarity with cryptocurrency wallets or token acquisition.

Existing workarounds include:

1. **Payer account pattern** — A central account submits transactions on behalf of users. This requires the central
   account to hold users' keys or have users pre-sign transactions, introducing key management complexity and security
   risks.
2. **Pre-funding accounts** — Distributing HBAR to every user account before they can transact. This creates operational
   overhead at scale and fragments liquidity.

Neither approach cleanly separates the **identity of the transactor** from the **responsibility for payment**. HIP-1068
addresses this gap by enabling a native, protocol-level mechanism for fee sponsorship that leverages the existing,
well-understood allowance model from HIP-336.

## User Stories

1. As a **dApp operator**, I want to sponsor the HAPI transaction fees for my users so that they can interact with my
   application without holding HBAR.
2. As an **enterprise administrator**, I want to assign a fee allowance to employee accounts so that they can submit
   consensus messages, token transfers, and other transactions with zero personal balance.
3. As a **token issuer**, I want to sponsor the custom fees on my token so that recipients are not surprised by
   unexpected fee deductions.
4. As a **smart contract platform**, I want to sponsor gas fees for contract interactions so that my users only need to
   sign transactions, not fund them.
5. As a **sponsor**, I want to set a maximum HBAR amount per spender per scope so that I retain budgetary control over
   sponsored fees.
6. As a **user with a sponsored allowance**, I want to explicitly reference my sponsor in the transaction I submit so
   that the network charges the correct account.

## Rationale

The allowance mechanism introduced in HIP-336 has proven to be a robust and well-understood primitive for delegated
value transfers. Rather than introducing entirely new transaction types, this HIP extends that existing model by adding
a **scope** dimension to allowances. This approach:

1. **Minimizes protocol complexity** — Reuses existing `CryptoApproveAllowance` infrastructure and state structures.
2. **Preserves explicit intent** — The spender must explicitly reference a sponsor claim in the transaction body,
   maintaining the principle that the network never infers which allowance to draw from.
3. **Enables granular control** — Sponsors can separately control budgets for HAPI transaction fees, gas fees, and token
   custom fees.
4. **Maintains backwards compatibility** — Existing allowances (which have an implicit `CRYPTO_TRANSFER` scope) continue
   to function identically. The `AllowanceScope` field defaults to `CRYPTO_TRANSFER` when omitted.

## Specification

### Allowance Scope

A new enum `AllowanceScope` is introduced to define which type of fee an allowance may be used for:

```protobuf
/**
 * The scope of an allowance, designating the type of value transfer
 * the allowance applies to.
 */
enum AllowanceScope {
    /**
     * The allowance applies to CryptoTransfer value transfers.
     * This is the default scope and matches existing HIP-336 behavior.
     */
    CRYPTO_TRANSFER = 0;

    /**
     * The allowance applies to HAPI transaction fees (node, network,
     * and service fees) as defined in the network fee schedule.
     *
     * This scope covers the Hiero-specific cost of submitting a
     * transaction. It does NOT include EVM gas fees; those are
     * covered by GAS_FEE.
     */
    TRANSACTION_FEE = 1;

    /**
     * The allowance applies to token custom fees (fixed, fractional,
     * and royalty fees) as defined in HIP-18.
     */
    TOKEN_CUSTOM_FEE = 2;

    /**
     * The allowance applies to EVM gas fees for ContractCall,
     * ContractCreate, and EthereumTransaction operations.
     *
     * Gas is denominated in gas units and settled in HBAR at the
     * prevailing gas-to-tinycent conversion rate. The allowance
     * amount is denominated in tinybar.
     *
     * TRANSACTION_FEE and GAS_FEE are separate concepts:
     *   - TRANSACTION_FEE = the HAPI-level fee from the fee schedule
     *   - GAS_FEE = the EVM execution cost
     * A smart contract call incurs BOTH. A sponsor may cover one,
     * the other, or both via separate allowances.
     */
    GAS_FEE = 3;
}
```

> **Clarification on TRANSACTION_FEE vs GAS_FEE** (resolves reviewer discussion between @IvanKavaldzhiev,
> @hendrikebbers, and @Nana-EC): Gas is an EVM concept representing a proxy for the work the EVM performs. It is
> settled in HBAR and charged to an EOA. The Hedera transaction fee (HAPI fee) is a separate cost assigned to each
> HAPI transaction based on the network fee schedule. Both are ultimately denominated in HBAR, but they are distinct
> cost categories with different calculation methods, and sponsors may wish to cover them independently.

### Modification to Existing Allowance Messages

The existing `CryptoAllowance` and `TokenAllowance` messages are extended with an optional scope field. When the scope
field is not set, the scope defaults to `CRYPTO_TRANSFER`, preserving full backwards compatibility with HIP-336.

```protobuf
message CryptoAllowance {
    /**
     * The account ID of the hbar allowance owner.
     */
    AccountID owner = 1;

    /**
     * The account ID of the hbar allowance spender.
     */
    AccountID spender = 2;

    /**
     * The amount of the spender's allowance in tinybars.
     *
     * A value of int64.MAX_VALUE (9,223,372,036,854,775,807 tinybar)
     * SHALL be interpreted as an unlimited allowance that is not
     * decremented upon use. This is consistent with the existing
     * approvedForAll pattern for NFTs.
     */
    int64 amount = 3;

    /**
     * The scope for which this allowance may be used.
     * If not set, defaults to CRYPTO_TRANSFER (existing behavior).
     */
    AllowanceScope scope = 4;
}

message TokenAllowance {
    /**
     * The token ID of the token allowance.
     */
    TokenID tokenId = 1;

    /**
     * The account ID of the token allowance owner.
     */
    AccountID owner = 2;

    /**
     * The account ID of the token allowance spender.
     */
    AccountID spender = 3;

    /**
     * The amount of the spender's token allowance.
     */
    int64 amount = 4;

    /**
     * The scope for which this allowance may be used.
     * If not set, defaults to CRYPTO_TRANSFER (existing behavior).
     */
    AllowanceScope scope = 5;
}
```

### Transaction Sponsor Claim

A new message allows a transaction submitter to explicitly reference a sponsor's allowance:

```protobuf
/**
 * A claim by the transaction submitter that a sponsor has granted an
 * allowance to cover fees of the specified scope.
 *
 * The sponsor MUST have previously approved an allowance (via
 * CryptoApproveAllowance) for the transaction submitter (spender)
 * with a matching scope and sufficient remaining amount.
 *
 * The sponsor does NOT need to sign the transaction; their prior
 * CryptoApproveAllowance constitutes authorization.
 */
message TransactionSponsorClaim {
    /**
     * The account ID of the sponsor who has granted the allowance.
     */
    AccountID sponsor = 1;

    /**
     * The scope of fees this claim covers.
     */
    AllowanceScope scope = 2;
}
```

### Modification to TransactionBody

The `TransactionBody` message is extended with an optional repeated field for sponsor claims:

```protobuf
message TransactionBody {
    // ... existing fields ...

    /**
     * An optional list of sponsor claims for this transaction.
     *
     * Each claim references a sponsor account and the scope of fees
     * the sponsor covers. If empty, the transaction payer (submitter)
     * pays all fees as usual — this preserves existing behavior.
     *
     * Rules:
     *   - Each scope may appear at most once.
     *   - A claim referencing a scope not applicable to the transaction
     *     type SHALL cause the transaction to fail with
     *     INVALID_SPONSOR_CLAIM.
     *   - Duplicate scopes SHALL cause the transaction to fail with
     *     DUPLICATE_SPONSOR_SCOPE.
     */
    repeated TransactionSponsorClaim sponsor_claims = <next_field_number>;
}
```

### Claim Processing Rules

1. **Explicit intent required**: The network SHALL NOT automatically draw from any allowance. The spender MUST include a
   `TransactionSponsorClaim` in the transaction body to utilize a sponsor's allowance. This is consistent with the
   existing `is_approval` flag on `CryptoTransfer` and the existing ERC `transferFrom` pattern on Hedera.

2. **Empty claims list = existing behavior**: When `sponsor_claims` is empty, the transaction submitter pays all fees
   from their own balance — exactly as today. There is no implicit payer field; the absence of claims indicates the
   submitter is the payer.

3. **Scope applicability validation**: The network SHALL reject a transaction with `INVALID_SPONSOR_CLAIM` if a sponsor
   claim references a scope that does not apply to the transaction type. For example:
   - A `GAS_FEE` claim on a `ConsensusSubmitMessage` — invalid (no EVM gas incurred).
   - A `TOKEN_CUSTOM_FEE` claim on a `ContractCall` that incurs no custom fees — invalid.
   
   This strictness preserves forward compatibility, per @rbair23's recommendation: "if we start off loose, we cannot
   tighten it."

4. **Sponsor balance validation**: If a sponsor's balance is insufficient to cover the fee for the claimed scope, the
   transaction SHALL fail with `INSUFFICIENT_SPONSOR_BALANCE`.

5. **Allowance sufficiency validation**: If the sponsor's remaining allowance for the spender and scope is insufficient,
   the transaction SHALL fail with `INSUFFICIENT_SPONSOR_ALLOWANCE`.

6. **Full sponsorship per scope**: Sponsorship is complete within a scope — a sponsor must cover the full fee for the
   claimed scope. Partial sponsorship within a single scope (splitting between sponsor and submitter) is not supported.

7. **One claim per scope**: A transaction MAY include multiple sponsor claims with **different** scopes (e.g.,
   `TRANSACTION_FEE` from Alice and `GAS_FEE` from Carol on a `ContractCall`). A transaction SHALL NOT include more
   than one claim for the **same** scope; doing so fails with `DUPLICATE_SPONSOR_SCOPE`.

8. **Signature requirements**: The sponsor does NOT need to sign the sponsored transaction. Authorization was established
   when the sponsor submitted `CryptoApproveAllowance`. The spender (transaction submitter) signs the transaction as
   usual.

9. **Allowance decrement**: Upon successful transaction execution, the sponsor's allowance for the spender and scope
   SHALL be decremented by the fee amount charged, unless the allowance is unlimited (`int64.MAX_VALUE`).

### Scope Definitions and Applicability

| Scope | Applies To | Description |
|---|---|---|
| `CRYPTO_TRANSFER` | `CryptoTransfer` | Standard value transfer. Existing HIP-336 behavior. Scope field is optional and defaults here. |
| `TRANSACTION_FEE` | All transaction types | Covers HAPI node, network, and service fees as defined in the network fee schedule. |
| `TOKEN_CUSTOM_FEE` | Token transfers involving tokens with custom fee schedules (HIP-18) | Covers fixed, fractional, and royalty custom fees. |
| `GAS_FEE` | `ContractCall`, `ContractCreate`, `EthereumTransaction` | Covers EVM gas fees. Allowance amount is denominated in tinybar. |

### TRANSACTION_FEE and GAS_FEE Interaction for Smart Contract Transactions

Smart contract transactions (`ContractCall`, `ContractCreate`) incur both HAPI transaction fees and EVM gas fees.
These are separate costs, both settled in HBAR:

- **`TRANSACTION_FEE`** covers the HAPI-level node, network, and service fees.
- **`GAS_FEE`** covers the EVM execution cost.

A sponsor MAY provide allowances for one or both scopes. The following combinations are valid for a `ContractCall`
(addresses @rbair23's five scenarios):

| Claims Present | HAPI Fee Paid By | Gas Fee Paid By | Notes |
|---|---|---|---|
| None | Submitter | Submitter | Existing behavior, unchanged. |
| `TRANSACTION_FEE` only | Sponsor | Submitter | Submitter must have HBAR for gas. |
| `GAS_FEE` only | Submitter | Sponsor | Submitter must have HBAR for HAPI fee. |
| `TRANSACTION_FEE` + `GAS_FEE` (same sponsor) | Sponsor | Sponsor | Fully sponsored execution. |
| `TRANSACTION_FEE` + `GAS_FEE` (different sponsors) | Sponsor A | Sponsor B | Each scope billed independently. |
| `GAS_FEE` + `TOKEN_CUSTOM_FEE` | Invalid | — | Fails: `TOKEN_CUSTOM_FEE` not applicable to `ContractCall`. |

### EVM Tooling Compatibility

For transactions submitted via `EthereumTransaction` (e.g., through the JSON-RPC Relay using
`eth_sendRawTransaction`), the Ethereum transaction format does not natively support sponsor claims.

The following approach is specified:

- The JSON-RPC Relay MAY accept an extension parameter (outside the signed Ethereum payload) to specify sponsor claims.
- The relay populates the `sponsor_claims` field on the wrapping `EthereumTransaction` HAPI transaction body.
- Consensus node behavior is unchanged — it validates claims on the HAPI `TransactionBody` as with any other
  transaction type.

> **Open Question**: The exact relay-level integration mechanism is deferred to the reference implementation phase and
> may be addressed in a companion HIP if deeper protocol changes are needed. The current specification ensures all EVM
> tooling changes remain at the relay layer without impacting consensus.

### New Response Codes

```protobuf
enum ResponseCodeEnum {
    // ... existing codes ...

    /**
     * A sponsor claim referenced a scope that is not applicable
     * to the transaction type.
     */
    INVALID_SPONSOR_CLAIM = <next_code>;

    /**
     * The sponsor account does not have sufficient balance to cover
     * the fee for the claimed scope.
     */
    INSUFFICIENT_SPONSOR_BALANCE = <next_code>;

    /**
     * The sponsor's allowance for the spender and scope is
     * insufficient to cover the fee.
     */
    INSUFFICIENT_SPONSOR_ALLOWANCE = <next_code>;

    /**
     * The transaction contains multiple sponsor claims for the
     * same scope.
     */
    DUPLICATE_SPONSOR_SCOPE = <next_code>;
}
```

### Mirror Node API Changes

The existing mirror node allowance endpoints SHALL be extended to include scope information.

**`GET /api/v1/accounts/{id}/allowances/crypto`**

Each allowance entry will include a `scope` field:

```json
{
  "allowances": [
    {
      "owner": "0.0.1000",
      "spender": "0.0.2000",
      "amount": 500000000,
      "scope": "CRYPTO_TRANSFER",
      "timestamp": { "from": "1234567890.000000001", "to": null }
    },
    {
      "owner": "0.0.1000",
      "spender": "0.0.2000",
      "amount": 100000000,
      "scope": "TRANSACTION_FEE",
      "timestamp": { "from": "1234567890.000000002", "to": null }
    },
    {
      "owner": "0.0.1000",
      "spender": "0.0.2000",
      "amount": 50000000,
      "scope": "GAS_FEE",
      "timestamp": { "from": "1234567890.000000003", "to": null }
    }
  ]
}
```

An optional query parameter `scope` SHALL be supported to filter allowances:

```
GET /api/v1/accounts/{id}/allowances/crypto?scope=TRANSACTION_FEE
GET /api/v1/accounts/{id}/allowances/crypto?scope=GAS_FEE
```

### System Contract (Precompile) Support

To support smart contract interactions with sponsored fee allowances, the following system contract functions are
specified in the `IHRC1068` interface:

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.4.9 <0.9.0;

interface IHRC1068 {

    /// @notice Approve an HBAR allowance for a spender with a specific scope.
    /// @param spender The account to receive the allowance.
    /// @param amount The allowance amount in tinybar.
    /// @param scope The AllowanceScope value
    ///   (0=CRYPTO_TRANSFER, 1=TRANSACTION_FEE, 2=TOKEN_CUSTOM_FEE, 3=GAS_FEE).
    /// @return responseCode The response code from the Hedera network.
    function hbarApproveWithScope(
        address spender,
        int64 amount,
        uint8 scope
    ) external returns (int64 responseCode);

    /// @notice Get the HBAR allowance for a spender with a specific scope.
    /// @param owner The owner of the allowance.
    /// @param spender The spender of the allowance.
    /// @param scope The AllowanceScope value.
    /// @return responseCode The response code from the Hedera network.
    /// @return amount The remaining allowance amount in tinybar.
    function hbarAllowanceWithScope(
        address owner,
        address spender,
        uint8 scope
    ) external returns (int64 responseCode, int64 amount);
}
```

### Transaction ID Semantics

The transaction ID takes the form `<accountId>@<validStartTime>`. Historically the `accountId` signifies the user who
both submitted and paid for the transaction. With the changes from this HIP, the `accountId` value in the transaction
ID of a sponsored transaction refers only to the **submitter** — not necessarily the payer.

The payer(s) for each fee scope are determined by the `sponsor_claims` field in the `TransactionBody`. When
`sponsor_claims` is empty, the `accountId` in the transaction ID continues to represent both the submitter and the
payer, preserving existing semantics.

## Backwards Compatibility

This HIP is fully backwards compatible with the existing allowance structure defined in HIP-336:

1. **Existing allowances are unaffected.** All allowances created prior to this HIP carry an implicit scope of
   `CRYPTO_TRANSFER`. The new `AllowanceScope` field on `CryptoAllowance` and `TokenAllowance` defaults to
   `CRYPTO_TRANSFER` (enum value `0`) when not set — this is the protobuf default for an unset enum. Existing
   allowances function identically without any migration or update.

2. **Existing transactions are unaffected.** The `sponsor_claims` field on `TransactionBody` is a new, optional,
   repeated field. Existing transactions that do not include this field behave exactly as they do today — the
   transaction submitter pays all fees. An empty `sponsor_claims` list is semantically identical to no list at all.

3. **No changes to CryptoTransfer behavior.** The existing `is_approval` flag on `AccountAmount` within
   `CryptoTransfer` continues to function as before. The `CRYPTO_TRANSFER` scope simply makes the existing implicit
   scope explicit in the data model.

4. **No changes to CryptoDeleteAllowance.** NFT allowance deletion continues to work as defined in HIP-336. To remove
   an HBAR or fungible token allowance of any scope, submit a `CryptoApproveAllowance` with `amount = 0` for the
   desired scope.

5. **Allowance limits.** The existing limit of 100 allowances per account (spanning HBAR, fungible token, and
   approved-for-all NFT allowances) now spans all scopes. Each unique `(owner, spender, scope)` tuple counts as one
   allowance toward this limit.

6. **Protobuf wire compatibility.** Adding new fields to existing messages and a new enum value is wire-compatible with
   older clients. Older clients and SDKs will simply ignore the new fields. No breaking changes are introduced to any
   existing protobuf message.

There are no changes to existing allowance concepts beyond the addition of the `scope` field, so there should be no
regression in functionality for any currently-deployed application.

## Security Considerations

1. **Allowance draining.** A malicious spender could submit many small transactions to drain a sponsor's allowance. This
   is mitigated by the sponsor setting a finite allowance amount and monitoring usage via the mirror node API. Sponsors
   SHOULD set the minimum allowance necessary and review balances regularly.

2. **Scope mismatch attacks.** A spender cannot repurpose a `CRYPTO_TRANSFER` allowance to pay `TRANSACTION_FEE` or
   vice versa. Scopes are strictly validated at the consensus level.

3. **Daisy-chaining is NOT supported.** If Alice grants an allowance to Bob, and Bob grants an allowance to Carol in the
   same scope, Carol CANNOT draw from Alice's allowance through Bob. Each allowance is a direct, non-transitive
   relationship between owner and spender. This was explicitly considered and rejected (see *Rejected Ideas*) because
   transitive claims introduce state complexity (cycle detection, depth limits) and security risk (a compromise of Bob
   cascading to drain Alice).

4. **Sponsor does not sign transactions.** The sponsor trusts the spender to use the allowance responsibly within the
   approved limit. The sponsor can revoke the allowance at any time via `CryptoApproveAllowance` with `amount = 0`.

5. **Gas price volatility.** For `GAS_FEE` allowances, the allowance is denominated in tinybar, but the effective gas
   budget fluctuates with the gas-to-tinycent conversion rate. Sponsors should account for price variability when
   setting allowance amounts.

## Rejected Ideas

### Separate Transaction Types for Fee Sponsorship

An earlier version of this HIP proposed new, distinct transaction types (e.g., `CryptoApproveTransactionFeeAllowance`,
`CryptoApproveGasFeeAllowance`). This was rejected in favor of adding a scope field to the existing allowance messages
— a simpler approach that avoids API proliferation and leverages existing infrastructure.

### Implicit Allowance Selection (Auto-Draw on Zero Balance)

It was proposed that the network should automatically draw from a sponsor's allowance when the spender's balance is
zero. This was rejected because:

- It is inconsistent with the existing explicit-intent model (`is_approval` flag, ERC `transferFrom`).
- A spender may have multiple sponsors; the network cannot infer which one to use.
- Different users may have different off-chain policies; it is not appropriate for the network to assume intent.
- It would silently change the behavior of existing transactions in unexpected ways.

### Daisy-Chained (Transitive) Allowances

It was proposed that if Alice sponsors Bob, and Bob sponsors Carol, then Carol should be able to transitively claim from
Alice's allowance through Bob. This was rejected because:

- It introduces significant state complexity (loop detection, depth limits).
- It creates a security risk: compromising Bob's account could drain Alice's funds.
- The legitimate use case (Org A sponsors Org B's employees) can be achieved by having Org A directly sponsor the
  employees, or by having Org B fund a separate treasury for employee sponsorship.

### Contract-Specific Gas Allowances

It was proposed that a sponsor should be able to restrict gas allowances to specific smart contracts (e.g., "Alice
sponsors Bob for up to 100 HBAR of gas, but only for contract 0.0.1234"). This was deemed out of scope for this HIP
because it adds a new dimension of per-contract state management that significantly increases complexity. This feature
may be explored in a future HIP or through the Hooks mechanism proposed in [HIP-1195](https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1195).

### Hooks / Lambdas as a Full Replacement

[HIP-1195](https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1195) (Hooks) was proposed as an
alternative that could subsume HIP-1068's functionality. After extensive community discussion, the consensus was that
the two are **complementary, not mutually exclusive**:

- Hooks add gas costs to every transaction, which may be economically prohibitive for high-throughput use cases (e.g.,
  HCS messaging at $0.0001 per message).
- Hooks require smart contract development expertise, raising the barrier to entry.
- Hooks shift the security onus to the payer (contract correctness), whereas HIP-1068 provides protocol-level
  security guarantees.
- Hooks still require users to acquire some HBAR initially to pay for the hook's gas, then be reimbursed — they
  cannot enable truly zero-balance transacting from day one.

HIP-1068 provides a simple, cost-efficient sponsorship primitive at the protocol level. Hooks provide programmable,
extensible logic for advanced use cases. Both should exist.

## Open Issues

- **EVM tooling integration**: How should EVM tools (e.g., MetaMask via JSON-RPC Relay) utilize the ability to sponsor
  gas fees via `eth_sendRawTransaction`? The Ethereum transaction format does not support additional fields. A
  relay-level solution or companion HIP may be needed. The current specification ensures consensus node behavior is
  unchanged.

- **Gas allowance denomination**: Should `GAS_FEE` allowances be denominated in gas units (allowing sponsors to budget
  in EVM-native terms) or in tinybar (allowing sponsors to budget in HBAR terms)? The current specification uses
  tinybar for consistency with other allowance types, but this means the effective gas budget varies with gas price.
  Community input is welcome.

## Reference Implementation

The reference implementation will be tracked in the following repositories:

- **Consensus node**: [hiero-ledger/hiero-consensus-node](https://github.com/hiero-ledger/hiero-consensus-node)
- **Protobufs**: [hiero-ledger/hiero-protobufs](https://github.com/hiero-ledger/hiero-protobufs)
- **Mirror node**: [hiero-ledger/hiero-mirror-node](https://github.com/hiero-ledger/hiero-mirror-node)

## Copyright/License

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <http://www.apache.org/licenses/LICENSE-2.0>