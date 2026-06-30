---
hip: 0000
title: Reduce the Smart Contract Service Gas Price
author: Mohammed Shaikjee (@mshakeg)
working-group: John O'Connor (@jpo424), Benjamin White, Peter Campbell
requested-by: SaucerSwap
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1508
type: Standards Track
category: Core, Service
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-06-27
---

## Abstract

Hedera prices smart-contract execution in **USD-denominated gas** — a per-gas price set administratively in the fee schedule (file `0.0.111`, in tinycents) and paid in HBAR at the current exchange rate (file `0.0.112`). The current price is **117 tinybar/gas** — ≈ **$0.0000000849/gas (~$0.085 per 1,000,000 gas)** at the snapshot exchange rate of 2026-06-27 — and, unlike the token-denominated, demand-responsive gas markets on Ethereum and its rollups, it **does not fall when the network is underutilized.**

This HIP proposes a **single, conservative 3× reduction** of the smart-contract gas price — the USD/tinycent value set in the fee schedule. At the 2026-06-27 exchange-rate snapshot this is equivalent to reducing the effective price from **117 to 39 tinybar/gas** (≈ $0.0000000849 → $0.0000000283/gas; ~$0.085 → ~$0.028 per 1,000,000 gas). The change is deliberately narrow:

- It reduces only the **per-gas price for smart-contract execution** (`ContractCall`, `ContractCreate`, `EthereumTransaction`).
- **HAPI service fees are unchanged.** Operations dispatched from the EVM through system contracts (e.g. HTS token transfers) are priced by converting a fixed USD HAPI fee into gas; because the gas *amount* for those operations scales inversely with the gas price, their **USD cost is unchanged** — but the gas amount they report rises ~3×, which has gas-limit and per-transaction-cap implications (see §Backwards Compatibility). The 20% system-contract markup is also unchanged.
- The reduction applies **uniformly**, including to storage writes (`SSTORE`).

The economic basis is that **Hedera's smart-contract capacity is substantially underutilized** — public indicators suggest the service runs at roughly 1% or less of capacity (see §Motivation) — so the marginal cost of additional execution is near zero, and a fixed price set for cost recovery charges **scarcity rent on an abundant resource** — suppressing exactly the activity Hedera wants to attract. A 3× cut is a conservative opening step that sits far inside the available headroom; a demand-responsive pricing mechanism is identified as future work (§Future Work) and is out of scope here.

Concretely, the fixed cost of settling an action on-chain sets a **minimum economically viable transaction size**: a 3× cut roughly **halves** it — e.g. from ~$50 to ~$21 of notional for a party capturing 5 bps (§Motivation, "Fixed settlement cost sets a minimum viable transaction size"). That improvement is bounded below by the **fixed HTS/HAPI fee component**, which (being held constant in USD) the execution-gas reduction cannot lower; pushing the floor further is left to follow-on work (§Future Work).

## Motivation

### The smart-contract service is almost entirely idle

Hedera's smart-contract throughput sits at a tiny fraction of its capacity:

- The smart-contract service runs at roughly **0.5% of its transaction throttle ceiling** on average (~1.6 smart-contract tx/s against a documented ~350 tx/s ceiling) — about **1/200 of capacity**. Daily-average active contracts *declined* through 2025.
- On a gas basis, realized smart-contract gas consumption is an estimated **low-single-digit percent or less** of even the legacy 15,000,000 gas/sec throttle — and HIP-1249 (v0.69.0) subsequently raised effective capacity by ~an order of magnitude after benchmarks showed real workloads (a Uniswap port) sustaining **150M+ gas/sec, >10× the old throttle**. Against the post-HIP-1249 ceiling, realized utilization is **well under 1%**.
- Hedera DeFi TVL is approximately **$46–55M**, versus ~$4.1B on Base and ~$37B on Ethereum — **under 0.05% of cross-chain DeFi**. DEX volume has been flat and is nowhere near capacity-bound.

> Note: realized average gas/sec is not published by Hedera; the ~0.5% TPS figure is derived from public service-mix data and the gas-percentage is an estimate. The conservative, defensible statement is: *the smart-contract service uses on the order of 1% or less of available capacity.* (To be confirmed against live mirror-node / throttle-config data before submission.)

### A fixed price charges scarcity rent on an abundant resource

When capacity is abundant and the marginal cost of one more contract call is near zero, a price set for fixed-cost recovery is **allocatively inefficient**: every transaction that does not happen because the fee is too high is pure lost value — the capacity sits empty regardless. This is the textbook case for **off-peak / spare-capacity pricing** (as used for airline standby seats, off-peak electricity, and cloud spot instances): on otherwise-idle capacity, capturing any usage above marginal cost is strictly better than an empty slot, and pricing high to "recover costs" from a near-empty service recovers almost nothing while deterring the usage that would fill it.

Hedera's gas price has **no mechanism to reflect this.** Because it is administratively fixed in USD terms, it does not fall when utilization is low — so smart-contract users pay a cost-recovery price at all times, even though the service is ~99% idle. Every EIP-1559 chain, by contrast, lets its base fee fall toward marginal cost when blocks are empty.

### The price sits far above the true marginal cost of the resources

The only genuinely permanent marginal cost a contract imposes is **state growth**. A rough order-of-magnitude sanity check suggests the gas price is well above it:

- Storing 1 MB of contract state costs `(1 MiB ÷ 32 B/slot) × 20,000 gas/slot = 655,360,000 gas`, which at the current price is **~$56 per MB** (one-time, permanent).
- A deliberately *lower-bound* estimate of the cost of holding 1 MB *forever, replicated across all consensus nodes* — `~0.001 GB × ~$0.10/GB/month × ~30 nodes`, present-valued — is on the order of **$0.1–$1 per MB**. This is a floor, not the true cost: it omits state-trie/metadata overhead, archive and mirror-node copies, backups, operational margin, and the pay-once-store-forever externality, all of which raise the real figure.

So even allowing generously for those omissions, gas prices storage **one to two orders of magnitude above its underlying cost.** After a 3× reduction, `SSTORE` storage still costs ~$18.6/MB — comfortably above the lower-bound estimate, preserving the anti-state-bloat premium with large margin (see §Security Implications). The point is a sanity check that the price has ample room to fall — not a claim that $0.1–$1/MB is the precise cost.

### Secondary context — peer pricing

This is *supporting context, not the core argument*, because L2 rollups have a fundamentally different cost structure (they borrow Ethereum's security, amortize over far higher volume, and post data as cheap blobs), so a raw comparison overstates the case. With that caveat, at a snapshot of representative prices (as of 2026-06-27; execution-gas price = chain gas price × native-token USD price; L2 figures exclude the separate L1 data-availability fee):

| Network | USD per 1M gas (execution) |
|---|---|
| Base | ~$0.008 |
| Arbitrum One | ~$0.032 |
| **Hedera (current)** | **~$0.085** |
| **Hedera (after 3× cut)** | **~$0.028** |
| Ethereum L1 (calm) | ~$0.125 |

At this snapshot, a 3× cut places Hedera's execution-gas price between the cheapest L2s and Ethereum L1; the exact ordering shifts continuously with native-token prices and congestion, so this is directional context, not a standalone justification.

### Fixed settlement cost sets a minimum viable transaction size

The clearest builder-facing consequence of the gas price is that a fixed per-settlement cost imposes a **minimum economically viable transaction size**. Any party that pays to settle an on-chain action — a trader capturing spread, or a protocol settling on a user's behalf and recovering its cost from a fee — only breaks even when the value it captures exceeds the settlement cost. Expressed in basis points of the transaction's notional:

```
minimum viable notional = settlement cost ÷ (value captured in bps ÷ 10,000)
```

Take the worked example below (§5): an all-in settlement cost of **~$0.0248** today, split into a **~$0.0212** variable EVM-execution component (which scales down with the gas price) and a **~$0.0036** HTS/system-contract component (fixed in USD; 3 token transfers at ~$0.0012 each). For a party capturing **5 bps** of notional, the minimum viable size is `$0.0248 ÷ 0.0005 =` **~$50** today — below which the settlement cost exceeds the 5 bps captured and the action is settled at a loss. (At 10 bps the figure is ~$25; the relationship scales linearly with the bps captured.) A 3× gas-price reduction lowers all-in cost to **~$0.0107**, dropping the minimum viable size to **~$21** — roughly a **2.3× improvement** in the range of activity that is economic to settle.

The table below shows how the minimum viable notional falls as the reduction deepens, for a representative 5 bps capture (the variable EVM component scales with the cut; the HTS/HAPI component stays fixed):

| Gas-price cut | EVM component | All-in settlement | Min. viable notional @ 5 bps |
|---|---|---|---|
| 1× (today) | $0.0212 | $0.0248 | ~$50 |
| **3× (this HIP)** | **$0.0071** | **$0.0107** | **~$21** |
| 5× | $0.0042 | $0.0078 | ~$16 |
| 10× | $0.0021 | $0.0057 | ~$11 |
| ∞ (EVM gas → $0) | $0 | $0.0036 | **~$7.2** |

Two things follow. First, **the 3× cut is real and material**: it roughly halves the smallest transaction that can sustainably be settled. Second, **the execution-gas price is not the ultimate floor** — because the HTS/HAPI component is fixed in USD, the minimum viable size cannot fall below **~$7.2 at 5 bps no matter how far the gas price is cut** (last row). The fixed HTS/HAPI cost, not the execution-gas price, is the binding lower bound on small-transaction economics. A more aggressive target makes the trade-off concrete: sustaining a **$10 notional at 5 bps** (a $0.0050 fee budget) sits *above* the ~$7.2 floor, so the gas lever alone can reach it — but only with a **~15× cut** (the EVM component must fall from $0.0212 to ~$0.0014, the room left under the budget after the fixed $0.0036), far beyond the conservative 3× proposed here. Any target *below* the ~$7.2 floor cannot be reached at any gas price and would require reducing the HTS/HAPI service fees themselves, which is **out of scope for this HIP** (see §Rejected Ideas, §Future Work).

A 3× reduction is therefore the right conservative first step: it delivers the bulk of the improvement available from the execution-gas lever (~2.3× lower viable size), while the deeper, structural question of the HTS/HAPI floor is left to follow-on work.

### Why this matters

High fixed execution pricing penalizes precisely the activity Hedera's low, predictable fees are meant to enable: small-value transactions, high-frequency and per-operation-granular contract designs, batched settlement, and the general DeFi/dApp usage the ecosystem is trying to grow. Lowering the price on an idle service removes an unjustified barrier at near-zero cost to the network. The motivation is general to the Smart Contract Service and is not specific to any single protocol or use case.

## Rationale

1. **Marginal-cost reasoning, applied honestly.** A blockchain is a high-fixed-cost, near-zero-short-run-marginal-cost system. Pure marginal-cost pricing cannot recover fixed costs, so the price is necessarily a cost-allocation (policy) choice rather than a derivable constant. But that choice should respond to *utilization*: at ~99% idle, the case for charging a full cost-recovery price collapses, because there is no scarcity to ration and the foregone-revenue cost of cutting is near zero (there is almost no volume to forgo revenue from).

2. **Why a 3× cut specifically — and why conservative.** 3× is deliberately modest, not cost-optimal. It sits far inside the available headroom on every axis: capacity utilization is ~1% (room for ~100× more load before the throttle binds), and even after the cut, storage gas remains ~17×+ above the lower-bound storage-cost estimate. A conservative first step is chosen so the proposal is safe and uncontroversial to adopt and to observe, leaving room to go further once its effects are measured.

3. **Why a static cut rather than a new mechanism, for now.** The most principled long-term fix is demand-responsive pricing that lets the price fall toward marginal cost when idle and rise under load (see §Future Work). That is a larger engineering and design effort. A static reduction captures most of the near-term benefit immediately, requires no new mechanism — only a fee-schedule parameter change — and is the natural first step toward the dynamic model.

4. **Predictability is preserved.** The change keeps Hedera's USD-denominated, fixed-fee model intact; it only lowers the level. Enterprises retain predictable dollar-denominated costs.

## User stories

1. As a DeFi/dApp developer, I want lower execution costs so that small-value and high-frequency contract interactions are economical on Hedera.
2. As a protocol designer, I want to keep operations granular and individually observable (per-operation logic, try/catch, fault attribution) without being pushed toward coarse designs purely to save gas.
3. As an HBAR holder / ecosystem participant, I want the smart-contract service's idle capacity to be priced to attract usage, growing the ecosystem rather than collecting cost-recovery rent from a near-empty service.
4. As an enterprise integrator, I want fees to remain predictable and USD-denominated, with only the level reduced.

## Specification

### 1. Current pricing (informative)

- The smart-contract gas price is set in the **fee schedule** (system file `0.0.111`), denominated in **tinycents** (USD), and converted to HBAR (tinybars) at the active **exchange rate** (system file `0.0.112`).
- The gas price is set in the fee schedule in **tinycents (USD)**. At the 2026-06-27 snapshot it converts to **117 tinybar/gas** for `ContractCall`, `ContractCreate`, and `EthereumTransaction` (per the live fee schedule / mirror node) — i.e. ≈ **$0.0000000849 per gas** (~$0.085 per 1,000,000 gas) at the snapshot exchange rate (30,000 HBAR = 217,689 ¢, ~$0.0726/HBAR).
- The **governed parameter is the tinycent (USD) gas price**; the tinybar/gas value (the HBAR actually charged) is *derived* from it via the exchange rate and floats as the rate moves. The 117 tinybar/gas figure is the snapshot of that derived value.

> The 117 tinybar/gas value is a snapshot and SHOULD be reconfirmed against the live fee schedule at submission.

### 2. Proposed change

The smart-contract gas price (the **tinycent/USD value** in the fee schedule) SHALL be reduced by a factor of **3×**. At the 2026-06-27 exchange-rate snapshot, this corresponds to a reduction from **117 to 39 tinybar/gas**:

| | tinybar/gas (snapshot) | Per gas (USD, snapshot) | Per 1,000,000 gas |
|---|---|---|---|
| Current | 117 | ~$0.0000000849 | ~$0.085 |
| **Proposed** | **39** | **~$0.0000000283** | **~$0.028** |

- The reduction applies **uniformly** to all smart-contract execution gas, including storage operations (`SSTORE`).
- The change is a **fee-schedule parameter update** — no consensus rule, opcode semantics, record format, or contract-facing API changes.
- The USD-denominated, exchange-rate-converted pricing model is **unchanged**; only the level moves.

### 3. Invariants — what does NOT change

- **HAPI service fees are unchanged.** All native HAPI transaction fees retain their current USD-denominated prices.
- **System-contract (HTS precompile) operation costs are unchanged in USD.** When a contract invokes a system contract, the operation's gas is derived by converting a fixed USD HAPI fee (plus the existing 20% system-contract markup) into gas units at the gas price. Because the gas price falls 3×, the **gas amount reported for these operations rises ~3×, holding their USD cost constant.** A token transfer via the HTS system contract costs the same in USD after this change as before.
- **The 20% system-contract markup is unchanged.**
- **Gas *amounts* (the opcode gas schedule) are unchanged.** Only the price per gas changes. Relative resource metering — including the heavy weighting of state writes — is preserved.

### 4. Enforcement and rollout

- The change is enacted by updating the fee schedule (file `0.0.111`) through the network's standard fee-schedule governance process.
- No SDK, consensus API, or contract bytecode changes are required (apps with hardcoded gas limits may need config updates — see §Backwards Compatibility). Pure-execution transactions are simply billed less for the same execution (per HIP-1249 precise billing, callers already pay only for gas actually used). Transactions that invoke system contracts (HTS) should note the gas-accounting effect described in §Backwards Compatibility and may need to re-estimate gas limits.

### 5. Worked example (informative)

Consider a representative DeFi contract call that performs ~250,000 gas of pure EVM execution (e.g. routing/matching logic) plus 3 HTS token transfers via the system contract — a typical settlement that routes value between two counterparties through an intermediating contract — at the current 117 tinybar/gas snapshot price. Each HTS transfer here costs a fixed **~$0.0012** in USD — for this illustrative simple fungible transfer with no custom fees (~$0.001 base × 1.2 markup); actual HTS fees vary with transfer shape and any custom fees. Because that gas is *derived* from a fixed USD fee, it is **~14,100 gas** at the snapshot price and rises to **~42,400 gas** after the 3× cut:

| Component | Now: gas | Now: USD | After 3× cut: gas | After: USD |
|---|---|---|---|---|
| Pure EVM execution | 250,000 | ~$0.0212 | 250,000 | **~$0.0071** |
| 3× HTS transfer | ~42,400 | ~$0.0036 | **~127,100** | ~$0.0036 |
| **Total** | ~292,400 | ~$0.0248 | **~377,100** | **~$0.0107** |

Two effects are visible: (1) the **USD benefit accrues to the pure-execution portion** — a compute-heavy contract approaches the full 3× reduction, while an HTS-transfer-*dominated* transaction benefits much less, since HTS USD costs are held constant; and (2) the **total gas rises** (~292k → ~377k here) because the HTS gas units inflate to hold their USD cost constant — the gas-accounting effect detailed in §Backwards Compatibility. Contracts whose cost is dominated by HTS transfers should expect only modest USD savings.

> **Note on the HTS figures.** The table uses a clean `$0.0012 ÷ live-price` derivation for illustration. The *actual* on-chain gas for a simple fungible HTS transfer is **~15,284 gas (~$0.0013)** — observed in production and matching the system-contract gas calculator's output. The difference from the simplified `$0.001 × 1.2` model (~8%) appears to come from the exact fee-schedule / calculator inputs rather than plain rounding. Substituting the observed figure for all 3 transfers shifts the totals to ~$0.0251 (now) / ~$0.0110 (after) and ~296k / ~388k gas; the qualitative conclusions are unchanged. After the 3× cut, a single such transfer bills ~45,852 gas at the same ~$0.0013 USD.

**Viability read.** At this ~$0.0248 all-in cost, the settlement only breaks even for a party that captures more than **~2.5 bps** of a $100 notional (equivalently, that settles notionals above ~$50 at a 5 bps capture). After the 3× cut, the same break-even falls to **~1.1 bps** / ~$21. The reduction lowers the minimum economically viable transaction size by ~2.3×, but cannot push it below the fixed HTS/HAPI component — see §Motivation, "Fixed settlement cost sets a minimum viable transaction size," for the full break-even analysis and the resulting floor.

## Backwards Compatibility

- **Backward compatible in cost terms, with a gas-accounting caveat (below).** In USD/HBAR terms, every transaction that still executes with sufficient gas has the same or lower metered cost: pure execution falls ~3×, system-contract (HTS) operations are unchanged. There are no record format, field, opcode, or selector changes, and HBAR-denominated billing continues through the existing exchange-rate mechanism.

### Compatibility impact of unchanged HAPI fees

Holding system-contract (HTS) USD costs constant while the gas price falls 3× means **the gas *amount* charged for those operations rises ~3×** (gas = fixed USD fee ÷ gas price). This is a real behavior change for some transactions, so this proposal is **not** unconditionally "no transaction changes outcome":

- **Pure EVM execution** becomes ~3× cheaper in USD.
- **HTS/system-contract USD fees are unchanged**, but **their gas-unit charge rises ~3×.**
- Consequently, the change can affect **`gasLimit` sufficiency, gas estimation, `gasleft()`-sensitive code, gas forwarded to sub-calls, batching limits, and headroom under the 15,000,000 gas-per-transaction cap.** A transaction with a tight gas limit, or an HTS-heavy/batched transaction near the per-tx cap, could begin to fail (out-of-gas or cap-exceeded) where it previously succeeded.
- This lands specifically on HTS-heavy DeFi/settlement transactions — the same constituency the HIP aims to help — so it must be surfaced rather than assumed away.

**Mitigation / rollout.** Callers SHOULD re-estimate gas limits after the change; standard `eth_estimateGas`-equivalent paths already return the new, higher HTS gas amounts. The change SHOULD be measured on testnet against representative HTS-heavy transactions (before/after gas usage and per-tx-cap headroom) prior to mainnet rollout. This HIP does not alter the 15M per-tx cap or change how rolled-in HAPI gas is counted against it; if the reduced HTS headroom proves materially constraining for real workloads, separating rolled-in HAPI fee gas from computational gas for per-transaction cap/throttle accounting is a candidate for a follow-up (see §Open Issues).

## Security Implications

- **No new attack surface.** Per-transaction work remains bounded by the unchanged 15M-gas-per-transaction cap and the (post-HIP-1249) ops/sec throttle. Lowering the *price* does not change *how much* a transaction can do.
- **State-bloat deterrence is preserved.** A common concern is that cheaper gas makes storage writes cheaper and invites state bloat. After the 3× cut, an `SSTORE`-backed 1 MB of state costs ~$18.6 — still **~17× or more above the ~$0.1–1/MB lower-bound cost estimate** for storing it forever across all nodes. The anti-bloat premium remains large; the gas *amount* for `SSTORE` (which carries the deterrent) is unchanged, and only the price scales. If state growth ever became a concern, it is better addressed by the gas schedule (amounts) or a dedicated storage-pricing mechanism than by an elevated flat execution price.
- **Network revenue impact is negligible.** Smart-contract gas is a small revenue line precisely because the service is ~99% idle. (A precise figure for Hedera's *network smart-contract gas revenue* is not published; as a rough proxy — not gas revenue — protocol/DEX fees across Hedera DeFi are on the order of ~$1.9M/yr.) A 3× cut therefore forgoes very little current revenue, while demand for cheaper execution is elastic and ecosystem growth (more contracts, more HBAR utility) accrues value beyond direct gas fees. As utilization rises, absolute gas revenue can grow even at the lower per-unit price.
- **Predictability is preserved.** The USD-denominated, fixed model is retained; only the level is lower. There is no new volatility introduced (unlike a token-denominated or, prematurely, a dynamic model).
- **Throttle protection is unaffected.** Congestion continues to be managed by the throttle, not by price; the 3× headroom contemplated here is far within the available capacity (~1% utilized).

## How to Teach This

- Documentation SHOULD state the new gas price and clarify the key invariant: **HAPI service fees (including HTS operations via system contracts) are unchanged in USD; only pure-execution gas costs fall ~3×.**
- Developer guidance SHOULD note that HTS-precompile operations will report ~3× higher gas numbers for the same USD cost (because gas got cheaper), so estimates keyed off gas amounts should be recalibrated while USD/HBAR estimates for HTS ops stay the same.
- Release notes SHOULD frame the change as a utilization-driven reduction on an underused service.

## Reference Implementation

The change is a value update to the smart-contract gas price in the fee schedule (system file `0.0.111`), enacted through the standard fee-schedule update process. No consensus-node code changes to pricing *mechanics* are required; system-contract gas derivation already converts USD fees at the prevailing gas price, so HTS-operation gas amounts adjust automatically. Validation/regression coverage SHOULD confirm that HTS-precompile operations bill the same USD/HBAR before and after, and that pure-execution costs fall ~3×.

## Rejected Ideas

1. **Lower HAPI service fees (e.g. the HTS transfer fee).** Out of scope and a much larger, core-tokenomics change affecting every token transfer network-wide. This HIP deliberately leaves HAPI fees untouched.
2. **Reduce or remove the 20% system-contract markup.** Negligible in absolute terms (fractions of a cent per operation) and a separate, deliberate HIP-206 design choice; not worth coupling to this proposal.
3. **A larger immediate cut (e.g. 10×+).** The headroom exists (utilization ~1%; storage gas well above the lower-bound storage-cost estimate), but a conservative first step is preferred so the effect can be observed before going further.
4. **Jump straight to a demand-responsive mechanism.** The most principled end-state (see §Future Work), but a larger design/engineering effort. A static cut captures most near-term benefit immediately and is the natural first step.
5. **Switch to token-denominated gas pricing.** Would sacrifice Hedera's USD-denominated predictability and is not necessary to achieve a lower idle-state price.

## Future Work

**Demand-responsive pricing.** The deeper inefficiency is that Hedera's gas price is **static** — it does not fall toward marginal cost when the network is idle, nor rise to ration capacity under load. A follow-up proposal could introduce **demand-responsive pricing** (an EIP-1559-style base fee that adjusts with utilization), ideally **bounded by a USD ceiling** so Hedera retains predictable maximum fees while allowing the effective price to fall toward marginal cost during the prevailing low-utilization periods. This static 3× reduction is a conservative first step toward that model and does not preclude it.

**The HTS/HAPI fee floor.** Because this HIP holds HTS/system-contract fees fixed in USD, the all-in cost of HTS-heavy transactions (e.g. token settlements) cannot fall below that fixed component (~$0.0036 in the worked example — 3 transfers at ~$0.0012) no matter how far the execution-gas price is cut. As shown in §Motivation, this sets a hard lower bound on the minimum economically viable transaction size — roughly **~$7.2 of notional at 5 bps** in the worked example — that the execution-gas lever alone cannot cross. Lowering that floor, to make very small or very thin-margin settlements sustainable, would require a **separate proposal revisiting the HTS/HAPI service fees and/or the 20% system-contract markup**. That is intentionally out of scope here, but this HIP's break-even analysis quantifies why it is the natural next lever once the execution-gas headroom is exhausted.

## Open Issues

1. Reconfirmation of the live fee-schedule gas-price value at submission (snapshot here: 117 tinybar/gas) and its USD-equivalent at the then-current exchange rate.
2. Confirmation of live smart-contract throttle-configuration values and realized gas/sec utilization, to firm up the "~1% utilized" figure with primary network data.
3. Whether the reduced per-transaction-cap headroom for HTS-heavy transactions (from the ~3× inflation of HTS gas units) is materially constraining for real workloads — and, if so, whether a follow-up should separate rolled-in HAPI fee gas from computational gas for per-transaction cap/throttle accounting.
4. Whether a steeper or staged reduction should follow once the effect of the 3× cut is measured.
5. Whether a follow-on proposal should address the fixed HTS/HAPI fee component, which — being USD-fixed — bounds the minimum viable transaction size below the level the execution-gas reduction can reach (see §Motivation, §Future Work).

## References

- HIP-185: Smart Contract Service Gas Based Throttling (origin of the 15M gas/sec gas throttle)
- HIP-206: Hedera Token Service Precompiled Contract (system-contract pricing; the 20% markup; "cheaper to call HTS directly than via HSCS")
- HIP-1249: Precise Smart Contract Throttling (ops/sec throttle; precise billing; ~10× effective capacity increase; benchmarks showing 150M+ gas/sec)
- Hedera documentation: Smart Contracts — Gas and Fees
- Hedera blog: Rolling Smart Contract Hedera API Fees into Gas Fees (documents the Hbar↔gas price basis)
- Hedera mirror node / fee schedule: live gas price (snapshot 117 tinybar/gas, 2026-06-27) and exchange rate (file `0.0.112`)
- Hedera fee schedule (system file `0.0.111`) and exchange rate (system file `0.0.112`)
- Messari, State of Hedera Q1 2025 and Q3 2025 (service mix, active-contract counts, DEX volume)
- DefiLlama: Hedera chain TVL and fees
- EIP-1559: Fee market change (referenced for future demand-responsive work)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 – see LICENSE or (https://www.apache.org/licenses/LICENSE-2.0)
