---
hip: 0000
title: Explicit Status and Pre-flight Parity for the Contract Trace Data Size Limit
author: Shayan Salehi (@shayansal)
requested-by: Shayan Salehi (ColdAI)
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1560
type: Standards Track
category: Service
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-10-05
updated: 2026-10-05
---

## Abstract

Since release v0.74, Hiero consensus nodes limit the estimated serialized size of the contract trace data
(actions, storage slot usage, and created bytecode) recorded for a transaction to
`contracts.maxSerializedTraceDataBytes`, 262,144 bytes by default. A contract transaction whose trace goes over the
limit is executed in full, then failed with `INSUFFICIENT_GAS` and rolled back. The gas used is the full execution
gas whatever the gas limit, and no trace is published. Mirror-node simulation (`eth_estimateGas`, `eth_call`) runs
with trace recording switched off, so it reports success for the same call.

This HIP keeps the limit, its value and its fail-closed behavior, and makes the limit visible as itself:

1. a dedicated response code, `MAX_CONTRACT_TRACE_DATA_EXCEEDED`, in place of `INSUFFICIENT_GAS` for this failure;
2. pre-flight parity: mirror-node simulation estimates the same trace size and reports the same status, and the
   JSON-RPC relay surfaces it as a distinct error.

It also asks that the limit be documented and that changes to its value be announced like other contract limits.

## Motivation

### The failure is reported as a gas problem

[`ConversionUtils.throwIfUnsuccessfulCall`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-smart-contract-service-impl/src/main/java/com/hedera/node/app/service/contract/impl/utils/ConversionUtils.java#L801-L826)
at v0.77.2:

```java
if (hasExceededTraceDataSizeLimit(streamBuilder, context)) {
    throw new HandleException(INSUFFICIENT_GAS, rollbackHandler);
}
```

`INSUFFICIENT_GAS` tells a developer to raise the gas limit, which cannot help: the trace size depends only on
what the transaction does. Every tool in the EVM workflow then agrees with the developer's mistake:

- `eth_estimateGas` returns an estimate well under the gas limit that failed;
- an anvil or Hardhat fork of the network replays the call successfully with the same gas used;
- the mirror node's `/contracts/results/{id}/actions` returns an empty list, because the limiter clears the trace,
  so there is nothing to debug from.

### Measured on Hedera testnet

The same `completeChannel` call to a CLPR service contract on Hedera testnet
(`0xa6db474e3047c3d43b10a4ff7abad547d89982b9`), carrying a 512-key BLS committee configuration in 67,364 bytes of
call data, was submitted five times at gas limits from 5,611,286 to 15,000,000:

| Transaction | Gas limit | Gas used | Status |
| --- | ---: | ---: | --- |
| [`0x6f0285ff…`](https://hashscan.io/testnet/transaction/0x6f0285ff22c877035165e025a01350fc7077fffe8bbb2a0f9d7fbebaed99781e) | 5,611,286 | 4,062,470 | `INSUFFICIENT_GAS` |
| [`0x4b95f023…`](https://hashscan.io/testnet/transaction/0x4b95f023fca443c71c9ed892be2dcd2aaf4ee247f819a7b91ff74c11b86d9643) | 12,949,122 | 4,062,470 | `INSUFFICIENT_GAS` |
| [`0xed92841b…`](https://hashscan.io/testnet/transaction/0xed92841b6bae53ef5da7c25d9f0412a1d397decbe6a2709f6d07292c46efec90) | 6,000,000 | 4,062,470 | `INSUFFICIENT_GAS` |
| [`0xa289c0b9…`](https://hashscan.io/testnet/transaction/0xa289c0b9ce2665fea2bceab8ad87c2a8ca21031b2d4a243a5f5c610e3379d0c7) | 6,000,000 | 4,062,470 | `INSUFFICIENT_GAS` |
| [`0x7dc546cd…`](https://hashscan.io/testnet/transaction/0x7dc546cdba0c66c0c0a5bb18014c60786071c69045489a4a2e8256826542cdf3) | 15,000,000 | 4,062,470 | `INSUFFICIENT_GAS` |

All five used exactly 4,062,470 gas, about 9.62 HBAR each, and have no recorded actions. `eth_estimateGas` for the
call succeeded. Replayed on an anvil fork of testnet at the block before the first attempt, the call succeeds with
the same gas, and its call trace is:

| Frame | Count | Input + output |
| --- | ---: | ---: |
| `CALL` to the service contract | 1 | 67,364 B |
| `DELEGATECALL` into its logic module (same input) | 1 | 67,364 B |
| `STATICCALL` to the verifier contract | 1 | 68,260 B |
| `STATICCALL` ecrecover (`0x01`) | 1 | 160 B |
| `STATICCALL` `BLS12_G1ADD` (`0x0b`), one per key check | 257 | 98,688 B |
| **Total** | **261 frames, 37 storage slots** | **301,836 B raw** |

The raw frame bytes alone are 115 % of the limit, and about 126 % with an allowance for the protobuf framing of
261 actions and 37 slots. The developer who found this needed a fork replay and a reading of the consensus-node
source to learn that the failure was not about gas.

The workaround was to restructure the contract: the configuration was staged in 16 transactions of 32 keys
(4.8 % of the limit each, for example
[`0xdf341d48…`](https://hashscan.io/testnet/transaction/0xdf341d4864af1506c95e52dde2aeb9659b9c06fc61e716b0d8be3cd0cb102ccd)),
then the channel was opened with the 16 chunk roots (4.5 %,
[`0x28556511…`](https://hashscan.io/testnet/transaction/0x285565114acef4b37592e9ac115460bbfcabd547936e44fd515ed9919132a3d9)).
That is a reasonable design for this application, and this HIP does not ask to raise the limit. It asks that the
limit be reported as itself and be visible before submission.

### Who is affected

Any contract call whose frames carry large inputs or outputs: verifiers of other ledgers' proofs and validator sets,
rollup and bridge contracts, batch settlement, on-chain signature aggregation, and anything behind a proxy or
router, where every forwarded byte is recorded at least twice. Since
[#27102](https://github.com/hiero-ledger/hiero-consensus-node/pull/27102), contract calls inside atomic batches and
scheduled transactions are held to the same limit, so the misleading status also appears as the inner failure of a
batch.

## Rationale

### Current implementation (v0.77.2)

| Piece | Location |
| --- | --- |
| `contracts.maxSerializedTraceDataBytes`, default `262144`, `@Min(0)`, `@NetworkProperty` | [`ContractsConfig.java` L58-59](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-config/src/main/java/com/hedera/node/config/data/ContractsConfig.java#L58-L59) |
| Running estimate per transaction; once exceeded, clears the trace and rejects every later addition; a shared `ClippingState` keeps the record and block stream builders in step when `streamMode=BOTH` | [`TraceDataSizeLimiter.java`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-app/src/main/java/com/hedera/node/app/workflows/handle/record/TraceDataSizeLimiter.java), [`PairedStreamBuilder.java`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-app/src/main/java/com/hedera/node/app/blocks/impl/PairedStreamBuilder.java#L119-L137) |
| Record stream: `ContractActions` and `ContractStateChanges` sidecars measured with `PROTOBUF.measureRecord` | [`RecordStreamBuilder.java`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-app/src/main/java/com/hedera/node/app/workflows/handle/record/RecordStreamBuilder.java#L1236-L1345) |
| Block stream: `EvmTraceData.contract_actions` and `contract_slot_usages` measured and replaced as they grow | [`BlockStreamBuilder.java`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-app/src/main/java/com/hedera/node/app/blocks/impl/BlockStreamBuilder.java#L1367-L1401) |
| Actions are added only if action sidecars are enabled (`contracts.sidecars` contains `CONTRACT_ACTION`) | [`ContractOperationStreamBuilder.withCommonFieldsSetFrom`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-smart-contract-service-impl/src/main/java/com/hedera/node/app/service/contract/impl/records/ContractOperationStreamBuilder.java#L91-L113) |
| Failure, including the bytecode of created contracts: `INSUFFICIENT_GAS` and rollback | [`ConversionUtils.java` L801-L838](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-smart-contract-service-impl/src/main/java/com/hedera/node/app/service/contract/impl/utils/ConversionUtils.java#L801-L838) |
| Mirror-node web3 runs the same executor with `contracts.sidecars` empty, so no actions are recorded and the limit is never reached in simulation | [`EvmProperties.java` L178 (mirror node v0.164.0)](https://github.com/hiero-ledger/hiero-mirror-node/blob/v0.164.0/web3/src/main/java/org/hiero/mirror/web3/evm/properties/EvmProperties.java#L178) |

The limit was introduced as "Fail on trace data exceeding 256KB" (cherry-picked to v0.74 in
[#26359](https://github.com/hiero-ledger/hiero-consensus-node/pull/26359)), reworked as trace clipping in
[#26382](https://github.com/hiero-ledger/hiero-consensus-node/pull/26382) /
[#26434](https://github.com/hiero-ledger/hiero-consensus-node/pull/26434), and extended to batch-inner and
scheduled calls in [#27102](https://github.com/hiero-ledger/hiero-consensus-node/pull/27102). It bounds the size of
record files, sidecar files and blocks, and the work of every stream consumer, per transaction. That purpose is
sound, and this HIP keeps it.

### Related work

- [HIP-513](./hip-513.md) defined the action and state-change sidecars whose size is limited here.
- [HIP-435](./hip-435.md) (record stream V6) and [#3709](https://github.com/hiero-ledger/hiero-consensus-node/pull/3709)
  limit sidecar *file* size by splitting files; they do not limit a single transaction.
- [HIP-1056](./hip-1056.md) and [HIP-1193](./hip-1193.md) move trace data into the block stream's
  `EvmTraceData`, which already compacts some repeated data (`InitcodeBookends`, and slot reads that refer to
  written keys by index). A similar compaction for forwarded call data is left to a follow-up HIP (see Rejected
  Ideas).
- [HIP-801](./hip-801.md) (`debug_traceTransaction`) and the open
  [HIP-1485](https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1485) (mirror-node debug and trace
  APIs, `debug_traceCall`, `eth_simulateV1`) build on the same actions; Part B gives their simulations the same
  limit as consensus.
- [hiero-json-rpc-relay#5694](https://github.com/hiero-ledger/hiero-json-rpc-relay/issues/5694) tracked
  `INSUFFICIENT_GAS` Ethereum transactions on testnet that could not be looked up by hash between 2026-07-25 and
  2026-08-11, the weeks after this limit shipped. A distinct status would make such cases easier to separate from
  real out-of-gas failures.

No existing or open HIP covers the trace data limit or its status code. A search of hiero-consensus-node,
hiero-mirror-node, hiero-json-rpc-relay and this repository for `maxSerializedTraceDataBytes`, "trace data size"
and related terms found only the implementation pull requests above.

### Design choices

**A. A dedicated status.** Every other per-transaction resource limit in the smart contract service has its own
code (`MAX_CHILD_RECORDS_EXCEEDED`, `MAX_CONTRACT_STORAGE_EXCEEDED`, `MAX_GAS_LIMIT_EXCEEDED`, ...). Reusing
`INSUFFICIENT_GAS` mixes an unfixable condition with a fixable one in receipts, mirror-node results, explorers and
SDK retry logic. A new code costs one enum value.

**B. Pre-flight parity.** A limit that only consensus applies is discovered by paying for a failed transaction.
The mirror node already runs the consensus node's EVM; it only needs to measure the actions it currently skips.
Measuring sizes is cheaper than building and storing the sidecars, and only matters for calls that go near the
limit.

Reducing how much trace a call produces (for example recording call data forwarded unchanged by a proxy only
once) is a separate change to the stream format with its own consumers to coordinate, so it is not part of this
HIP; see Rejected Ideas. Parts A and B address the developer experience whatever the limit's value or encoding.

## User stories

- As a smart contract developer, I want a transaction that exceeds the trace data limit to fail with a status that
  names the limit, so that I do not spend time and fees raising the gas limit.
- As a developer using `eth_estimateGas` or `eth_call`, I want the simulation to fail the same way as consensus
  would, so that I find the problem before I pay for a failed transaction.
- As a wallet or SDK author, I want to tell an unfixable limit from an out-of-gas condition, so that I do not
  retry with more gas.
- As a mirror node or relay operator, I want the new status to need no schema change, so that ingestion keeps
  working.

## Specification

### Part A: `MAX_CONTRACT_TRACE_DATA_EXCEEDED`

Add to `ResponseCodeEnum` (`services/response_code.proto`), with the next available value at implementation time:

```protobuf
/**
 * The estimated serialized size of the contract trace data for this transaction
 * (contract actions, storage slot usage, and the bytecode of contracts created)
 * exceeded the network limit `contracts.maxSerializedTraceDataBytes`.<br/>
 * The transaction was executed, then rolled back. The gas used is charged.
 * Raising the gas limit will not change the outcome.
 */
MAX_CONTRACT_TRACE_DATA_EXCEEDED = <next>;
```

In `ConversionUtils.throwIfUnsuccessfulCall`, throw `HandleException(MAX_CONTRACT_TRACE_DATA_EXCEEDED,
rollbackHandler)` where it throws `INSUFFICIENT_GAS` for the trace limit today. Nothing else about the failure
changes: the same transactions fail, with the same gas used and fees, the same rollback, and the same cleared
trace. For a batch-inner or scheduled call, the inner status is the new code and the outer status is unchanged
(for example `INNER_TRANSACTION_FAILED`).

The node SHOULD record the estimated size at which the limit was hit in the transaction's `ContractFunctionResult`
`error_message` field (for example `"trace data 331036 bytes exceeds limit 262144"`), so that the developer knows
how far over the limit the call was. This uses an existing field and needs no protobuf change.

### Part B: pre-flight parity

**Mirror node.** For `POST /api/v1/contracts/call` (which backs the relay's `eth_call` and `eth_estimateGas`), the
mirror node web3 module SHALL estimate the trace data size of the simulated call the same way consensus does and
fail the simulation with `MAX_CONTRACT_TRACE_DATA_EXCEEDED` when it is over the network's current
`contracts.maxSerializedTraceDataBytes`. Two implementations are acceptable:

1. enable `CONTRACT_ACTION` and `CONTRACT_STATE_CHANGE` tracing in the web3 executor and use the consensus node's
   own `TraceDataSizeLimiter`, or
2. a size-only tracer that adds `ContractAction.PROTOBUF.measureRecord(...)` per completed frame and the slot usage
   size per accessed slot, without keeping the trace.

The limit value SHALL be configurable and SHOULD track the network's current value (for example by reading the
network's application properties in file `0.0.121`) rather than being hard-coded. The error response SHALL include the status name
in the existing `_status.messages[].message` field and the estimated size in `detail`.

**JSON-RPC relay.** When the mirror node returns `MAX_CONTRACT_TRACE_DATA_EXCEEDED` for `eth_call` or
`eth_estimateGas`, or a submitted transaction's result is `MAX_CONTRACT_TRACE_DATA_EXCEEDED`, the relay SHALL
return a JSON-RPC error (pre-flight) or a failed receipt whose revert reason names the status, and SHALL NOT
describe it as out of gas. The relay's error documentation SHALL list the new status.

**Mirror node REST.** `GET /api/v1/contracts/results/{id}` reports `result: MAX_CONTRACT_TRACE_DATA_EXCEEDED` for
such transactions; no schema change is needed. Ingestion SHALL treat the new status like `INSUFFICIENT_GAS` today
(a failed contract result with no actions or state changes), including indexing by Ethereum hash.

### Part C: documentation and governance of the limit

No change to the default value or the way the property is set. This HIP asks that:

- the limit be listed with the other smart contract limits in the network's published documentation, together with
  the new status code;
- changes to `contracts.maxSerializedTraceDataBytes` on Hedera networks be announced in release notes like changes
  to `contracts.maxGasPerSec` or `contracts.maxRefundPercentOfGasLimit`, because lowering it can make previously
  valid transactions fail;
- the property's description note that a value of `0` fails every contract call that records any trace data
  (`@Min(0)` permits it).

### Impact on Mirror Node

- Ingest the new status (Part A); no schema change.
- Apply the limit in contract call simulation and return the new status (Part B).

### Impact on SDK

- Add `MAX_CONTRACT_TRACE_DATA_EXCEEDED` to each SDK's `Status` enum.
- SDKs that retry or adjust gas on `INSUFFICIENT_GAS` SHALL NOT do so for the new status.

### Impact on the JSON-RPC relay

As in Part B: a distinct error for pre-flight calls and a failed receipt that names the status.

## Backwards Compatibility

- **Part A** changes only the status code of transactions that already fail. Clients that check for `SUCCESS` are
  unaffected. Clients that match `INSUFFICIENT_GAS` specifically and treat it as a trace-size failure (there is no
  other way to recognize it today) must also match the new code. Older SDKs that do not know the new enum value
  will see an unknown status, as with any new response code.
- **Part B** makes some `eth_call` and `eth_estimateGas` requests fail that succeed today. Each of them describes a
  transaction that would fail at consensus, so the change replaces a paid failure with a free one. Read-only
  `eth_call` uses that are never submitted could start failing; the mirror node MAY limit the check to
  `eth_estimateGas` and to `eth_call` with `estimate=true`, and report the estimated size on other calls instead.
  This is an open issue below.
- **Part C** changes documentation and release notes only.

The limit's value, the set of transactions that fail, gas, fees and the stream formats are unchanged by all
parts.

## Network Optionality

- **Part A is not optional per network.** The response code is part of the consensus result of a transaction, so
  every node of a network must produce the same code; a network adopts it by upgrading to the release that contains
  it. It changes no behavior other than the reported status, so there is nothing a network would need to opt out
  of. A network that stays on an older release keeps reporting `INSUFFICIENT_GAS`.
- **Part B is optional per deployment.** The mirror node check SHOULD be on by default and MAY be disabled by
  configuration (for example `hiero.mirror.web3.evm.traceDataLimit.enabled`). With it disabled, simulation behaves
  as today: `eth_call` and `eth_estimateGas` succeed for calls that consensus fails. The limit value the check uses
  SHALL follow the network's own `contracts.maxSerializedTraceDataBytes`, so networks that configure a different
  limit, or `0` to disable trace recording limits by other means, get parity with their own setting. The relay change
  only maps a status it receives and has no setting.
- **Part C is advisory.** Each network documents and announces its own value of the limit.
- Nothing else depends on this HIP: a network that does not adopt a part sees no change in any other functionality.

## Security Implications

- The limit protects nodes, the record and block streams, and every consumer from unbounded per-transaction trace
  data. This HIP does not raise it, does not change when it applies, and keeps fail-closed rollback.
- Part B adds work to mirror-node simulation. A size-only tracer adds a counter per frame and per slot. Simulation
  is already bounded by the gas limit and the mirror node's own rate limits; the check adds no new unbounded input.
- A distinct status reveals nothing that is not already public: the trace limit is a published network property,
  and the transaction's gas used is in its record.

## How to Teach This

- Add the limit and the new status to the smart contract documentation's list of Hedera-specific limits, next to
  the gas limits, with a one-line budget: every call frame's input and output counts, including precompile calls,
  and a proxy or router records forwarded call data at least twice.
- In the relay and SDK error documentation, describe `MAX_CONTRACT_TRACE_DATA_EXCEEDED` as "split the work across
  transactions or reduce what each call frame carries", not "add gas".
- Provide an example of measuring a call's trace size from `debug_traceTransaction` (`callTracer` plus
  `prestateTracer`), until Part B ships.

## Reference Implementation

Part A, in `hedera-smart-contract-service-impl`:

```java
// ConversionUtils.throwIfUnsuccessfulCall
if (hasExceededTraceDataSizeLimit(streamBuilder, context)) {
    throw new HandleException(MAX_CONTRACT_TRACE_DATA_EXCEEDED, rollbackHandler);
}
```

with the existing `RecordsSuite` clipping tests (including `oversizedContractActionsAreClippedInsideAtomicBatch`)
updated to expect the new status, and a test that the gas used and fees are unchanged.

Part B, in the mirror node web3 module, a size-only `OperationTracer` registered alongside the existing tracers
(sketch; names are illustrative):

```java
final class TraceSizeTracer implements OperationTracer {
    private final long limit; // contracts.maxSerializedTraceDataBytes from 0.0.121
    private long estimate;

    @Override
    public void traceContextExit(MessageFrame frame) {
        estimate += ContractAction.PROTOBUF.measureRecord(actionFor(frame)); // as ActionStack builds it
        if (estimate > limit) {
            throw new MirrorEvmTransactionException(MAX_CONTRACT_TRACE_DATA_EXCEEDED, estimate);
        }
    }
    // plus slot usage measured once at the end of the call
}
```

A reference measurement tool (a `debug_traceTransaction`-based estimator) and the testnet evidence above are
proposed to LFDT-CLPR/clpr-smart-contracts in
[#37](https://github.com/LFDT-CLPR/clpr-smart-contracts/pull/37) (`docs/hedera-trace-cap.md` and
`script/trace/trace-size.ts`).

## Rejected Ideas

**Succeed and truncate or summarize the trace.** The node already clears the trace when it is too large; it could
commit the transaction instead of failing it, with a marker that the trace was dropped. Rejected because the trace
is not optional output: in the record stream the mirror node ingests the `ContractStateChanges` sidecar into its contract
state tables, and `debug_traceTransaction`, explorers and auditors depend on complete actions. A
committed transaction without its trace would leave consumers with a state change they cannot explain.
Summarizing (for example hashing large inputs) has the same problem for consumers that need the bytes.

**Count trace bytes as gas.** Charging gas per recorded trace byte would turn the limit into a price and make
`eth_estimateGas` reflect it automatically. Rejected because it changes EVM gas semantics, which Hiero keeps close
to Ethereum's for tooling compatibility, and it would charge every contract call for a stream-format concern.

**Exclude precompile calls from the trace or from the count.** Frames that call standard Ethereum precompiles
made up a third of the measured trace. Some Ethereum tracers omit them by default (Parity-style
`trace_*`, Geth's `flatCallTracer`). Rejected for now because the mirror node's `debug_traceTransaction` returns
Geth `callTracer` output, which includes precompile calls, and because excluding bytes from the count while still
writing them breaks the limit's purpose. Listed as an open issue: a compact encoding for standard precompile
actions (input hash plus length) could be part of the follow-up HIP on trace compaction if consumers agree.

**Record forwarded call data once (deferred to a follow-up HIP).** In the measured case, 67,364 bytes are
recorded twice only because a router `DELEGATECALL`s its logic module with the same call data, and proxies
(ERC-1967, beacon, diamond) do the same for every call. An opt-in, block-stream-only `ContractAction` flag meaning
"input identical to the parent frame's input" would keep the trace lossless and reduce the trace and the stream.
It is left out of this HIP because it is a separate idea that changes the stream format and has to be coordinated
with mirror node, block node and other consumers, and because it would not have rescued the measured transaction
on its own (it removes 67,364 of 301,836 raw bytes). The author intends to propose it separately.

**Deduplicate any identical byte strings across frames.** More general than the forwarded-input flag above, but it
needs a content-addressed table in `EvmTraceData` and makes every consumer resolve references.

**Raise the default limit.** It would hide the problem for some transactions while increasing worst-case stream
and consumer load. The right value is an operational decision for each network; this HIP keeps it.

**Reject at ingest or precheck.** The trace size depends on execution, so it cannot be checked before the EVM runs.

## Open Issues

1. Should Part B apply to every `eth_call`, or only to `eth_estimateGas` and `estimate=true` calls? Applying it
   everywhere gives the strictest parity; limiting it avoids breaking read-only calls that will never be
   submitted.
2. Should the mirror node expose the current limit directly (for example on `/api/v1/network/...`) so that tools do
   not have to read file `0.0.121`?
3. Should the trace size of successful transactions be reported (for example a `trace_data_bytes` field in contract
   results), so that developers can see how close a working call is to the limit?
4. Should the follow-up HIP on trace compaction (forwarded input, identical output, standard precompile actions)
   be one HIP or several?

## References

- hiero-consensus-node v0.77.2:
  [`ContractsConfig`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-config/src/main/java/com/hedera/node/config/data/ContractsConfig.java),
  [`TraceDataSizeLimiter`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-app/src/main/java/com/hedera/node/app/workflows/handle/record/TraceDataSizeLimiter.java),
  [`RecordStreamBuilder`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-app/src/main/java/com/hedera/node/app/workflows/handle/record/RecordStreamBuilder.java),
  [`BlockStreamBuilder`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-app/src/main/java/com/hedera/node/app/blocks/impl/BlockStreamBuilder.java),
  [`ConversionUtils`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hedera-node/hedera-smart-contract-service-impl/src/main/java/com/hedera/node/app/service/contract/impl/utils/ConversionUtils.java),
  [`contract_action.proto`](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hapi/hedera-protobuf-java-api/src/main/proto/streams/contract_action.proto),
  [`smart_contract_service.proto` (block stream trace)](https://github.com/hiero-ledger/hiero-consensus-node/blob/v0.77.2/hapi/hedera-protobuf-java-api/src/main/proto/block/stream/trace/smart_contract_service.proto)
- hiero-consensus-node pull requests:
  [#26359](https://github.com/hiero-ledger/hiero-consensus-node/pull/26359),
  [#26382](https://github.com/hiero-ledger/hiero-consensus-node/pull/26382),
  [#26434](https://github.com/hiero-ledger/hiero-consensus-node/pull/26434),
  [#27102](https://github.com/hiero-ledger/hiero-consensus-node/pull/27102),
  [#3709](https://github.com/hiero-ledger/hiero-consensus-node/pull/3709)
- hiero-mirror-node v0.164.0:
  [`EvmProperties`](https://github.com/hiero-ledger/hiero-mirror-node/blob/v0.164.0/web3/src/main/java/org/hiero/mirror/web3/evm/properties/EvmProperties.java)
- [hiero-json-rpc-relay#5694](https://github.com/hiero-ledger/hiero-json-rpc-relay/issues/5694)
- HIPs: [HIP-435](./hip-435.md), [HIP-513](./hip-513.md), [HIP-801](./hip-801.md),
  [HIP-1056](./hip-1056.md), [HIP-1193](./hip-1193.md),
  [HIP-1485 (open)](https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1485)
- Measurements: [CLPRouter](https://github.com/ColdAI-org/clprouter) on Hedera testnet; method and tool in
  [LFDT-CLPR/clpr-smart-contracts#37](https://github.com/LFDT-CLPR/clpr-smart-contracts/pull/37)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
