---
hip: 0000
title: Periodic Holding Fee for Hedera Token Service Fungible Tokens
author: Brandon Hargreaves (@BHargreaves-Twig), Jesse Whiteside (@DLTGroup)
working-group: Adrian Marin (@AdrianKBL), Rafa (@raludi)
requested-by: Bravalta / Kabila
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1500
type: Standards Track
category: Service
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-04-29
updated: 2026-06-22
requires: 18, 336, 540, 904, 1010, 1261
replaces:
superseded-by:
release:
---

## Abstract

This HIP adds `PeriodicHoldingFee` (PHF), a new top-level configuration on fungible Hedera Token Service (HTS) tokens that allows an issuer to periodically debit either a percentage of each non-exempt holder's balance (**fractional mode**) or a flat amount per holder (**fixed mode**), denominated in the token itself, and credit a configured collector account. PHF is time-scoped: a holder owes for the whole cycles elapsed since the relationship's last accrual reset (`last_assessed_at`), whether or not they have transferred.

PHF can be attached to a token only at `TokenCreate`. The mode, the per-cycle cap (basis points in fractional mode, smallest-unit amount in fixed mode), the assessment cadence, and the first assessment time are immutable for the life of the token; the current rate (within the cap), the collector, and the exempt-account list are mutable. Assessment is explicit and signed: an authorized keeper submits `assessTokenPeriodicHoldingFee` transactions against batches of holders, and the balance-changing operations enumerated in this specification perform touch settlement atomically before proceeding. Each settlement is exempt from the token's custom-fee schedule, so a holder's debit is exactly the assessed amount — at most the cap multiplied by the whole cycles elapsed and never more than the balance. No holder registry, no autonomous network work, no cycle-boundary processing, no HBAR reserve, and no per-cycle history is introduced; the only per-holder state is one timestamp on the token relationship HTS already maintains.

## Motivation

Some fungible HTS tokens represent claims with ongoing off-ledger costs — custody, insurance, audit, administration, or regulatory reporting — borne by holders of record rather than only by holders who transfer. Existing custom fees are assessed only during transfers and therefore never reach passive holders.

Without a native mechanism, issuers must use off-ledger billing, smart-contract overlays, or wipe-and-remint flows. Those approaches are hard to audit, do not work uniformly for self-custody, and require operational keys inappropriate for routine fee collection. PHF provides a native, transparent, capped mechanism for periodic holder-paid fees while preserving HTS association, transfer, freeze, pause, custom-fee, and treasury semantics.

## Rationale

- PHF is a top-level token feature with two assessment paths. Explicit assessment (Path A) is issuer-driven and requires a signature by a dedicated `holdingFeeKey`: the protocol provides the primitive — debit a holder under declared, immutable, capped terms — and the issuer (or any authorized keeper) provides scheduling, holder enumeration, and batching off-chain. Touch settlement (Path B) is the minimal residue that remains in consensus: it closes the evasion loop atomically with the operations that move a holder's balance, exactly as transfer-triggered custom fees already do, and performs no scheduling of its own.
- PHF supports two complementary economic models, mirroring HTS custom fees (`FractionalFee` and `FixedFee`): **fractional mode** charges a percentage of the holder's balance per cycle; **fixed mode** charges a flat amount per holder per cycle. Per-cycle math is integer-only in both: `(balance × current_per_cycle_basis_points × cycles_owed) / 10000` for fractional, `current_per_cycle_amount × cycles_owed` for fixed — one multiplication and one integer division, with no exponentiation, no rational-number normalization, and no time-unit conversion constants in consensus, so every node computes byte-identical results. Annualized equivalents are derivable by Mirror Node and SDKs and are presentation-only.
- Accrued cycles are settled together, valued **linearly** at the holder's balance and the current rate in effect at settlement time. Linear valuation keeps consensus math to one multiplication and one division per settlement. Per-cycle compounded valuation is deliberately not used: it would require an iterative loop or fractional exponentiation in consensus, neither of which can be guaranteed to evaluate byte-identically across heterogeneous node hardware and runtimes, and so would put consensus at risk. The clamp to the holder's balance bounds the worst case (see "Per-Cycle Math"). Credit-side touch settlement keeps that valuation honest: a credit carried by the triggering operation's transfer list settles accrued cycles at the pre-credit balance first, so ordinary deposits never inflate previously accrued cycles.
- The mode and its cap are immutable for the life of the token (`max_per_cycle_basis_points` in fractional mode, `max_per_cycle_amount` in fixed mode). The current rate within the established mode (`current_per_cycle_basis_points` or `current_per_cycle_amount`) is mutable strictly within `[0, cap]`. A token cannot switch modes via `TokenUpdate`. The current rate is kept as protocol state — rather than supplied per assessment by a calling contract — because PHF targets bare HAPI tokens with no contract above the line; a single mutable scalar bounded by an immutable cap is the smallest mechanism that lets issuers move pricing without a schedule entity or rate history.
- PHF keeps no list of holders and schedules no autonomous work. The only per-holder state is a single `last_assessed_at` timestamp on the token-relationship record HTS already maintains for every associated account; there is no holder registry, and no state survives for ex-holders, because dissociating (which requires a zero balance) removes the relationship and its timestamp together. A keeper enumerates current holders off-ledger and submits them to `assessTokenPeriodicHoldingFee` as an advisory batch; consensus never walks the holder set on its own. The per-holder fee component (HIP-1261) charges the cost of processing each submitted holder, so enumeration and iteration are paid for by the party that requests them. Accrual is tracked per relationship rather than once per token because holders associate, transfer, freeze, lose KYC, and become exempt at independent times, and each of those must advance or reset accrual for that holder alone (see "Rejected Ideas").
- A PHF settlement is a holder → collector transfer of the assessed amount that is exempt from the token's custom-fee schedule. The exemption is a dedicated rule triggered by the transfer being a PHF settlement — not by the PHF collector belonging to the token's custom-fee collector set — so it is independent of `all_collectors_are_exempt` (HIP-573) and of the token's custom-fee configuration. Exemption bounds the holder's exposure to exactly the declared PHF terms — at most `cap × cycles_owed`, never more than the balance — and prevents a custom fee (for example a fixed HBAR fee) from debiting a holder on a settlement the holder may not have signed, since Path A settlements are triggered by the keeper rather than the holder.
- Authorization for PHF lives in a dedicated `holdingFeeKey`.

## User stories

- As a token issuer, I want a capped periodic fee set at token creation so holder-funded operating costs can be collected without off-ledger billing or routine wipe authority.
- As a token holder, I want to see the rate, the immutable cap, the cadence, the collector, and the token's custom fee schedule on-ledger before associating, and I want a guarantee that a PHF settlement can never debit more than the cap multiplied by the whole cycles elapsed, never exceed my balance, and never create a debt.
- As an issuer's billing service (keeper), I want a single HAPI operation to assess a batch of holders, with the network refusing assessments that fall outside the declared terms, and a cost that scales with the holders processed so oversized or spam batches are uneconomic to submit.
- As an auditor or compliance officer, I want every PHF assessment to produce an on-ledger record carrying the cycles covered, the applied rate, the pre-assessment balance, the resulting amount, and the collector at settlement time, so each debit is verifiable from the record itself and the issuer's fee collection can be reconciled against off-ledger disclosures.
- As a wallet, exchange, or integrator, I want PHF metadata in `TokenInfo` and indexed in Mirror Node before exposing the token to my users, so balances, spendable balances, and projected fee exposure are displayed accurately.

## Specification

### Terminology

A **cycle** is a period of `min_seconds_between_assessments` seconds. Cycles accrue per holder relationship starting at the relationship's `last_assessed_at`. `min_seconds_between_assessments` is therefore both the minimum spacing between two consecutive assessments of the same holder and the accrual quantum that multiplies the per-cycle rate.

### Scope

A fungible HTS token MAY declare a single `PeriodicHoldingFee` at `TokenCreate`. PHF on a non-fungible token SHALL be rejected with `PERIODIC_HOLDING_FEE_NOT_SUPPORTED_FOR_NON_FUNGIBLE_TOKEN`. PHF amounts SHALL be denominated only in the token to which the PHF is attached; PHF SHALL NOT charge HBAR, another fungible token, or an NFT. PHF state exists only on tokens that declare a PHF and on their relationships (see "State Model"). No HBAR reserve, autonomous boundary processing, background sweep, or per-cycle rate history is introduced.

### Settlement Transfer Semantics

The holder → collector transfer executed by an `assessTokenPeriodicHoldingFee` or by touch settlement moves exactly the assessed `amount`, denominated in the PHF token, and is **exempt from the token's custom-fee schedule**. This is a dedicated exemption for the settlement transfer itself — analogous in effect to the automatic exemption HTS grants the treasury account, which is exempt from all of the token's custom fees — but triggered by the transfer being a PHF settlement rather than by any account's role, and therefore wholly outside the custom-fee schedule and independent of `all_collectors_are_exempt` (HIP-573) and of the token's custom-fee configuration. No custom fee configured on the token — `FixedFee` or `FractionalFee`, the fee types a fungible token may carry — is assessed against a PHF settlement.

This exemption is load-bearing for the holder-exposure guarantee. A holder's debit at any settlement is exactly the PHF `amount` — at most `cap × cycles_owed` and never more than the holder's balance (see "Per-Cycle Math") — with no additional bleed layered on by custom fees, and in particular no HBAR or third-token charge triggered by a settlement the holder may not have signed (Path A settlements are triggered by the keeper, not the holder). The PHF cap (`max_per_cycle_basis_points` for fractional mode, `max_per_cycle_amount` for fixed mode) therefore bounds the holder's entire per-settlement cost, not merely one component of it.

Because the settlement amount is clamped to the holder's balance and the credit lands on a collector whose validity is checked before the transfer is attempted (`SKIPPED_COLLECTOR_INVALID`, see "Assessment"), the settlement transfer itself cannot fail for balance or custom-fee reasons; its only skip condition is an invalid collector, handled per path in "Assessment". A holder's ordinary `CryptoTransfer` of the PHF token is assessed for custom fees under the token's normal custom-fee schedule; the exemption applies only to the PHF settlement transfer.

### Periodic Holding Fee Configuration

PHF operates in one of two **modes**, selected at `TokenCreate` and immutable for the life of the token:

- **Fractional mode** — each assessment debits a percentage of the holder's balance, expressed in basis points (1 bp = 0.01%). Larger holdings pay proportionally larger fees.
- **Fixed mode** — each assessment debits a flat amount per holder, denominated in the token's smallest unit. Every non-exempt holder pays the same amount per cycle regardless of balance.

Exactly one mode MUST be set at `TokenCreate`: a configuration whose `rate` oneof is unset SHALL be rejected with `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`. A `TokenUpdate` SHALL NOT switch modes; setting a current-rate field that does not match the token's mode SHALL be rejected with `PERIODIC_HOLDING_FEE_MODE_MISMATCH`.

Each PHF declares:

| Field | Mode | Semantics |
| --- | --- | --- |
| `fractional.max_per_cycle_basis_points` | fractional | Immutable upper bound on the per-cycle PHF rate, in basis points. Bounds every assessment for the life of the token. In `(0, MAX_PER_CYCLE_BASIS_POINTS_CEILING]`. |
| `fractional.current_per_cycle_basis_points` | fractional | The rate actually applied at each assessment. Mutable, strictly within `[0, max_per_cycle_basis_points]`. |
| `fixed.max_per_cycle_amount` | fixed | Immutable upper bound on the per-cycle PHF amount, denominated in the token's smallest unit. Bounds every assessment for the life of the token. Must be strictly positive. |
| `fixed.current_per_cycle_amount` | fixed | The amount actually applied at each assessment, denominated in the token's smallest unit. Mutable, strictly within `[0, max_per_cycle_amount]`. |
| `min_seconds_between_assessments` | both | The cycle length: both the minimum spacing between two consecutive assessments of the same holder and the accrual quantum (see "Terminology"). At least `MIN_ASSESSMENT_INTERVAL_SECONDS`. Immutable. |
| `first_assessment_at` | both | The earliest consensus timestamp at which any holder MAY be assessed. Must be at least `MIN_FIRST_ASSESSMENT_DELAY_SECONDS` after token creation. Immutable. |
| `fee_collector_account_id` | both | The account that receives all PHF settlement transfers. Mutable. The collector MUST sign the `TokenCreate` or `TokenUpdate` that designates it, mirroring the custom-fee collector convention. |
| `exempt_accounts` | both | Accounts exempt from PHF in addition to the implicit exemptions (treasury and PHF collector). Up to `MAX_EXEMPT_ACCOUNT_IDS` distinct entries. Mutable. |

### Per-Cycle Math

PHF math is integer-only. For a holder relationship with stored `balance` (int64) and `last_assessed_at`, and a consensus timestamp `now`:

```
elapsed     = floor_seconds(now - last_assessed_at)    // exact (seconds, nanos) difference, floored to whole seconds
cycles_owed = elapsed / min_seconds_between_assessments // integer division

if mode == fractional:
  amount = (balance * current_per_cycle_basis_points * cycles_owed) / 10000   // floor
else:  // mode == fixed
  amount = current_per_cycle_amount * cycles_owed

amount = min(amount, balance)
```

All timestamp comparisons in this specification are performed at nanosecond precision over the `(seconds, nanos)` pairs; `elapsed` is the exact difference floored to whole seconds. The computation above is only ever evaluated when the guards in "Assessment" hold (`now >= first_assessment_at` and `elapsed >= min_seconds_between_assessments`), so every operand is non-negative, `cycles_owed >= 1`, and integer division coincides with floor.

Implementations SHALL perform the intermediate multiplications (`balance * current_per_cycle_basis_points * cycles_owed` for fractional, `current_per_cycle_amount * cycles_owed` for fixed) in at least 128-bit signed integer or arbitrary-precision arithmetic to avoid overflow before the final `min(amount, balance)` clamp. The final `amount` is guaranteed to fit in int64 because `amount ≤ balance` and `balance` is int64. The `last_assessed_at` advancement term `cycles_owed × min_seconds_between_assessments` likewise fits in int64 by construction, since it cannot exceed the `elapsed` seconds difference from which `cycles_owed` was derived.

**Valuation rule.** All accrued cycles are valued at the holder's balance and the current rate in effect at settlement time; no per-cycle historical valuation is performed. Credit-side touch settlement (see "Path B") guarantees that a credit carried by the triggering operation's transfer list never re-values previously accrued cycles: accrued cycles settle at the pre-credit balance before the credit is applied. Credits synthesized during execution — custom-fee assessment, PHF settlement transfers — do not settle first (see the depth bound in "Path B"). A rate change re-values outstanding cycles (see "Update Rules"). Valuation is linear in `cycles_owed`; the only bound beyond `current ≤ cap` is the clamp to the holder's balance.

`amount` is the PHF debit. On a successful settlement (including a zero-amount one), the relationship's `last_assessed_at` advances by exactly `cycles_owed × min_seconds_between_assessments`, added to its seconds component with the nanoseconds component preserved — regardless of whether the clamp was applied. Rounding always favors the holder. In either mode, if the computed value would exceed the holder's balance, the assessment debits the holder's remaining balance and no further liability is recorded: the holder may end the cycle with a zero balance but never a negative balance, and never a pending debt.

Caps are enforced at update time, not at assessment time. Any change to `current_per_cycle_basis_points` or `current_per_cycle_amount` SHALL be rejected with `PERIODIC_HOLDING_FEE_RANGE_VIOLATION` if the new value falls outside `[0, max_per_cycle_basis_points]` or `[0, max_per_cycle_amount]` respectively. Because `0 ≤ current ≤ max` always, no separate per-assessment cap check is required.

When the computed `amount` equals zero — because `(balance × current_per_cycle_basis_points × cycles_owed) / 10000 < 1` in fractional mode, or `current_per_cycle_amount = 0` in fixed mode — no `CryptoTransfer` is executed. `last_assessed_at` still advances by `cycles_owed × min_seconds_between_assessments` and an `AssessedPeriodicHoldingFee` record is emitted with `amount = 0` and `assessment_result = ZERO_ASSESSMENT_AFTER_ROUNDING`. The permanent forgiveness of sub-unit residue that this implies is intentional: rounding always favors the holder, and PHF never records a pending liability.

### Validation

`TokenCreate` SHALL reject a PHF configuration when any of the following is true:

- The token is not `FUNGIBLE_COMMON` (→ `PERIODIC_HOLDING_FEE_NOT_SUPPORTED_FOR_NON_FUNGIBLE_TOKEN`);
- The `rate` oneof is unset (→ `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`);
- For fractional mode: `max_per_cycle_basis_points` is zero or exceeds `MAX_PER_CYCLE_BASIS_POINTS_CEILING`, or `current_per_cycle_basis_points` exceeds `max_per_cycle_basis_points` (→ `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`);
- For fixed mode: `max_per_cycle_amount` is not strictly positive, or `current_per_cycle_amount` is negative or exceeds `max_per_cycle_amount` (→ `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`);
- `min_seconds_between_assessments` is less than `MIN_ASSESSMENT_INTERVAL_SECONDS` (→ `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`);
- `first_assessment_at` is earlier than `token.creation_timestamp + MIN_FIRST_ASSESSMENT_DELAY_SECONDS` (→ `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`);
- `fee_collector_account_id` is missing (→ `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`), or references a non-existent account or the token's own treasury (→ `INVALID_PERIODIC_HOLDING_FEE_COLLECTOR_ACCOUNT` — the treasury is already implicitly exempt). The collector MUST sign the `TokenCreate`; a missing collector signature fails per standard signature validation. The collector's association with the token cannot be verified at `TokenCreate` (the token does not yet exist); it is verified at runtime via `SKIPPED_COLLECTOR_INVALID` and at `TokenUpdate` time via `INVALID_PERIODIC_HOLDING_FEE_COLLECTOR_ACCOUNT`;
- `exempt_accounts` exceeds `MAX_EXEMPT_ACCOUNT_IDS`, contains duplicates, or references non-existent accounts (→ `INVALID_PERIODIC_HOLDING_FEE_EXEMPT_ACCOUNTS`);
- `holding_fee_key`, when present, is not a valid key (→ `INVALID_HOLDING_FEE_KEY`). `holding_fee_key` MAY be omitted: PHF then operates permanently in touch-settlement-only mode (see "Update Rules"). A `TokenCreate` carrying `holding_fee_key` without `periodic_holding_fee` SHALL be rejected with `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION`.

A `TokenUpdate` mutating PHF fields SHALL be rejected with:

- `TOKEN_HAS_NO_PERIODIC_HOLDING_FEE` when the update carries `periodic_holding_fee_update` or `holding_fee_key` against a token that did not declare a PHF at creation;
- `TOKEN_HAS_NO_HOLDING_FEE_KEY` when the token's `holdingFeeKey` is absent — whether omitted at creation or removed later (see "Update Rules");
- `PERIODIC_HOLDING_FEE_MODE_MISMATCH` when the update sets `current_per_cycle_amount` on a fractional-mode token, sets `current_per_cycle_basis_points` on a fixed-mode token, or sets both current-rate fields simultaneously;
- `PERIODIC_HOLDING_FEE_RANGE_VIOLATION` when the new current rate falls outside `[0, cap]` for the token's mode;
- `INVALID_PERIODIC_HOLDING_FEE_EXEMPT_ACCOUNTS` when the exempt-accounts update is invalid: an account appears in both `accounts_to_add` and `accounts_to_remove`, an account appears more than once within the same list, an account in `accounts_to_add` is already exempt, an account in `accounts_to_remove` is not currently exempt, an account does not exist, or the resulting list would exceed `MAX_EXEMPT_ACCOUNT_IDS`. All exempt-update checks are evaluated against the pre-transaction state;
- `PERIODIC_HOLDING_FEE_EXEMPT_LIST_DELTA_TOO_LARGE` when `|accounts_to_add| + |accounts_to_remove|` exceeds `MAX_EXEMPT_LIST_DELTA_PER_TX`;
- `INVALID_HOLDING_FEE_KEY` when the update sets `holding_fee_key` to a structurally invalid key;
- `INVALID_PERIODIC_HOLDING_FEE_COLLECTOR_ACCOUNT` when the new `fee_collector_account_id` does not exist or is not associated with the token. The new collector MUST sign the `TokenUpdate`.

A `TokenUpdate` SHALL be rejected with `INVALID_PERIODIC_HOLDING_FEE_COLLECTOR_ACCOUNT` when, after applying all field changes carried by the transaction, the resulting `fee_collector_account_id` would equal the resulting `treasury_account_id` — the post-state invariant that PHF configuration establishes at `TokenCreate`. The check is on the resulting state, so a single transaction that swaps treasury and collector is valid, while one that converges both onto the same account is rejected regardless of which field it changes.

This separation is deliberate. The treasury and the collector are two distinct implicitly-exempt roles: the treasury holds un-issued supply and is the sink for mint, burn, and `TokenReject`, while the collector accrues fee revenue, and the specification rotates and bumps the `last_assessed_at` of each independently. Allowing them to coincide would conflate fee income with supply accounting and force dedup special-cases throughout the rotation, exemption, and bump logic for no functional gain — an issuer that wants fee revenue to land in the treasury can designate a treasury-controlled account as the collector, or sweep the collector to the treasury off-ledger.

`TokenUpdate` against a paused token follows existing HTS semantics unchanged (`TOKEN_IS_PAUSED`); PHF mutations receive no carve-out.

### Assessment

PHF assessment materializes a holder's accrued cycles. Two paths reach the same calculation.

#### Path A — Explicit assessment

The `assessTokenPeriodicHoldingFee` HAPI operation is signed by `holdingFeeKey` and carries a `TokenID` and a list of `AccountID` entries. The following are validated at transaction-validation time, before any holder is processed:

- the referenced token has a PHF configuration, else `TOKEN_HAS_NO_PERIODIC_HOLDING_FEE`;
- the token's `holdingFeeKey` is present, else `TOKEN_HAS_NO_HOLDING_FEE_KEY`;
- `holder_account_ids` contains at least one entry, else `PERIODIC_HOLDING_FEE_ASSESS_BATCH_EMPTY`;
- `holder_account_ids` contains at most `MAX_ASSESS_BATCH_SIZE` entries, else `PERIODIC_HOLDING_FEE_ASSESS_BATCH_TOO_LARGE`;
- the token is not paused and not deleted, else `TOKEN_IS_PAUSED` / `TOKEN_WAS_DELETED` per existing HTS norms.

The `holder_account_ids` carried by the transaction are an advisory batch enumerated off-ledger by the keeper, not protocol-maintained state (see "State Model" and "Holder enumeration consistency"). They are processed sequentially in the order submitted. Each entry observes the state mutations produced by earlier entries; duplicate entries are permitted, and a later duplicate is re-evaluated against the updated state under the same precedence rules below — yielding `SKIPPED_NOT_DUE` for an already-settled holder, or `SKIPPED_ZERO_BALANCE` when the earlier settlement clamped the holder's full balance.

For each holder in the list, the network evaluates the following conditions **in this order, first match wins**, emitting the corresponding `AssessedPeriodicHoldingFee` record without failing the transaction:

1. the holder has no relationship with the token (`SKIPPED_NOT_ASSOCIATED`);
2. the holder's account is deleted (`SKIPPED_ACCOUNT_DELETED`);
3. the holder's account is expired (`SKIPPED_ACCOUNT_EXPIRED`);
4. the holder is exempt (`SKIPPED_EXEMPT`);
5. the relationship is frozen (`SKIPPED_FROZEN`);
6. the token has a `kycKey` and the relationship has not been granted KYC (`SKIPPED_KYC_NOT_GRANTED`);
7. the holder's balance is zero (`SKIPPED_ZERO_BALANCE`);
8. the PHF `fee_collector_account_id` is deleted, not associated with the token, frozen for the token, lacking KYC for the token, or in any other condition under which the credit to the collector would fail — e.g. `receiverSigRequired` without the collector's signature (`SKIPPED_COLLECTOR_INVALID`);
9. `now < first_assessment_at` or `elapsed < min_seconds_between_assessments` (`SKIPPED_NOT_DUE`).

Otherwise the network computes `amount` per "Per-Cycle Math":

- if `amount = 0`, it advances `last_assessed_at` and emits `ZERO_ASSESSMENT_AFTER_ROUNDING`;
- if `amount > 0`, it executes one holder → collector token transfer for `amount`, exempt from custom fees (see "Settlement Transfer Semantics"). Because `amount ≤ balance` and the collector's validity was already established at condition 8, this transfer cannot fail; the network advances `last_assessed_at` and emits `ASSESSED`.

Per HIP-1261, the fee schedule for `assessTokenPeriodicHoldingFee` charges a base per-transaction component plus a per-holder service component for **every holder entry processed**, regardless of `assessment_result`, so oversized or unproductive batches carry their own cost.

#### Path B — Touch settlement

Touch settlement runs atomically before, and as part of, the triggering operation. It has a **debit side** and a **credit side**.

**Debit-side settlement** runs before a successful balance-changing operation that debits a non-exempt, unfrozen, KYC-granted relationship with the holder as source:

- `CryptoTransfer` (including allowance-based) with the holder as source;
- `TokenAirdrop` (HIP-904) when it executes as an immediate transfer because the receiver is already associated or has an open auto-association slot — the sender is touch-settled;
- `TokenClaimAirdrop`, which debits the sender at claim execution — the sender is touch-settled, with the sender's relationship state evaluated at that moment;
- equivalent HTS system-contract (precompile) operations.

When the triggering operation begins, if `now >= first_assessment_at` and `elapsed >= min_seconds_between_assessments`, the network computes `amount` per "Per-Cycle Math", executes the custom-fee-exempt holder → collector settlement transfer for `amount`, advances `last_assessed_at`, and emits an `AssessedPeriodicHoldingFee` record. The triggering operation then proceeds against the updated balance. When the settlement is not due, no settlement runs and **no record is emitted**.

**Credit-side settlement** runs before a credit carried by the user-submitted transfer list is applied to a non-exempt relationship of a PHF-bearing token. If the relationship's stored balance is zero, no settlement runs and `last_assessed_at` is reset per "Token Association and Dissociation". Otherwise, if `now >= first_assessment_at` and `elapsed >= min_seconds_between_assessments`, the network settles the accrued cycles first — `amount` computed per "Per-Cycle Math" against the **pre-credit** balance — executes the custom-fee-exempt holder → collector settlement transfer, advances `last_assessed_at`, emits an `AssessedPeriodicHoldingFee` record, and only then applies the credit. A credit carried by the triggering operation's transfer list therefore never re-values previously accrued cycles. Credit-side settlement triggers only on credits enumerated in the transfer list of the triggering operation itself: the token transfer lists of the HAPI transaction body for `CryptoTransfer` and `TokenAirdrop` (when the airdrop executes as an immediate transfer), the credit executed by a `TokenClaimAirdrop`, and the transfer list passed to an HTS system-contract call. Credits synthesized by the network during execution — custom-fee assessment and PHF settlement transfers — never trigger credit-side settlement, which bounds settlement depth; a custom-fee collector that is a non-exempt PHF holder therefore still sees accrued cycles valued after such synthesized credits land, and issuers SHOULD list such collectors in `exempt_accounts` where that is undesired. Credits to frozen or KYC-revoked relationships fail the triggering operation under existing HTS rules, so no credit-side settlement ever executes against them.

Touch settlement and the triggering operation form a single atomic unit:

- If the **triggering operation** fails for any reason — insufficient balance after settlement, throttle rejection, signature failure, or any downstream HTS validation — every touch settlement in the unit SHALL be reverted along with it, no `last_assessed_at` SHALL be advanced, and no `AssessedPeriodicHoldingFee` record is emitted. Cycles continue to accrue, and the next successful triggering operation or `assessTokenPeriodicHoldingFee` call SHALL settle them.
- If the **collector** is in any condition under which the credit to it would fail (the same condition list as `SKIPPED_COLLECTOR_INVALID` in Path A), the network SHALL skip the affected settlement on either side, record `SKIPPED_COLLECTOR_INVALID`, and let the triggering operation proceed unaffected. If the token is deleted, touch settlement is skipped.

Because a PHF settlement is exempt from custom fees and is clamped to the holder's balance, a settlement that is due and whose collector is valid cannot itself fail. The only outcomes are an executed settlement (`ASSESSED` / `ZERO_ASSESSMENT_AFTER_ROUNDING`), a not-due no-op, or a collector-side skip (`SKIPPED_COLLECTOR_INVALID`). A debit-side settlement therefore never aborts the triggering operation on its own account — only the triggering operation's own validation can — and a credit-side settlement never blocks the sender, because an invalid collector skips rather than fails: a recipient's state never blocks a sender's transfer.

**Ordering.** When a single transaction triggers multiple touch settlements — debit-side and credit-side, across one or several PHF tokens — settlements SHALL execute by traversing the triggering operation's effective transfer lists in execution order: for `CryptoTransfer` and `TokenAirdrop`, the transaction body's `TokenTransferList` entries in order and, within each list, the `AccountAmount` entries in order (debit entries trigger debit-side settlement, credit entries credit-side settlement); for `TokenClaimAirdrop`, the `pending_airdrops` entries in list order, with each claim's sender debit-side settlement executing before its receiver credit-side settlement; for HTS system-contract operations, each call in EVM execution order with its transfer list in argument order. Each settlement computes against state already updated by earlier settlements in the same transaction — for credit-side settlements, the pre-credit balance as so updated. Records are emitted in the same order; all settlements execute before the triggering operation's own transfers are applied.

**Cost.** For a native HAPI triggering transaction, each touch settlement executed — debit-side or credit-side — is paid by the payer of the triggering transaction as a HIP-1261 line item priced as one internal `CryptoTransfer` plus one record-stream entry. A settlement that is due but skipped for an invalid collector (`SKIPPED_COLLECTOR_INVALID`) is charged the same line item — the work is attempted and the record is emitted. Touch settlement triggered via HTS precompile operations is metered against the calling contract's gas budget at the same cost, with a failed attempt consuming the same gas as an executed one.

The following operations do NOT trigger touch settlement: `TokenAssociate`, `TokenDissociate`, `TokenFreeze`, `TokenUnfreeze`, `TokenMint`, `TokenBurn`, `TokenWipe`, `TokenPause`, `TokenUnpause`, `TokenGrantKyc`, `TokenRevokeKyc`, `TokenReject`, `TokenAirdrop` when it creates a pending airdrop (no sender debit and no receiver credit occur until claim), `TokenCancelAirdrop`, `CryptoApproveAllowance`, `CryptoDeleteAllowance`, `ScheduleCreate`, `ScheduleSign`, and read-only queries.

- `TokenWipe` is excluded deliberately: wipe burns balance and never moves value to third parties, and the holder does not sign it. Making it a trigger would let `wipeKey` alone authorize a holder → collector transfer, and would make full-balance wipes fail whenever backlog exists. Cycles continue to accrue across a wipe; issuers wishing to capture accrued backlog before wiping SHALL call `assessTokenPeriodicHoldingFee` against the holder first — the same pattern prescribed for exempt-list updates.
- `TokenDissociate` is excluded because, for a live token, the existing HTS zero-balance dissociation rule (see "Token Association and Dissociation") already requires the holder to have reached a zero balance by other means: a `CryptoTransfer` out — which touch-settles — or `TokenReject` — which waives pending PHF. A dissociate on a zero-balance relationship has no PHF amount to assess; for a deleted or expired token the existing exceptional dissociation paths apply and PHF is not evaluable, so no settlement and no record is produced (see "Token Association and Dissociation").
- For `ScheduleCreate` and `ScheduleSign`: touch settlement triggers when (and if) the scheduled transaction executes, governed by the executed transaction's own rules.

#### Allowance-based transfers

An allowance-based `CryptoTransfer` is treated identically to a holder-signed transfer for PHF purposes: touch settlement is debited from the holder's balance before the transfer is applied, and the spender's allowance covers only the requested transfer amount. The settlement is authorized by the token's declared PHF terms, not by the allowance, so the allowance is neither required to cover the settlement nor decremented by it. If, after settlement, the holder's remaining balance no longer covers the requested amount, the atomic unit fails per existing insufficient-balance semantics and the settlement is reverted with it. Spenders MAY query Mirror Node for projected PHF exposure before submitting allowance transfers.

### Holder enumeration consistency

Keepers enumerating holders to construct `assessTokenPeriodicHoldingFee` batches typically query Mirror Node, which is eventually consistent with respect to consensus state. The protocol treats every list entry as advisory: the consensus-side state determines the assessment outcome, and stale or speculative entries are skipped per the codes above. Keepers SHOULD tolerate up to several seconds of Mirror Node lag and SHOULD re-query before subsequent cycles. The protocol provides no guarantee that any specific holder is reached in any given cycle; the issuer's keeper is responsible for completeness.

### Keeper patterns (non-normative)

A reference keeper is an off-chain scheduler holding (or co-signing with) `holdingFeeKey` that, once per cycle:

1. enumerates current holders via paginated Mirror Node queries;
2. partitions them into `ceil(N / MAX_ASSESS_BATCH_SIZE)` batches and submits one `assessTokenPeriodicHoldingFee` per batch;
3. re-queries and retries failed or interrupted submissions.

Retries are idempotent: holders already settled in the current cycle are skipped (`SKIPPED_NOT_DUE`, or `SKIPPED_ZERO_BALANCE` after a full-balance clamp), so resubmitting a batch is always safe. HIP-423 long-term scheduled transactions can pre-schedule individual assessments — `TokenAssessPeriodicHoldingFeeTransactionBody` is schedulable (see "Protobuf Changes") — but each schedule executes once and within the network's scheduling horizon (currently up to 62 days), so recurrence remains the keeper's responsibility; scheduled transactions are a convenience for pre-signing, not a recurrence mechanism. Indicative cost per cycle is `ceil(N / MAX_ASSESS_BATCH_SIZE) × base + N × per-holder` in HIP-1261 line items (final values in "Open Issues").

### Settlement Records

`AssessedPeriodicHoldingFee` records are carried in the new `assessed_periodic_holding_fees` field of the originating transaction's `TransactionRecord` (see "Protobuf Changes"). Emission rules, by originating transaction:

- **`assessTokenPeriodicHoldingFee` (Path A):** exactly one record per holder entry in `holder_account_ids`, with the `assessment_result` determined by the processing rules above.
- **A triggering operation (Path B):** one record per executed settlement, debit-side or credit-side (`ASSESSED` or `ZERO_ASSESSMENT_AFTER_ROUNDING`), and one per collector-side skip (`SKIPPED_COLLECTOR_INVALID`); no record when settlement is not due, nor when the credit-side zero-balance reset applies (see "Token Association and Dissociation").
- **`TokenReject`:** one record with `WAIVED_BY_TOKEN_REJECT` per rejected PHF-bearing token relationship.
- **`TokenUpdate`** (exempt-list mutation, treasury rotation, collector rotation) and **`TokenUnfreeze` / `TokenGrantKyc`:** one record with `LAST_ASSESSED_AT_BUMPED` per affected account.

Field values per `assessment_result` are fixed normatively as follows. `applied_rate` always carries the current rate at evaluation time (basis points in fractional mode, smallest-unit amount in fixed mode); `fee_collector_account_id` always carries the collector configured at evaluation time, including when the result is `SKIPPED_COLLECTOR_INVALID`; `pre_assessment_balance` carries the holder's balance immediately before this settlement's evaluation — as updated by earlier settlements in the same transaction and, for credit-side records, excluding the triggering credit — or `0` where no relationship exists.

| `assessment_result` | `amount` | `cycles_settled` |
| --- | --- | --- |
| `ASSESSED` | the settled amount (> 0) | `cycles_owed` |
| `ZERO_ASSESSMENT_AFTER_ROUNDING` | 0 | `cycles_owed` |
| `WAIVED_BY_TOKEN_REJECT` | 0 | whole cycles accrued at waiver time |
| `LAST_ASSESSED_AT_BUMPED` | 0 | 0 |
| `SKIPPED_*` (all skip variants) | 0 | 0 |

On a `WAIVED_BY_TOKEN_REJECT` record, `cycles_settled` is informational — it reports the cycles waived by the `TokenReject` and, unlike on `ASSESSED` / `ZERO_ASSESSMENT_AFTER_ROUNDING` records, does not advance `last_assessed_at`.

The PHF settlement transfer (when `amount > 0`) is a custom-fee-exempt token transfer and emits standard `TokenTransferList` entries, with no nested custom-fee transfers. The EVM event surface for PHF settlement transfers SHALL follow existing HTS-to-EVM mapping conventions for `CryptoTransfer`; the precise event surface when touch settlement is triggered via precompile is listed in "Open Issues".

### State Model

PHF extends existing token and token-relationship data; no new top-level entity, and no list of holders, is introduced.

- **Per token:** the current PHF configuration as described above, including the bounded `exempt_accounts` list. Only tokens that declared a PHF at creation carry this state.
- **Per relationship:** a single `last_assessed_at: Timestamp` field appended to the token-relationship record HTS already maintains for every associated account. It is present **only** on relationships of PHF-bearing tokens and is initialized at association. This is the only per-holder state PHF adds: there is no separate holder registry, and no state is retained for ex-holders — dissociating a relationship (which requires a zero balance) removes the relationship and its `last_assessed_at` together. A relationship that has reached zero balance but not yet dissociated keeps only this one timestamp, already part of its existing HTS relationship record, and that timestamp is reset on the next zero → positive credit (see "Token Association and Dissociation"); PHF adds no per-account structure that outlives the relationship. Relationships of tokens without PHF are unchanged, and no migration of existing state is required: PHF cannot be added to a token after creation.

The protocol never enumerates holders on its own. The authoritative per-holder state is the pair (`balance`, `last_assessed_at`) on the existing relationship; current holders are discovered off-ledger by the keeper and supplied to `assessTokenPeriodicHoldingFee` as an advisory batch (see "Assessment" and "Holder enumeration consistency"). The cost of processing each supplied holder is borne by the per-holder fee component (see "Cost" and HIP-1261), so the iteration work is paid for rather than imposed on consensus as autonomous work.

The canonical balance remains the stored relationship balance. Mirror Node MAY expose projected PHF exposure derived from current balance, the current rate, `last_assessed_at`, and `min_seconds_between_assessments`; projected values are not consensus state.

### Update Rules

PHF is created only at `TokenCreate` and cannot be added to or removed from a token afterward. `TokenUpdate` carrying PHF mutations MUST be signed by `holdingFeeKey` for those mutations; mixing PHF mutations with other token-level fields requiring `adminKey` or `feeScheduleKey` follows the union of required signatures per existing HTS rules.

**Key lifecycle.** `holdingFeeKey` follows HIP-540 semantics: an existing `holdingFeeKey` MAY be replaced by a `TokenUpdate` signed by `adminKey` or by the current `holdingFeeKey` itself, and MAY be removed by setting the empty-`KeyList` sentinel. A `holdingFeeKey` that is absent — whether omitted at `TokenCreate` or removed later — can never be re-added; PHF then operates permanently in touch-settlement-only mode, and both `assessTokenPeriodicHoldingFee` and PHF mutations via `TokenUpdate` SHALL be rejected with `TOKEN_HAS_NO_HOLDING_FEE_KEY`.

PHF field mutations within a single `TokenUpdate` are independent; no settlement transfer is ever executed during `TokenUpdate`. A single `TokenUpdate` SHALL add or remove at most `MAX_EXEMPT_LIST_DELTA_PER_TX` entries from `exempt_accounts`, counted as `|accounts_to_add| + |accounts_to_remove|`; larger changes must be split across multiple transactions.

**Rate changes** take effect immediately at consensus. Immediate effect is intentional: the immutable cap, visible before association, is the binding bound on holder exposure, and PHF deliberately provides no prospective-effect window for increases (see "Rejected Ideas"). Subsequent assessments use the new current rate, and any backlog cycles outstanding at settlement time are valued at the current rate (not the rate that was effective at the cycle they accrued). The current rate MAY be decreased as well as increased within its cap; a decrease is strictly pro-holder for outstanding backlog. A holder can force settlement of accrued cycles at the current terms by submitting any outgoing transfer — touch settlement values the accrued cycles at the terms in effect at that moment. This valuation rule applies identically in both fractional and fixed modes.

**Exempt-list changes.** Both adding to and removing from `exempt_accounts` set the affected accounts' `last_assessed_at` to `max(consensus_timestamp, first_assessment_at)` without a balance transfer; the protocol emits one `LAST_ASSESSED_AT_BUMPED` record per affected account. No force-settle of accrued backlog is performed as a side effect of the update. Issuers wishing to capture an account's accrued backlog before exempting it SHALL call `assessTokenPeriodicHoldingFee` against that account prior to the exemption update — `TokenUpdate` semantics do not embed this orchestration. Because no settlement transfer is required, exempt-list updates SHALL succeed even when affected accounts are frozen.

**Collector rotation.** A `TokenUpdate` that changes `fee_collector_account_id` MUST additionally be signed by the incoming collector (see "Validation"). It SHALL set `last_assessed_at` to `max(consensus_timestamp, first_assessment_at)` for the incoming collector and — if it still has a relationship with the token — for the outgoing collector, without a balance transfer, emitting one `LAST_ASSESSED_AT_BUMPED` record per bumped account, so neither account is ever charged for the period in which it was implicitly exempt. When the outgoing collector no longer has a relationship with the token, no bump occurs and no record is emitted for it.

**Treasury rotation.** `TokenUpdate` MAY change `treasury_account_id` per existing HTS authorization rules — except where the resulting treasury would equal the resulting collector (see "Validation"). The change is handled as an implicit-exemption change, not as a literal `exempt_accounts` mutation: it consumes no exempt-list slots and does not count against `MAX_EXEMPT_LIST_DELTA_PER_TX`. The old and new treasury accounts each receive a `last_assessed_at` bump to `max(consensus_timestamp, first_assessment_at)` and one `LAST_ASSESSED_AT_BUMPED` record.

### Token Association and Dissociation

`TokenAssociate`, automatic association, and HIP-904 frictionless airdrops that auto-associate SHALL initialize `last_assessed_at = max(consensus_timestamp, first_assessment_at)`. The new relationship is never charged for time prior to its own existence.

When any operation increases the stored balance of a PHF-bearing relationship from zero to a positive value, `last_assessed_at` SHALL be set to `max(consensus_timestamp, first_assessment_at)`. The rule is universal across credit sources: `CryptoTransfer` (including allowance-based) crediting the holder, `TokenAirdrop` executing as an immediate transfer against a pre-existing relationship at zero balance, `TokenClaimAirdrop` against a pre-existing relationship at zero balance, equivalent HTS precompile credits, and credits synthesized during execution by custom-fee assessment or PHF settlement transfers — the credit-side depth bound restricts settlements, not resets. It ensures a holder who reaches zero balance and is later re-credited is not charged for the time spent at zero. Two precedence rules disambiguate it against credit-side settlement (see "Path B"): when the credited relationship's balance is positive, credit-side touch settlement applies instead; and the reset does NOT apply when the zero balance was produced by a PHF settlement within the same transaction — the relationship keeps the `last_assessed_at` advanced by that settlement. The protocol emits no record for this update; the new `last_assessed_at` is deterministically derivable from the crediting transfer in the record stream (see "Impact on Mirror Node") and observable via the `TokenRelationship` surface.

For live tokens, `TokenDissociate` follows the existing HTS zero-balance dissociation rule unchanged: it succeeds only when the relationship balance is zero. A holder reaches zero by transferring out (which touch-settles) or via `TokenReject` (which waives pending PHF and returns the balance to treasury per HIP-904). For deleted or expired tokens, the existing exceptional dissociation paths apply unchanged and no PHF settlement is performed — PHF is not evaluable in those states. `TokenDissociate` itself never triggers PHF settlement.

### Frozen, KYC-Revoked, Deleted, and Expired Accounts

A frozen relationship cannot be the source of a `CryptoTransfer`; neither Path A nor Path B SHALL debit a frozen relationship. **Time spent frozen does not accrue PHF:** `TokenUnfreeze` SHALL set the relationship's `last_assessed_at` to `max(consensus_timestamp, first_assessment_at)` and emit one `LAST_ASSESSED_AT_BUMPED` record. `TokenFreeze` does not itself trigger settlement; issuers wishing to capture accrued backlog before freezing SHALL call `assessTokenPeriodicHoldingFee` against the holder first.

A relationship lacking KYC on a token with a `kycKey` cannot transact; neither path SHALL debit it (`SKIPPED_KYC_NOT_GRANTED` in Path A). **Time spent without KYC does not accrue PHF:** `TokenGrantKyc` SHALL set `last_assessed_at` to `max(consensus_timestamp, first_assessment_at)` and emit one `LAST_ASSESSED_AT_BUMPED` record. `TokenRevokeKyc` does not itself trigger settlement; the assess-first pattern above applies.

While the token is **paused**, neither Path A nor Path B SHALL debit holders (Path A is rejected at validation with `TOKEN_IS_PAUSED`); `elapsed` continues to accrue, and after unpause the next assessment or triggering operation — an outgoing transfer or an incoming credit — settles the full backlog at the then-current terms.

Existing HTS account-deletion and expiry invariants remain authoritative. PHF SHALL NOT debit a deleted or expired holder account (`SKIPPED_ACCOUNT_DELETED` / `SKIPPED_ACCOUNT_EXPIRED` in Path A).

### Exempt Accounts

The following accounts are exempt from PHF:

- The token's `treasury_account_id`.
- The PHF's own `fee_collector_account_id`.
- Every account in `exempt_accounts`.

Exemption is evaluated from current state at assessment time.

### TokenReject and Airdrops

Pending airdrops are not associated balances and SHALL NOT be assessed; creating a pending airdrop debits no sender balance and triggers no settlement. On `TokenClaimAirdrop` or HIP-904 auto-association, `last_assessed_at` is initialized per the rules above, and the claim's sender-side debit touch-settles the sender per Path B. `TokenReject` SHALL return the balance to the treasury per HIP-904 and SHALL waive all pending PHF for that relationship, recording `assessment_result = WAIVED_BY_TOKEN_REJECT` with `amount = 0`.

### Protobuf Changes

Field numbers and enum ordinals below are illustrative and SHALL be finalized by protobuf maintainers.

```protobuf
// Fractional-mode rate: percentage of balance, expressed in basis points.
message FractionalPeriodicRate {
  uint32 max_per_cycle_basis_points = 1;       // immutable cap (1 bp = 0.01%); in (0, MAX_PER_CYCLE_BASIS_POINTS_CEILING]
  uint32 current_per_cycle_basis_points = 2;   // mutable, in [0, max_per_cycle_basis_points]
}

// Fixed-mode rate: flat amount per cycle, denominated in the token's smallest unit.
message FixedPeriodicRate {
  int64 max_per_cycle_amount = 1;              // immutable cap; strictly positive
  int64 current_per_cycle_amount = 2;          // mutable, in [0, max_per_cycle_amount]
}

message PeriodicHoldingFee {
  // PHF mode: fractional (% of balance) or fixed (flat amount per cycle).
  // The oneof MUST be set at TokenCreate. The selected mode is immutable for
  // the life of the token; TokenUpdate cannot switch modes.
  oneof rate {
    FractionalPeriodicRate fractional = 1;
    FixedPeriodicRate fixed = 2;
  }
  int64 min_seconds_between_assessments = 3;   // immutable; whole seconds. Kept as a raw count for direct
                                               // use in cycle arithmetic; maintainers MAY prefer Duration.
  Timestamp first_assessment_at = 4;           // immutable
  AccountID fee_collector_account_id = 5;      // mutable; must co-sign the transaction that designates it
  repeated AccountID exempt_accounts = 6;      // mutable; max MAX_EXEMPT_ACCOUNT_IDS entries
}

// Dedicated message for PHF mutations via TokenUpdate. Only mutable fields are
// representable; immutable PHF fields (mode, caps, cadence, first_assessment_at)
// cannot be expressed here, so no TokenUpdate path can violate immutability by
// construction. An unset field leaves the corresponding value unchanged; a set
// field — including an explicit zero — replaces it. At most one of the two
// current-rate fields may be set and it MUST match the token's PHF mode
// (PERIODIC_HOLDING_FEE_MODE_MISMATCH otherwise). proto3 `optional` is used for
// explicit field presence on scalars; maintainers MAY substitute wrapper types
// per HAPI convention.
message PeriodicHoldingFeeUpdate {
  optional uint32 current_per_cycle_basis_points = 1;  // fractional-mode tokens only
  optional int64 current_per_cycle_amount = 2;         // fixed-mode tokens only
  AccountID fee_collector_account_id = 3;              // new collector; must exist, be associated with the
                                                       // token, co-sign the TokenUpdate, and not equal the
                                                       // resulting treasury
                                                       // (INVALID_PERIODIC_HOLDING_FEE_COLLECTOR_ACCOUNT otherwise)
  PeriodicHoldingFeeExemptAccountsUpdate exempt_accounts_update = 4;
}

// All checks are evaluated against the pre-transaction state.
message PeriodicHoldingFeeExemptAccountsUpdate {
  repeated AccountID accounts_to_add = 1;      // rejected if an account is duplicated within the list,
                                               // is already exempt, or also appears in accounts_to_remove
  repeated AccountID accounts_to_remove = 2;   // rejected if an account is duplicated within the list
                                               // or is not currently exempt
}

message TokenCreateTransactionBody {
  // ... existing fields preserved
  PeriodicHoldingFee periodic_holding_fee = 25;
  Key holding_fee_key = 26;  // OPTIONAL when periodic_holding_fee is present; omitting it
                             // fixes the PHF in touch-settlement-only mode permanently
}

message TokenUpdateTransactionBody {
  // ... existing fields preserved
  PeriodicHoldingFeeUpdate periodic_holding_fee_update = 19;
  Key holding_fee_key = 20;  // replacement requires adminKey or the current holdingFeeKey;
                             // removal via the HIP-540 empty-KeyList sentinel is permanent
}

message TokenAssessPeriodicHoldingFeeTransactionBody {
  TokenID token_id = 1;
  repeated AccountID holder_account_ids = 2;  // 1..MAX_ASSESS_BATCH_SIZE entries; processed
                                              // sequentially in list order
}

// New entries in existing messages (illustrative tags):

message TransactionBody {
  oneof data {
    // ... existing entries preserved
    TokenAssessPeriodicHoldingFeeTransactionBody tokenAssessPeriodicHoldingFee = 82;
  }
}

message SchedulableTransactionBody {
  oneof data {
    // ... existing entries preserved
    TokenAssessPeriodicHoldingFeeTransactionBody tokenAssessPeriodicHoldingFee = 77;
  }
}

enum HederaFunctionality {
  // ... existing values preserved
  TokenAssessPeriodicHoldingFee = 117;
}

enum ResponseCodeEnum {
  // ... existing values preserved
  PERIODIC_HOLDING_FEE_NOT_SUPPORTED_FOR_NON_FUNGIBLE_TOKEN = 401;
  INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION = 402;
  PERIODIC_HOLDING_FEE_MODE_MISMATCH = 403;
  PERIODIC_HOLDING_FEE_RANGE_VIOLATION = 404;
  INVALID_PERIODIC_HOLDING_FEE_EXEMPT_ACCOUNTS = 405;
  PERIODIC_HOLDING_FEE_EXEMPT_LIST_DELTA_TOO_LARGE = 406;
  INVALID_PERIODIC_HOLDING_FEE_COLLECTOR_ACCOUNT = 407;
  TOKEN_HAS_NO_PERIODIC_HOLDING_FEE = 408;
  TOKEN_HAS_NO_HOLDING_FEE_KEY = 409;
  INVALID_HOLDING_FEE_KEY = 410;
  PERIODIC_HOLDING_FEE_ASSESS_BATCH_EMPTY = 411;
  PERIODIC_HOLDING_FEE_ASSESS_BATCH_TOO_LARGE = 412;
  PERIODIC_HOLDING_FEE_NOT_SUPPORTED_IN_CONTRACT = 413;
}

message TransactionRecord {
  // ... existing fields preserved
  repeated AssessedPeriodicHoldingFee assessed_periodic_holding_fees = 24;
}

message TokenInfo {
  // ... existing fields preserved
  PeriodicHoldingFee periodic_holding_fee = 31;
  Key holding_fee_key = 32;
}

message TokenRelationship {
  // ... existing fields preserved
  Timestamp last_assessed_at = 8;  // populated only for PHF-bearing tokens
}

message AssessedPeriodicHoldingFee {
  int64 amount = 1;
  TokenID token_id = 2;
  AccountID holder_account_id = 3;            // the assessed holder
  AccountID fee_collector_account_id = 4;     // collector configured at evaluation time
  int64 cycles_settled = 5;
  PeriodicHoldingFeeAssessmentResult assessment_result = 6;
  int64 applied_rate = 7;                     // current rate at evaluation: basis points
                                              // (fractional mode) or smallest-unit amount (fixed mode)
  int64 pre_assessment_balance = 8;           // holder balance at this settlement's evaluation (after earlier
                                              // settlements in the same transaction, excluding the triggering
                                              // credit for credit-side records); 0 if no relationship exists
}

// Value names are illustrative short forms; final names follow protobuf
// maintainers' scoping conventions (Google style would prefix each value with
// PERIODIC_HOLDING_FEE_ASSESSMENT_RESULT_).
enum PeriodicHoldingFeeAssessmentResult {
  PERIODIC_HOLDING_FEE_ASSESSMENT_RESULT_UNSPECIFIED = 0;
  ASSESSED = 1;
  ZERO_ASSESSMENT_AFTER_ROUNDING = 2;
  SKIPPED_NOT_DUE = 3;
  SKIPPED_EXEMPT = 4;
  SKIPPED_FROZEN = 5;
  SKIPPED_KYC_NOT_GRANTED = 6;
  SKIPPED_ZERO_BALANCE = 7;
  SKIPPED_ACCOUNT_DELETED = 8;
  SKIPPED_ACCOUNT_EXPIRED = 9;
  SKIPPED_NOT_ASSOCIATED = 10;
  SKIPPED_COLLECTOR_INVALID = 11;
  WAIVED_BY_TOKEN_REJECT = 12;
  LAST_ASSESSED_AT_BUMPED = 13;
}

service TokenService {
  // ... existing rpcs preserved
  rpc assessTokenPeriodicHoldingFee (Transaction) returns (TransactionResponse);
}
```

### Response Codes

- `PERIODIC_HOLDING_FEE_NOT_SUPPORTED_FOR_NON_FUNGIBLE_TOKEN` — PHF attached to an NFT at `TokenCreate`.
- `INVALID_PERIODIC_HOLDING_FEE_CONFIGURATION` — internally inconsistent PHF configuration at `TokenCreate`: `rate` oneof unset, zero or excessive `max_per_cycle_basis_points` (fractional), non-positive `max_per_cycle_amount` (fixed), `current` outside `[0, max]`, interval outside the allowed range, `first_assessment_at` too early, missing `fee_collector_account_id`, or `holding_fee_key` present without `periodic_holding_fee`. `PeriodicHoldingFeeUpdate` cannot express changes to immutable fields by construction; no `TokenUpdate` path emits this code.
- `PERIODIC_HOLDING_FEE_MODE_MISMATCH` — update that sets `current_per_cycle_amount` on a fractional-mode token, sets `current_per_cycle_basis_points` on a fixed-mode token, or sets both current-rate fields simultaneously.
- `PERIODIC_HOLDING_FEE_RANGE_VIOLATION` — update where the new current rate falls outside `[0, max_per_cycle_basis_points]` (fractional) or `[0, max_per_cycle_amount]` (fixed).
- `INVALID_PERIODIC_HOLDING_FEE_EXEMPT_ACCOUNTS` — invalid `exempt_accounts` at `TokenCreate` (too many entries, duplicates, non-existent accounts) or invalid exempt-accounts update at `TokenUpdate` (account in both lists, account duplicated within a list, adding an already-exempt account, removing a non-exempt account, non-existent accounts, resulting list too large; all checks against the pre-transaction state).
- `PERIODIC_HOLDING_FEE_EXEMPT_LIST_DELTA_TOO_LARGE` — a single `TokenUpdate` where `|accounts_to_add| + |accounts_to_remove|` exceeds `MAX_EXEMPT_LIST_DELTA_PER_TX`.
- `INVALID_PERIODIC_HOLDING_FEE_COLLECTOR_ACCOUNT` — the proposed `fee_collector_account_id` does not exist or (at `TokenUpdate`) is not associated with the token; also emitted by any `TokenCreate` or `TokenUpdate` whose resulting `fee_collector_account_id` would equal the resulting `treasury_account_id` (post-state invariant).
- `INVALID_HOLDING_FEE_KEY` — `holding_fee_key` set to a structurally invalid key at `TokenCreate` or `TokenUpdate`.
- `TOKEN_HAS_NO_PERIODIC_HOLDING_FEE` — `assessTokenPeriodicHoldingFee`, `periodic_holding_fee_update`, or `holding_fee_key` against a token that did not declare a PHF at creation.
- `TOKEN_HAS_NO_HOLDING_FEE_KEY` — `assessTokenPeriodicHoldingFee` or a PHF mutation on a PHF-bearing token whose `holdingFeeKey` is absent (omitted at creation or removed per HIP-540).
- `PERIODIC_HOLDING_FEE_ASSESS_BATCH_EMPTY` — `assessTokenPeriodicHoldingFee` carries no holder ids.
- `PERIODIC_HOLDING_FEE_ASSESS_BATCH_TOO_LARGE` — `assessTokenPeriodicHoldingFee` carries more than `MAX_ASSESS_BATCH_SIZE` holder ids.
- `PERIODIC_HOLDING_FEE_NOT_SUPPORTED_IN_CONTRACT` — HIP-1010 contract-mediated update targets PHF; reserved until a future HIP extends the precompile ABI.

### TokenInfo and Contract Surface

`TokenInfo` SHALL expose, when PHF is present, the full `PeriodicHoldingFee` configuration and `holding_fee_key` (see "Protobuf Changes").

The HTS system contract surface MAY expose PHF read accessors when `TokenInfo` does. PHF write support through HIP-1010 precompiles is out of scope unless the precompile ABI is explicitly extended; HIP-1010 invocations targeting PHF update fields SHALL be rejected with `PERIODIC_HOLDING_FEE_NOT_SUPPORTED_IN_CONTRACT`. A future HIP MAY add contract-mediated PHF updates.

### Impact on Mirror Node

Mirror Node SHALL index PHF configuration (including the active mode), `AssessedPeriodicHoldingFee` records, and per-relationship `last_assessed_at`, and SHALL expose holder-side queries for projected PHF exposure, spendable balance (stored balance minus projected settlement), and assessment history.

`last_assessed_at` is deterministically derivable from the record stream. Its complete set of mutations is:

1. initialization at association or auto-association, to `max(consensus_timestamp, first_assessment_at)`;
2. reset on any credit that takes a relationship's stored balance from zero to positive — including credits synthesized by custom-fee assessment or PHF settlement transfers — to `max(consensus_timestamp, first_assessment_at)`, derivable from the crediting transfer in the record stream; the reset does not apply to a credit whose zero starting balance was produced by a settlement in the same transaction (an `ASSESSED` or `ZERO_ASSESSMENT_AFTER_ROUNDING` record for the same relationship), where the settlement's advancement stands;
3. advancement by `cycles_settled × min_seconds_between_assessments` on each `ASSESSED` or `ZERO_ASSESSMENT_AFTER_ROUNDING` record (advancement occurs only on these two results; the `cycles_settled` reported on a `WAIVED_BY_TOKEN_REJECT` record is informational and never advances the timestamp);
4. a bump to `max(consensus_timestamp, first_assessment_at)` on each `LAST_ASSESSED_AT_BUMPED` record.

Nothing else mutates it; Mirror Node SHALL apply exactly these rules during ingestion.

Mirror Node MAY surface a derived annualized rate as presentation-only metadata: in fractional mode, approximately `current_per_cycle_basis_points × 31_536_000 / min_seconds_between_assessments` (annualized basis points); in fixed mode, approximately `current_per_cycle_amount × 31_536_000 / min_seconds_between_assessments` (annual token amount per holder). Mirror Node SHALL document its rounding convention. Derived values are not consensus state.

### Impact on SDK

SDKs SHALL expose PHF builders consistent with existing token-creation patterns, surface PHF fields in token information and records, provide a `TokenAssessPeriodicHoldingFeeTransaction` builder, and SHOULD provide a spendable-balance helper (stored balance minus projected settlement, computed from Mirror Node data) for wallets and integrators.

### Parameters

The following are **network-level parameters**, defined by network governance through node configuration and uniform across all tokens; they are not declared per token by the issuer. The "Initial value" column gives the proposed starting value, which governance MAY tune. Per-token values an issuer chooses at `TokenCreate` (the caps, the current rate, the cadence, `first_assessment_at`, the collector, and the exempt list) are listed in "Periodic Holding Fee Configuration" and are distinct from these.

| Parameter | Initial value |
| --- | ---: |
| `MIN_ASSESSMENT_INTERVAL_SECONDS` | 86,400 |
| `MIN_FIRST_ASSESSMENT_DELAY_SECONDS` | 604,800 |
| `MAX_EXEMPT_ACCOUNT_IDS` | 64 |
| `MAX_EXEMPT_LIST_DELTA_PER_TX` | 16 |
| `MAX_ASSESS_BATCH_SIZE` | 100 |
| `MAX_PER_CYCLE_BASIS_POINTS_CEILING` | 10,000 |

`max_per_cycle_basis_points` (fractional mode) and `max_per_cycle_amount` (fixed mode) are declared per token by the issuer and are NOT network parameters. The network ceiling only excludes encodings above 100% per cycle; in both modes the holder-facing bound is the per-token cap declared at creation, which holders SHOULD evaluate before associating, and issuers SHOULD declare a cap that meaningfully bounds holder exposure.

**Cadence floor.** `min_seconds_between_assessments` is the immutable cycle length chosen by the issuer at `TokenCreate`; it is validated once and never changes, and is not a runtime deadline. It is floored by `MIN_ASSESSMENT_INTERVAL_SECONDS` and has no upper bound beyond the int64 range of the field. The floor is the load-bearing constraint: because `cycles_owed = elapsed / min_seconds_between_assessments`, a smaller cadence yields more cycles and larger intermediate products, so `MIN_ASSESSMENT_INTERVAL_SECONDS` (together with the int64 range of `elapsed`) is what caps `cycles_owed`, keeps the per-cycle multiplication within the mandated 128-bit intermediate, keeps the annualized-rate divisor non-zero, and stops frequent assessment from being used to grind a holder. No symmetric upper bound is required: a larger cadence only produces fewer cycles and smaller quantities (the `last_assessed_at` advancement `cycles_owed × min_seconds_between_assessments` is bounded by `elapsed` for any cadence), so it raises no overflow, determinism, or consensus-cost concern. Issuers SHOULD nonetheless choose a cadence short enough that the fee is meaningful, since a very long cadence simply defers assessment.

**Compute and state bounds.** `MAX_ASSESS_BATCH_SIZE` and `MAX_EXEMPT_ACCOUNT_IDS` exist to bound deterministic consensus work and state — the same discipline that keeps PHF free of autonomous network work:

- `MAX_ASSESS_BATCH_SIZE` bounds the number of account entries a single `assessTokenPeriodicHoldingFee` transaction may carry in `holder_account_ids`, and therefore the per-transaction compute, state mutation, and record-stream size. It is a limit on the **batch**, not on the token: PHF places no cap on how many holders a token may have, and a token with any number of holders is assessed by submitting `ceil(N / MAX_ASSESS_BATCH_SIZE)` batches, each independently metered by the per-holder fee. The cap keeps every assessment transaction's cost bounded and uniform across nodes instead of letting one transaction iterate an unbounded account set.
- `MAX_EXEMPT_ACCOUNT_IDS` bounds the per-token `exempt_accounts` list. Exemption is checked against this list on every assessment, so an unbounded list would mean unbounded per-token state and an unbounded per-assessment lookup. Issuers needing to exempt more accounts than the cap allows can route those balances through dedicated omnibus accounts rather than enumerating each one.

Path B introduces no new parameter: each `AccountAmount` in a triggering operation's transfer list drives at most one settlement, and synthesized credits never recurse (see the depth bound in "Path B"), so per-transaction touch-settlement work is bounded by the existing HTS transfer-list entry limit for native transactions and by the gas budget for precompile callers.

## Backwards Compatibility

This HIP is additive at the protobuf level: it only appends new optional fields to existing messages and adds new messages, one RPC, new response codes, and one `HederaFunctionality` value; no existing field changes number, type, or meaning. However, the following behavior changes affect any ecosystem participant interacting with tokens that activate PHF:

- A `CryptoTransfer` from a non-exempt holder of a PHF-bearing token — and one crediting a non-exempt holder with accrued cycles — incurs additional consensus work and additional internal transfers (touch settlement, debit-side and credit-side) before the user's transfer is applied, paid by the payer of the triggering transaction as HIP-1261 line items. Fee estimation, gas estimation for HSCS precompile callers, and throughput expectations MUST account for this, and integrators should expect settlement records on incoming transfers, not only outgoing ones.
- A holder's effective transferable balance is `balance − accrued settlement`: a transfer of the full stored balance fails whenever at least one cycle has accrued with a non-zero amount. This breaks "send max" flows in wallets and sweep patterns used by exchanges and custodians. Integrators SHOULD compute spendable balance via Mirror Node or the SDK helper before constructing transfers.
- An allowance-based `CryptoTransfer` against a PHF-bearing token can fail even when the requested amount is within the allowance, because the holder's post-settlement balance may no longer cover it. The allowance itself only ever covers the requested amount. Spenders SHOULD check projected PHF exposure via Mirror Node.
- Each relationship of a PHF-bearing token carries one additional `Timestamp` of state. Relationships of tokens without PHF are unaffected, and no state migration is required.
- Older SDKs, wallets, and explorers that do not recognize the `periodic_holding_fee` field at the token level cannot inform their users of PHF exposure. SDKs, Mirror Node, wallets, and explorers MUST be updated before PHF is enabled on mainnet.

## Security Implications

PHF terms are on-ledger and visible before association: the mode, the cap, the cadence (`min_seconds_between_assessments`), and `first_assessment_at` are immutable for the life of the token. The current rate is mutable only within `[0, cap]` and only by `holdingFeeKey`. Rounding always favors the holder, the clamp guarantees no negative balance and no pending liability, periods in which the holder's relationship is frozen or lacks KYC do not accrue PHF, credits carried by a transfer list never re-value accrued cycles (credit-side settlement), and `TokenReject` provides an exit that waives pending fees while returning the balance to the treasury. Because PHF settlement is exempt from custom fees and is clamped to the holder's balance, a due settlement to a valid collector cannot fail; the only way an issuer fails to collect is an invalid collector, which is the issuer's own misconfiguration and is cured by restoring or rotating the collector. Issuers SHOULD disclose PHF terms off-ledger and SHOULD exempt omnibus or protocol accounts where charging them would double-charge end users.

**Balance fragmentation.** In **fixed mode**, splitting a balance across multiple accounts is self-defeating: each account pays the full flat amount per cycle, so N accounts pay N times the fee. In **fractional mode** the fee is proportional, so splitting preserves the aggregate fee except for the per-account sub-unit residue that floor-rounding forgives (`ZERO_ASSESSMENT_AFTER_ROUNDING`): an account whose `balance × current_per_cycle_basis_points × cycles_owed < 10000` settles to zero. This is the standard dust-rounding property of any floor-rounded proportional fee, bounded by per-account creation, association, and rent cost and by the token's chosen denomination. Issuers for whom fragmentation is a concern SHOULD use fixed mode or a denomination that makes the rounding floor negligible relative to meaningful holdings. PHF does not aggregate balances across accounts.

## How to Teach This

A PHF token charges holders periodically in one of two modes, chosen by the issuer at token creation:

- **Fractional mode** — a capped *percentage* of each holder's balance accrues at most once per declared cadence (e.g. 10 basis points per month). Larger holdings pay proportionally larger fees.
- **Fixed mode** — a capped *flat amount* per holder accrues at most once per declared cadence (e.g. 50 units of the token's smallest denomination per month). Every non-exempt holder pays the same amount per cycle regardless of how much they hold.

The collected amount is sent to a declared collector account. The fee accrues at most one cycle per cadence period, but accrued cycles settle together in a single debit valued at the current rate and the holder's balance at that moment — never more than the cap multiplied by the cycles settled, never more than the balance, and never creating a debt. The holder sees their stored balance shrink only when an assessment runs — either because the issuer's keeper called the assessment operation, or because tokens moved: transferring out settles the pending fee first, atomically with the transfer, and receiving tokens also settles any pending fee first, at the balance held *before* the credit — a deposit never makes past fees more expensive. The PHF debit is the entire charge for a settlement: a token's ordinary custom fees, which apply to regular transfers, are not assessed on top of a PHF settlement.

For holders and wallets: sending the entire stored balance fails while a fee is pending, because the fee settles first. Wallets SHOULD display a spendable balance — the stored balance minus the projected settlement, available from Mirror Node or the SDK helper. If the accrued fee ever exceeds the balance, only the balance is taken: there is no negative balance and no carried debt. A holder can exit via `TokenReject`, which waives pending fees and returns the balance to the token's treasury.

The mode and the cap are fixed for the life of the token; the issuer can move the current rate within the cap but never above it, and cannot switch modes.

## Reference Implementation

A reference implementation is expected to update:

- HAPI protobufs and `TokenCreate` / `TokenUpdate` validation.
- Consensus-node token-service logic for `assessTokenPeriodicHoldingFee`, touch settlement (including invalid-collector skip and trigger classification), key lifecycle per HIP-540, `last_assessed_at` bump rules, and association / dissociation / reject / freeze / KYC / pause interactions.
- The record stream and Mirror Node ingestion, including the new record field, assessment-result codes, and the `last_assessed_at` derivation rules.
- SDK builders for `PeriodicHoldingFee`, `PeriodicHoldingFeeUpdate`, and `TokenAssessPeriodicHoldingFeeTransaction`, plus the spendable-balance helper.

Tests MUST cover at minimum:

- integer overflow protection in `balance × current_per_cycle_basis_points × cycles_owed` (fractional) and `current_per_cycle_amount × cycles_owed` (fixed); multi-cycle backlog at variable rates in both modes; clamp behavior producing no negative balance and no pending liability while still advancing `last_assessed_at` by the full `cycles_owed × min_seconds_between_assessments`;
- PHF settlement exempt from custom fees: a token carrying a `FixedFee` (HBAR-denominated and token-denominated) and a `FractionalFee` is assessed, and the holder → collector settlement moves exactly the PHF `amount` with no custom fee deducted from it or charged on top, including when the clamp has consumed the holder's full balance; a due settlement to a valid collector never failing; Path A and Path B collector-side failure (deleted, dissociated, frozen, KYC-revoked, `receiverSigRequired`) skipping with `SKIPPED_COLLECTOR_INVALID` while the rest of the batch / the triggering operation proceeds;
- skip-condition precedence (first match wins, in the specified order) and sequential batch processing with duplicate holder entries re-evaluated against updated state (`SKIPPED_NOT_DUE`, or `SKIPPED_ZERO_BALANCE` after a full-balance clamp); empty and oversized batches rejected at validation; assessment against paused or deleted tokens rejected at validation;
- deterministic ordering and record emission for multiple touch settlements in a single transaction (several holders of one PHF token; one holder across several PHF tokens; mixed debit-side and credit-side);
- credit-side settlement valued at the pre-credit balance; the zero→positive reset taking precedence at zero balance, applying universally to synthesized credits (custom-fee assessment, PHF settlements), and NOT applying when the zero balance was produced by a same-transaction settlement (the advancement stands); the depth bound (credits from custom-fee assessment or PHF settlement transfers not triggering settlement); a credit-side settlement whose collector is invalid skipping with `SKIPPED_COLLECTOR_INVALID` while the triggering operation proceeds; skipped settlements charged per the Cost rule;
- a current-rate change (increase and decrease within the cap) landing while cycles are outstanding: the next settlement on either path values the entire backlog at the new current rate in both modes, with the record's `applied_rate` carrying the new rate;
- `elapsed` computed at nanosecond precision and floored to seconds, including exact-boundary cases; `last_assessed_at` reset to `max(consensus_timestamp, first_assessment_at)` on association, on zero→positive credit, and on every bump (exempt-list add/remove, treasury rotation, collector rotation, `TokenUnfreeze`, `TokenGrantKyc`), including bumps occurring before `first_assessment_at`;
- touch settlement followed by a triggering-operation failure reverting the settlement atomically with no record while cycles continue to accrue; `ZERO_ASSESSMENT_AFTER_ROUNDING` reported when the computed amount is zero; the record field-value table for every `assessment_result`, including `applied_rate` and `pre_assessment_balance`;
- `TokenUpdate` setting the wrong current-rate field rejected with `PERIODIC_HOLDING_FEE_MODE_MISMATCH`; negative current rates rejected; exempt-accounts update overlap, within-list duplicates, and already-exempt / non-exempt cases rejected; the collector-equals-treasury post-state invariant enforced across combined field changes (swap accepted, convergence rejected); collector signature required at creation and rotation; collector rotation bumping the incoming collector and — only when still associated — the outgoing collector;
- allowance-based transfers where the allowance covers only the requested amount, including failure when the post-settlement balance no longer covers it; full-balance transfers failing while a cycle is accrued;
- `TokenAirdrop` immediate-transfer and pending-airdrop classification, `TokenClaimAirdrop` sender-side settlement, `TokenCancelAirdrop` non-trigger; `TokenWipe` non-trigger with cycles continuing to accrue;
- key lifecycle: PHF created without `holdingFeeKey` operating in touch-settlement-only mode; key removal via the HIP-540 sentinel being permanent; `TOKEN_HAS_NO_HOLDING_FEE_KEY` on assess and mutations thereafter;
- HIP-904 auto-association `last_assessed_at` initialization; deterministic skip-code reporting for non-existent / deleted / expired / not-associated holders; pause accrual followed by post-unpause settlement.

## Rejected Ideas

- **Off-ledger billing, wipe-and-remint, smart-contract-only periodic fees, rebasing supply**: cannot reliably reach self-custody, contract, or DeFi-held balances; require operational keys inappropriate for routine fee collection; or change token accounting semantics for downstream integrations.
- **PHF as a `CustomFee` oneof variant, with multiple PHF entries per token**: conflates a time-scoped, signed-authorization fee with the transfer-triggered custom-fee model, forces reinterpretation of `all_collectors_are_exempt` (HIP-573), shares the 10-entry custom-fee limit unnecessarily, and creates an awkward two-key authorization model. A single top-level PHF per token covers the target use cases without these conflicts.
- **Network-driven cycle boundaries, autonomous background sweep, and HBAR assessment reserve**: introduce autonomous consensus work, per-token deterministic ordering requirements, a new failure mode (reserve exhaustion), and per-token state that grows over the life of the token. PHF instead uses issuer-pushed assessment plus touch settlement, which incur no autonomous consensus work and no per-token state growth.
- **An annualized cap requiring fractional exponentiation, and a bounded-but-mutable rate band that retains per-cycle rate history**: introduce cross-implementation determinism risk and unbounded state growth. PHF instead uses integer basis points (or a flat amount) per cycle, an immutable cap, and a single mutable current rate with no history.
- **Per-cycle compounded valuation of multi-cycle backlog**: requires an iterative loop or fractional exponentiation in consensus. PHF instead uses linear valuation at the settlement-time balance and rate, with the balance clamp as the worst-case bound and credit-side settlement preventing incoming credits from re-valuing accrued cycles.
- **Prospective effect for rate increases**: a pending `(value, effective_at)` pair would give holders an on-ledger exit window before an increase lands, at the cost of new pending-rate state and a second effective-rate lookup on every assessment. Rejected: the immutable cap — visible before association — is the declared bound on exposure, and any outgoing transfer settles accrued cycles at the terms in effect at that moment.
- **`TokenWipe` as a touch-settlement trigger**: would let `wipeKey` alone authorize a holder → collector value transfer — outside wipe's burn-only authority domain — and would make full-balance wipes fail deterministically whenever backlog exists. Wipe remains burn-only; issuers assess before wiping.
- **Requiring the spender's allowance to cover touch settlement**: the settlement is authorized by the token's declared PHF terms and debited from the holder's balance; gating it on the allowance protected nothing (the allowance is not decremented by the settlement, and the keeper can assess without any allowance) while breaking exact-allowance integrations.
- **Reusing `feeScheduleKey` for PHF mutations**: would extend its scope to an unrelated authority domain. PHF uses a dedicated `holdingFeeKey`.
- **Assessing the token's custom fees on PHF settlement transfers**: lets the custom-fee schedule debit a holder on a settlement they may not have signed (Path A is keeper-triggered), breaks the guarantee that holder exposure is bounded by `cap × cycles_owed` and the balance, and creates a settlement-failure mode whenever the holder cannot cover the custom fee. PHF settlement is therefore exempt from custom fees by a dedicated rule analogous in effect to the existing treasury exemption (a blanket exemption from all the token's custom fees) — triggered by the transfer being a PHF settlement and independent of `all_collectors_are_exempt` — rather than introducing a new transfer path. The holder's own `CryptoTransfer` of the token is still assessed for custom fees as usual; only the PHF settlement transfer is exempt.
- **A single token-level `last_assessed_at` instead of one per relationship**: appears to save state, but cannot represent holders that associate, transfer, freeze, lose KYC, or become exempt at independent times — each of which must advance or reset accrual for that holder alone. A shared timestamp would charge a newly-associated holder for time before they held the token, and is incompatible with touch settlement, which settles individual holders asynchronously when they transact. Making it correct would require assessing every holder atomically at each cycle boundary — exactly the autonomous, unbounded consensus work this design avoids. The minimal correct state is therefore one `last_assessed_at` on the relationship record HTS already keeps, with no holder registry and no ex-holder state (see "State Model").
- **PHF-specific `exempt_account_ids` modeled on a custom-fee field**: replaced by a top-level `exempt_accounts` list, with semantics independent of `all_collectors_are_exempt`.
- **Auto-exempting custom-fee collectors via a flag on PHF**: PHF semantics are independent of custom-fee semantics; a flag reaching into the custom-fee schedule would introduce cross-feature coupling and force consensus to walk the custom-fee list at every assessment. Issuers enumerate the exempt set explicitly in `exempt_accounts`.
- **Fees denominated in HBAR or another token**: introduces recurring insufficient-balance and allowance problems outside the held token.
- **PHF for NFTs**: holding semantics for unique tokens require a separate design.

## Open Issues

- Final protobuf tag and enum-ordinal assignments must be made by protobuf maintainers, including the `SchedulableTransactionBody` entry and `HederaFunctionality` value.
- HIP-1261 fee-schedule line items — the per-processed-holder component and base fee of `assessTokenPeriodicHoldingFee`, and the touch-settlement line item charged to the triggering transaction's payer — should be validated with Hedera governance and testnet benchmarks.
- Throttle policy specific to `assessTokenPeriodicHoldingFee` (whether it shares the existing token-service throttle bucket or has a dedicated one) should be confirmed with consensus-node maintainers.
- Mirror Node consistency guarantees for keeper holder-enumeration queries (lag bounds, pagination semantics) should be documented in Mirror Node specifications.
- The precise EVM log surface when touch settlement is triggered via precompile (events on the calling contract's behalf) should be confirmed with HSCS and Mirror Node implementers.
- HIP-551 atomic batches: whether inner transactions trigger touch settlement individually, and how Path B atomicity composes with whole-batch revert, should be specified with consensus-node maintainers.
- Token expiry (distinct from the holder-account-expiry skip `SKIPPED_ACCOUNT_EXPIRED`, which is normatively settled above): the behavior of assessment and accrual against an expired-but-not-deleted token is pending the network's token-expiry enforcement semantics.

## References

- HIP-1: Hiero Improvement Proposal Process — https://hips.hedera.com/hip/hip-1
- HIP-18: Custom Hedera Token Service Fees — https://hips.hedera.com/hip/hip-18
- HIP-336: Approval and Allowance API for Tokens — https://hips.hedera.com/hip/hip-336
- HIP-423: Long Term Scheduled Transactions — https://hips.hedera.com/hip/hip-423
- HIP-540: Change or Remove Existing Keys From a Token — https://hips.hedera.com/hip/hip-540
- HIP-573: Blanket exemptions for custom fee collectors — https://hips.hedera.com/hip/hip-573
- HIP-904: Frictionless Airdrops — https://hips.hedera.com/hip/hip-904
- HIP-551: Batch Transactions — https://hips.hedera.com/hip/hip-551
- HIP-1010: Update Token Custom Fee Schedules via Smart Contracts — https://hips.hedera.com/hip/hip-1010
- HIP-1261: Simple Fees — https://hips.hedera.com/hip/hip-1261
- Hedera documentation: Custom Token Fees — https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service/custom-token-fees
- Hiero consensus node protobufs (HAPI) — https://github.com/hiero-ledger/hiero-consensus-node/tree/main/hapi

## Copyright/license

This document is licensed under the Apache License, Version 2.0 — see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
