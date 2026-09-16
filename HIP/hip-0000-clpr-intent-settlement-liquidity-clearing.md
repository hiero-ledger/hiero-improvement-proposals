---
hip: 0000
title: CLPR Intent Settlement and Liquidity Clearing Standard
author: Schayan Salehi (@shayansal)
working-group:
requested-by:
discussions-to:
type: Standards Track
category: Application
needs-hiero-approval: No
needs-hedera-review: No
status: Draft
created: 2026-09-02
updated: 2026-09-02
requires: 1535
replaces:
superseded-by:
release:
---

## Abstract

This HIP defines an intent-based settlement and liquidity-clearing application for the Cross Ledger Protocol
(CLPR) specified by HIP-1535. A user signs a desired economic outcome instead of prescribing a bridge and route.
Competing solvers may satisfy that outcome using inventory, market venues, canonical asset adapters, or composed
routes. A solver that performs the destination action receives a typed `FillReceipt`; a CLPR proof of that receipt
settles source escrow exactly once.

The standard separates user settlement from solver inventory rebalancing. Users receive the signed minimum outcome
without depending on a later netting cycle. Solvers may subsequently compress mutual obligations in a
collateralized clearing layer, so only net inventory moves across ledgers. Objective exposure limits, withdrawal
delays, default waterfalls, congestion controls, and public accounting keep efficiency gains from becoming hidden
credit risk.

The protocol is permissionless at its base while supporting issuer, jurisdiction, and institutional policy lanes.
It does not require a protocol token, a particular auction, or a globally trusted coordinator. A deployment may use
Hedera for order discovery, collateral, clearing, audit records, and fee payment, while preserving open adapters
and network-neutral order semantics. The objective is deeper executable liquidity, faster fills, and higher
capital velocity across ledgers without weakening CLPR's trust-minimized verification model.

## Motivation

Messaging alone does not create liquidity. A user moving value between ledgers otherwise must choose a bridge,
wrapped asset, route, relayer, gas strategy, and slippage limit. Each choice fragments order flow and forces
liquidity providers to pre-fund isolated pools. The resulting system can have substantial total value locked but
little executable depth for a particular asset, size, destination, and deadline.

Outcome-based intents invert this model. The user specifies what must be received and the conditions under which
source value may be released. Solvers compete over how to deliver it. This permits:

- direct inventory fills without waiting for a canonical transfer;
- aggregation across exchanges, AMMs, RFQ systems, issuers, and asset adapters;
- gas sponsorship and fee payment in the user's source asset;
- route competition without giving an aggregator custody;
- atomic delivery-versus-payment for supported asset pairs;
- later netting of solver obligations instead of gross rebalancing after every fill; and
- specialized compliance lanes without imposing one policy on all CLPR traffic.

The financial benefit can be large, but only if the settlement proof, solver incentives, credit exposure, partial
fills, and failure handling are standardized. A proprietary solver API or a central matching engine would recreate
the same fragmentation and concentrate trust.

## Rationale

**Outcome commitments minimize user assumptions.** The signed order commits to the minimum output, recipient,
deadline, permitted destinations, security profile, and call behavior. Route selection remains a solver concern.

**Destination-first execution gives the solver temporal risk.** Source escrow settles only after proof of a valid
destination fill. The user does not accept an IOU merely because a source message was sent.

**User settlement and solver rebalancing are separate.** A completed fill is final for the user. A clearing-cycle
failure can affect solver collateral or future participation but cannot reverse a valid user receipt.

**Netting is an optimization, not a solvency claim.** The clearing layer publishes gross obligations, net
obligations, collateral, haircuts, and defaults. It never labels undercollateralized credit as trustless liquidity.

**Open standards grow the market.** Common order and receipt formats let wallets, issuers, solvers, market makers,
and venues connect once. Deployments compete on execution quality instead of order lock-in.

## User stories

- As a **user**, I want to sign the amount I will spend and the minimum result I will receive without selecting a
  bridge or holding destination gas.
- As a **solver**, I want one order and receipt format across ledgers so that inventory and routing software can
  serve many applications.
- As a **market maker**, I want offsetting obligations netted so that capital turns over more often.
- As an **issuer**, I want solvers to prefer my canonical representation and comply with its transfer policy.
- As an **institution**, I want delivery-versus-payment, enforceable counterparties, and exposure limits while
  retaining independently verifiable settlement.
- As an **application**, I want to compare fill rate, price, latency, and concentration rather than advertise TVL.
- As a **network operator**, I want high-value settlement to create sustainable demand for consensus, state proofs,
  token services, and fee payment without requiring a new protocol token.

## Specification

### 1. Roles

- **Intent Owner** — the account authorizing source expenditure.
- **Origin Settler** — the source-ledger application that validates orders, escrows input, and pays successful
  solvers.
- **Destination Settler** — the destination-ledger application that validates fills and writes `FillReceipt`s.
- **Solver** — an entity that provides the destination outcome and claims the corresponding source escrow.
- **Quote Provider** — an optional solver or venue publishing executable terms before order authorization.
- **Adapter** — a registered integration with an asset, exchange, AMM, canonical transfer, payment, or call system.
- **Clearing Member** — a solver that opts into collateralized multilateral netting.
- **Clearing Contract** — an application that records obligations, collateral, net positions, and defaults.
- **Policy Authority** — an optional authority for an explicitly selected compliance or institutional lane.

No role is implicitly trusted by CLPR. A solver earns payment only by presenting a proof accepted under the order's
security profile. A quote or route recommendation does not authorize source expenditure.

### 2. Canonical encoding and domains

Orders, quotes, fills, receipts, and clearing records use deterministic, versioned binary encoding with explicit
field lengths. Implementations MUST reject duplicate fields, ambiguous addresses, non-canonical integers, unknown
required fields, and signatures from another domain.

The signature domain includes:

- protocol name and version;
- origin and destination `LedgerInstanceID`s;
- Origin Settler identifier and executable code hash;
- order owner's account and nonce domain; and
- the selected financial security profile.

Chain identifiers without ledger-instance binding are insufficient because a fork or lookalike network may reuse
the same chain identifier and application address.

### 3. IntentOrder

```text
IntentOrder {
    version
    order_id
    owner
    owner_nonce
    origin_ledger_instance_id
    destination_ledger_instance_id
    origin_settler
    destination_settler
    input_asset_id
    maximum_input_amount
    output_asset_id
    minimum_output_amount
    recipient
    valid_after
    fill_deadline
    settlement_deadline
    partial_fill_policy
    minimum_fill_amount
    maximum_fill_count
    allowed_solver_policy_hash       // optional
    allowed_adapter_set_hash         // optional
    excluded_route_set_hash          // optional
    financial_security_profile_id
    compliance_policy_hash           // optional
    destination_call_target          // optional
    destination_call_data_hash       // optional
    destination_call_mode            // NONE, ATOMIC, or BEST_EFFORT
    destination_call_gas_limit       // optional
    maximum_total_fee
    fee_asset_id
    surplus_policy
    salt
}
```

```text
OrderID = SHA-256("CLPR_INTENT_ORDER_V1" || canonical_order_without_order_id)
```

The owner's signature covers `OrderID`. The Origin Settler verifies the signature, nonce, deadlines, assets,
recipient, security profile, compliance policy, call behavior, and fee ceiling before escrowing input.

`fill_deadline` is the last time a new destination fill may execute. `settlement_deadline` is later and allows a
timely fill proof to reach the origin. Expiry of the settlement deadline does not by itself prove non-execution.

### 4. Partial-fill semantics

`partial_fill_policy` is one of:

- `ALL_OR_NOTHING` — exactly one fill provides at least `minimum_output_amount` and consumes no more than
  `maximum_input_amount`;
- `PRO_RATA` — each fill earns source input according to the order's signed integer ratio; or
- `CURVE` — a content-addressed monotonic pricing function maps cumulative output to maximum cumulative input.

For partial orders, accounting is cumulative rather than independently rounded per fill:

```text
maximum_cumulative_input(o) = floor(
    cumulative_output(o) * maximum_input_amount / minimum_output_amount
)

input_due_for_fill = maximum_cumulative_input(after) - input_already_settled
```

The final fill may take only the signed residual. Implementations MUST bound fill count and minimum fill size so an
attacker cannot create unbounded state or rounding dust. A destination receipt that would exceed the cumulative
output, input, fee, or fill-count bound is rejected.

### 5. Order funding and lifecycle

Funding an order atomically reserves `maximum_input_amount + maximum_total_fee`, consumes the owner's nonce, and
records the signed order hash. Permit-style authorization may be used only when replay protection is bound to the
Origin Settler and ledger instance.

| State | Meaning |
|---|---|
| `OPEN` | Funded and eligible for a new destination fill. |
| `PARTIALLY_FILLED` | At least one fill settled and signed capacity remains. |
| `FILLED` | The required outcome is complete; no new fill is accepted. |
| `CANCEL_REQUESTED` | Owner requested cancellation; already executed fills may still settle. |
| `CANCELLED` | Final non-execution evidence closes all remaining capacity. |
| `EXPIRED_PENDING_PROOFS` | Fill deadline passed; timely receipts may still settle. |
| `SETTLED` | All successful receipts and refunds are accounted for. |
| `QUARANTINED` | Bound Channel, settler, adapter, or verifier is suspected; automatic settlement and refund stop. |

Cancellation stops new destination fills only after a final cancellation record is available to the Destination
Settler. Source-side cancellation alone cannot release capacity that a solver may already have filled.

### 6. Solver discovery and quotes

Discovery may use public order books, gossip, RFQ systems, auctions, wallet-selected endpoints, or direct submission.
No particular coordinator is required for validity. A quote is advisory until the user signs an order or the quote
is itself a solver-signed firm commitment accepted by that order.

```text
SolverQuote {
    order_template_hash
    solver_id
    quoted_input
    quoted_output
    solver_fee
    valid_until
    route_commitment_hash
    quote_nonce
    collateral_lane_id       // optional
}
```

Commit-reveal auctions MAY hide routes or prices before a short reveal window. They MUST bind the commitment to the
auction instance, order template, solver, quote, and salt. Auction failure never changes the validity of a directly
submitted conforming fill.

Applications SHOULD rank quotes by executable output after all fees, expected latency, security profile, historical
fill reliability, and concentration. Preferential ordering or rebates must be disclosed. Historical performance is
not a substitute for proof verification.

### 7. Destination execution and FillReceipt

A solver executes the required destination transfer or call and requests an on-ledger receipt from the Destination
Settler. Asset delivery and receipt creation MUST be atomic.

```text
FillReceipt {
    version
    receipt_id
    order_id
    fill_index
    solver_id
    solver_origin_payout_account
    destination_ledger_instance_id
    destination_settler
    output_asset_id
    output_amount
    recipient
    destination_transaction_id
    destination_consensus_time
    cumulative_output_filled
    destination_call_result_hash    // optional
    compliance_result_hash          // optional
    adapter_trace_root
}
```

```text
ReceiptID = SHA-256("CLPR_INTENT_FILL_V1" || canonical_receipt_without_receipt_id)
```

Before writing a receipt, the Destination Settler verifies:

1. the order signature, ledger instances, settler hashes, nonce domain, and deadline;
2. that the order and fill have not been cancelled, completed, or replayed;
3. exact recipient, output asset, amount, cumulative fill, and call semantics;
4. allowed solver, adapter, route, compliance, and financial security policies;
5. that the asset operation and any `ATOMIC` call succeeded in the same transaction; and
6. that `solver_origin_payout_account` is bound to the authenticated solver.

A duplicate identical fill returns the existing receipt. A conflicting use of the same order capacity or fill index
is rejected.

### 8. Source settlement

The solver or any relayer sends the receipt through the order-bound CLPR Channel. The Origin Settler independently
verifies the CLPR proof, financial security profile, destination instance, settler code hash, receipt schema,
deadline, order state, and cumulative accounting.

Upon success, it atomically:

1. records `ReceiptID` as consumed;
2. advances cumulative output and input accounting;
3. pays `input_due_for_fill` to the receipt-bound solver account;
4. pays no more than the signed fee allocation; and
5. updates or closes the order.

Receipt submission is permissionless. A relayer cannot redirect solver payment. The owner cannot revoke a valid
receipt after the destination outcome has executed.

Unused escrow is refundable only after remaining destination capacity is finally cancelled or otherwise proven
non-executable under the registered recovery procedure. Missing messages or a local timeout is insufficient.

### 9. Fees, gas sponsorship, and surplus

The signed order states the fee asset and `maximum_total_fee`. Fees may include solver compensation, destination
gas, CLPR relay reimbursement, adapter fees, auction fees, and clearing fees. The settlement record itemizes each
component. No component may be added after authorization.

A solver may sponsor destination gas and recover it within the signed fee ceiling. A deployment may accept the
input asset, HBAR, or another registered asset for fees; the base protocol requires no mandatory token.

If execution produces more than `minimum_output_amount`, `surplus_policy` determines whether the recipient receives
all surplus, the solver receives a disclosed share, or the parties split it by a signed formula. Undisclosed or
operator-discretionary surplus capture is prohibited.

### 10. Adapter registry and route composition

Adapters publish content-addressed records containing supported ledger instances, assets, executable code hashes,
upgrade policies, financial security profile, capacity, fees, call semantics, and compliance capabilities. Registry
inclusion is a claim, not an endorsement.

A composed route commits to an `adapter_trace_root` that lets the selected policy verify every value-bearing hop.
An implementation MUST NOT silently downgrade the security profile or replace a canonical asset with a synthetic
representation. User settlement depends only on the final destination receipt, but route metadata remains available
for policy, audit, and dispute analysis.

Adapters SHOULD support the CLPR Canonical Asset Transfer Standard. Gateways MAY translate ERC-7683 orders and
receipts or use ERC-7786 messaging interfaces when the translation is deterministic and the original signature,
deadlines, ledger-instance binding, and security profile are preserved.

### 11. Congestion and fair access

Permissionless solvers must not be able to monopolize finite CLPR Channel or settler capacity with low-value orders.
Deployments implement objective, public controls including:

- per-owner and per-solver pending-order and proof quotas;
- minimum economically meaningful fill sizes;
- bounded order, fill, and receipt lifetimes;
- fee floors or auctions when verified capacity is scarce;
- stake or refundable anti-spam bonds for discovery, never as a substitute for fill proof;
- separate queues for settlement, cancellation, and emergency control messages; and
- caps on any solver's share of executable flow where concentration creates operational risk.

Priority rules MUST be deterministic or publicly auditable. An emergency message cannot be starved by fee bidding.

### 12. Solver collateral and bilateral credit

Destination-first fills need no solver collateral for ordinary user settlement: the solver has already delivered
before receiving source funds. Collateral becomes relevant for firm quotes, delegated execution, optimistic paths,
inventory lending, or clearing obligations.

Each collateral lane publishes:

- accepted collateral assets and valuation sources;
- conservative haircuts and stale-price behavior;
- per-member, per-asset, per-ledger, and aggregate exposure limits;
- margin calculation and call frequency;
- withdrawal delay exceeding the maximum challenge and settlement horizon;
- objective slash conditions and proof formats;
- liquidation mechanism and price-impact controls; and
- governance, upgrade, and emergency authority.

Only objectively provable violations may be slashed automatically. Service-quality disputes use a separately
defined adjudication process and cannot seize collateral through an administrator's unreviewable assertion.

### 13. Multilateral liquidity clearing

Clearing Members may novate or register solver-to-solver inventory obligations after user fills. During epoch `e`,
the Clearing Contract records every gross obligation:

```text
Obligation {
    obligation_id
    epoch
    debtor
    creditor
    ledger_instance_id
    asset_id
    amount
    originating_receipt_ids_root
    maturity
    collateral_lane_id
}
```

For each member `m`, ledger `l`, and asset `a`:

```text
net_position(m,l,a) = incoming_obligations(m,l,a) - outgoing_obligations(m,l,a)
```

After the epoch closes and a challenge window expires, only net debtors rebalance net creditors. The contract emits
the gross-obligation root, net-position root, collateral snapshot, valuation time, and settlement result. Anyone
can recompute the net positions from the committed obligations.

Netting MUST satisfy:

- conservation: sum of all member net positions for an asset and ledger is zero;
- no cross-asset substitution without an explicit, priced conversion trade;
- no use of collateral or obligations from another legal or compliance lane;
- bounded exposure before an obligation is accepted;
- deterministic treatment of rounding residuals; and
- final user receipts remain valid regardless of clearing outcome.

The default waterfall is applied in this order unless a lane discloses a stricter policy:

1. defaulting member's pending credits;
2. defaulting member's posted collateral;
3. defaulting member's funded guarantee contribution;
4. a separately capitalized mutualized guarantee fund;
5. assessment of non-defaulting members within a precommitted cap; and
6. loss allocation and lane halt under a published recovery rule.

Administrative discretion cannot skip the waterfall or retroactively increase a member's maximum loss. Clearing is
disabled when valuation data is stale, collateral is insufficient, reconciliation fails, or the bound Channel is
quarantined.

### 14. Institutional DvP and PvP lanes

A policy lane may require identified counterparties, transfer-agent approval, trading windows, jurisdictional
attestations, or bilateral credit agreements. These restrictions are explicit in the order and lane identifier.

Delivery-versus-payment (DvP) uses one destination transaction or verifiable application state transition that
atomically exchanges the asset and payment. Payment-versus-payment (PvP) similarly exchanges two currencies under
one committed settlement condition. If the two legs cannot execute atomically on one ledger, a solver may assume
principal risk and settle each user only after delivering that user's signed outcome; the protocol MUST NOT label
the sequence atomic.

### 15. Privacy and information leakage

Public intents can expose size, destination, deadlines, and willingness to pay. Deployments MAY use encrypted order
flow, threshold decryption, private RFQs, batch auctions, or zero-knowledge compliance attestations. Any privacy
mechanism must preserve public verification of settlement and must not give the decryption operator custody or the
ability to alter signed terms.

Solver routes may remain committed until execution, but the final `adapter_trace_root`, receipt, fees, and required
policy evidence remain auditable. Personally identifying compliance data SHOULD remain off-ledger.

### 16. Administration, upgrade, and emergency behavior

Settler, adapter, auction, and clearing code hashes and upgrade authorities are part of their registrations. An
upgrade creates a new version and activation epoch; orders remain bound to the version they signed unless they
explicitly authorize migration.

Normal deprecation stops new orders, preserves receipt settlement, finalizes cancellations, and then releases
remaining escrow. Suspected verifier, settler, adapter, or collateral compromise triggers immediate quarantine.
Quarantine blocks new fills, automated source payouts, refunds, netting, collateral withdrawals, and configuration
changes except a narrowly scoped recovery procedure. It never routes pending value through the suspected verifier
to decide whether that same value is safe.

### 17. Network-neutral deployment and Hedera value capture

The order and receipt standards are network-neutral. A Hedera deployment can nevertheless host economically useful
coordination functions:

- consensus-ordered intent discovery and batch auctions;
- solver, adapter, asset, and policy registries;
- HBAR or HTS collateral and fee escrow;
- low-cost fill, receipt, quote, and clearing audit records;
- canonical asset issuance and representation administration through HTS;
- multilateral clearing and guarantee funds; and
- proof-indexed analytics through Mirror Nodes.

This design captures value through recurring settlement, registry, token, collateral, and data activity rather than
through a compulsory bridge token. HBAR MAY be a preferred fee or collateral asset in a Hedera deployment, subject
to disclosed haircuts and concentration limits, but interoperability does not depend on owning it.

### 18. Success metrics

Deployments SHOULD publish comparable, manipulation-resistant metrics by asset, route, ledger, and order size:

- executable depth within stated slippage and latency bounds;
- order and notional fill rate;
- median and p95 time to destination fill and source settlement;
- realized price and fees versus signed minimum and reference market;
- solver capital velocity and gross-to-net rebalancing ratio;
- proof, cancellation, and recovery failure rates;
- solver and venue concentration;
- collateral coverage, margin breaches, and realized losses; and
- uptime under verifier, relayer, and destination stress.

TVL, message count, and quoted depth alone are insufficient because they do not show whether users can execute at a
competitive price or whether the same capital supports repeated settlement.

### 19. Impact on Mirror Node

Mirror Nodes SHOULD index orders, quotes where public, fills, receipts, cancellations, fees, settler and adapter
versions, collateral, gross obligations, net positions, margin events, defaults, waterfall use, and quarantine
events. APIs must retain the ledger instance, code hash, policy version, and consensus time applicable to each
historical record.

### 20. Impact on SDK

SDKs SHOULD implement canonical encoding, typed signing, order simulation, quote normalization, executable-price
comparison, partial-fill arithmetic, receipt construction and verification, solver payout binding, cancellation
proofs, adapter discovery, and clearing reconciliation. Wallets MUST show minimum received, maximum spent, all fees,
recipient, destination, deadline, call behavior, asset authority, and security profile before signing.

## Backwards Compatibility

This HIP is opt-in and does not change arbitrary CLPR messaging. Existing solver networks, RFQ systems, and bridges
may expose conforming adapters while retaining their internal routing. Legacy orders cannot be treated as conforming
unless their signatures commit to all required safety fields.

Applications may translate other intent standards at a gateway, but the gateway must not infer missing security,
ledger-instance, cancellation, fee, or recipient semantics. If lossless translation is impossible, it creates a new
order that the owner signs explicitly.

## Security Implications

- **A forged receipt steals source escrow.** Receipt settlement must use the order-bound CLPR verifier, authenticated
  ledger instances, settler code hashes, and a financial security profile with bounded exposure.
- **Timeout refunds can pay both user and solver.** Refund requires final non-execution evidence or reconciled
  recovery, not silence or a wall-clock timeout.
- **Partial-fill arithmetic can overpay.** Cumulative integer accounting, bounded fill counts, and invariant tests
  are mandatory.
- **Solver substitution can redirect payment.** The destination receipt binds the authenticated solver to an exact
  source payout account.
- **Arbitrary destination calls add reentrancy and approval risk.** Calls are signed, gas-bounded, target-bound, and
  explicitly atomic or best-effort; value and replay state update before external interaction.
- **Auctions can censor or leak order flow.** Direct conforming fills remain valid, ordering rules are auditable,
  and private mechanisms preserve signed terms.
- **Netting creates credit contagion.** Exposure caps, collateral, haircuts, withdrawal delays, segregation,
  reconciliation, and a capped default waterfall are required.
- **Price oracles can overstate collateral.** Stale or disputed prices halt new credit and withdrawals; they never
  increase limits by default.
- **A dominant solver can create liveness and pricing risk.** Applications report concentration, preserve open
  entry, and enforce objective capacity controls.
- **Administrative upgrades can change signed assumptions.** Orders bind exact code and policy versions; migration
  requires new authorization.
- **Compliance lanes can become hidden censorship.** Restrictions and authorities are explicit and selected by the
  order; they do not alter unrestricted lanes.

## How to Teach This

An intent is a signed promise from the user: “Spend at most X here if I receive at least Y there.” Solvers compete
to make Y happen. The winner proves the destination receipt through CLPR and then receives X.

The clearing layer is separate. After many user fills, solvers may owe inventory to one another in both directions.
Instead of moving every gross amount, they reconcile the public obligations and move only the difference. Users do
not wait for or bear the risk of that later rebalancing.

## Reference Implementation

A reference implementation should provide:

- deterministic protobuf or XDR schemas and cross-language signing vectors;
- Origin and Destination Settlers for Hiero EVM and at least one external ledger;
- a CLPR Canonical Asset Transfer adapter and one exchange or AMM adapter;
- a permissionless solver with gas sponsorship and receipt relaying;
- an open quote API and a reference batch auction;
- collateral and multilateral-clearing contracts with recomputable netting;
- Mirror Node indexes and a public execution-quality dashboard; and
- property, fuzz, invariant, adversarial-auction, reorganization, quarantine, margin, liquidation, and default tests.

The initial deployment should use strict per-order and aggregate caps, a small solver set with public performance
records, short clearing epochs, overcollateralized credit, and independently audited contracts. Limits may increase
only from observed loss-free capacity, not projected TVL.

## Rejected Ideas

- **One canonical bridge route.** Rejected because it concentrates custody and prevents competition over inventory,
  price, speed, and security.
- **Paying source funds when a solver promises to fill.** Rejected because a promise is not a destination outcome.
- **Automatic refund at deadline.** Rejected because a delayed fill receipt may still represent final delivery.
- **Global atomicity across unrelated ledgers.** Rejected because CLPR proof-based settlement is asynchronous; a
  solver may price temporal risk, but the protocol must not misrepresent it.
- **Mandatory solver staking for every fill.** Rejected because destination-first proof already protects ordinary
  user settlement and indiscriminate staking raises entry barriers. Collateral is scoped to actual credit exposure.
- **Opaque netting by a central operator.** Rejected because hidden gross obligations and discretionary loss
  allocation turn capital efficiency into unmeasurable counterparty risk.
- **A mandatory protocol token.** Rejected because it adds price and governance risk, fragments fees, and discourages
  institutions and issuers. Deployments may use native or registered assets under explicit policy.
- **Optimizing for TVL.** Rejected because idle locked capital is not equivalent to executable liquidity or economic
  throughput.

## Open Issues

- The canonical encoding should follow the final HIP-1535 wire-format decision.
- A future annex should define lossless ERC-7683 field mappings and identify orders that require explicit re-signing.
- Cross-jurisdiction legal finality, novation, and insolvency treatment for clearing lanes require deployment-specific
  legal frameworks and cannot be standardized by code alone.
- Privacy-preserving auctions need comparative evaluation of latency, liveness, and decryption trust.
- Recursive proofs may compress receipt and clearing verification, but must preserve access to base records and a
  safe fallback when the proving system is unavailable.

## References

- [HIP-1535: CLPR](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/spec/HIP/hip-1535.md)
- [ERC-7683: Cross Chain Intents](https://eips.ethereum.org/EIPS/eip-7683)
- [ERC-7786: Cross-Chain Messaging Gateway](https://eips.ethereum.org/EIPS/eip-7786)
- [CAIP-19: Asset Type and Asset ID Specification](https://chainagnostic.org/CAIPs/caip-19)
- [UniswapX Whitepaper](https://uniswap.org/whitepaper-uniswapx.pdf)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
