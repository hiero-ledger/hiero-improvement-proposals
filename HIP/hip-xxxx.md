---
hip: xxxx
title: Add STALE Status Code to Transaction Receipts
author: TBD
type: Standards Track
category: Service
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2025-01-11
updated: 2025-01-11
---

## Abstract

This HIP proposes adding a new `STALE` status code to the `ResponseCodeEnum` to indicate when a transaction has been 
included in a stale event that will never reach consensus. This allows clients to immediately detect and resubmit stale 
transactions instead of waiting for the current 3-minute timeout, enabling faster recovery and improved load testing 
capabilities.

## Motivation

Currently, when a transaction is included in an event that becomes "stale" (will never reach consensus), clients have 
no way to detect this condition immediately. Stale events occur when network conditions or timing issues prevent an 
event from progressing through the consensus algorithm. Transactions in stale events will never execute, but clients 
must wait up to 3 minutes before timing out and resubmitting.

This creates several problems:
1. **Delayed Recovery**: Clients wait unnecessarily for transactions that will never be processed
2. **Load Testing Limitations**: During network stress testing, stale events prevent maintaining maximum load because 
   clients cannot immediately resubmit failed transactions
3. **Poor User Experience**: Applications cannot provide immediate feedback about stale transaction conditions
4. **Missed Telemetry**: Networks cannot track stale event frequency for monitoring and optimization

While stale events are rare on mainnet under normal conditions, they can occur during high-load scenarios or network 
partitions, making early detection valuable for both operational monitoring and testing scenarios.

## Rationale

Adding a `STALE` status code provides several advantages:

### Immediate Feedback
Rather than forcing clients to implement timeout-based retry logic, the network can proactively signal when a 
transaction cannot progress. This reduces unnecessary waiting and improves application responsiveness.

### Forward Compatibility
This design anticipates future optimizations where the consensus node might automatically resubmit stale transactions. 
In such cases, the `STALE` status would only be returned for transactions that the network chooses not to 
auto-resubmit, maintaining consistent semantics.

### Minimal Impact
Adding a new response code is a purely additive change. Existing clients that don't handle `STALE` will continue to 
function as before, while updated clients can take advantage of the immediate feedback.

### Alternative Approaches Considered
- **Event-level notifications**: Could notify about stale events rather than individual transactions, but this would 
  require clients to track which transactions were in each event
- **Async callbacks**: Could use a separate notification mechanism, but this adds complexity and doesn't integrate 
  with existing receipt-based workflows
- **Extended timeout fields**: Could add timing information to receipts, but this requires more complex client logic

The status code approach provides the simplest integration with existing client patterns while delivering immediate 
value.

## User Stories

> As a **load testing engineer**, I want to know immediately when transactions become stale so that I can resubmit 
> them without delay and maintain maximum network throughput during stress testing.

> As an **application developer**, I want to provide immediate feedback to users when their transactions are affected 
> by network conditions rather than showing a prolonged "pending" state.

> As a **network operator**, I want to monitor the frequency of stale events in real-time to detect and respond to 
> network performance issues.

> As an **SDK developer**, I want to implement intelligent retry logic that can distinguish between different failure 
> modes and respond appropriately.

## Specification

### ResponseCodeEnum Modification

Add a new status code to the `ResponseCodeEnum` in `response_code.proto`:

```protobuf
enum ResponseCodeEnum {
    // ... existing codes ...
    
    /**
     * The transaction was included in an event that has become stale and will never reach consensus.
     * The transaction will not be executed and should be resubmitted if desired.
     * 
     * This status indicates the transaction was valid and properly formed, but network conditions
     * prevented the containing event from progressing through consensus. This is distinct from
     * other failure modes as the transaction itself was not rejected for validation reasons.
     */
    STALE = 401;  // Next available code in sequence
}
```

### Transaction Receipt Behavior

When a consensus node determines that an event containing user transactions has become stale:

1. **Receipt Generation**: Generate transaction receipts for all transactions in the stale event with `status = STALE`
2. **Timing**: Receipts should be made available as soon as the stale condition is detected, without waiting for the 
   normal timeout period
3. **Content**: All other receipt fields should be populated normally where applicable (transaction ID, etc.)

### Stale Event Detection

The specific criteria for determining when an event becomes "stale" are implementation-defined and may vary based on:
- Network topology and health
- Consensus algorithm timing constraints  
- Node-specific timeout configurations

This HIP does not mandate specific stale detection algorithms, only that when such detection occurs, the `STALE` status 
should be used.

### Future Auto-Resubmission Compatibility

If consensus nodes implement automatic resubmission of stale transactions in the future:
- Transactions that are auto-resubmitted should **not** receive a `STALE` status in their original receipt
- Only transactions that remain stale and are **not** auto-resubmitted should receive the `STALE` status
- This maintains clear semantics: `STALE` means "this specific transaction instance will not execute"

### Impact on Mirror Node

Mirror nodes should:
1. **Record STALE Status**: Include `STALE` status codes in transaction records like any other status
2. **Indexing**: Ensure STALE transactions are properly indexed and queryable
3. **Metrics**: Consider exposing stale transaction counts in metrics and dashboards

### Impact on SDK

SDKs should:
1. **Status Handling**: Add `STALE` to status code enumerations and error handling logic
2. **Retry Logic**: Consider implementing intelligent retry patterns that immediately resubmit stale transactions
3. **Documentation**: Update documentation to explain stale conditions and recommended handling

## Backwards Compatibility

This change is fully backwards compatible:

1. **Existing Clients**: Clients that don't handle the `STALE` status code will continue to function normally. They may 
   not recognize the specific status value, but this doesn't break existing functionality.

2. **Timeout Behavior**: The existing 3-minute client-side timeout behavior remains available as a fallback for 
   clients that don't implement `STALE` handling.

3. **Protocol Compatibility**: Adding a new enum value doesn't change the wire format or existing field semantics.

4. **Migration Path**: Clients can adopt `STALE` handling incrementally without coordinated updates across the ecosystem.

## Security Implications

This change has minimal security implications:

1. **No New Attack Vectors**: The `STALE` status doesn't enable any new attack patterns or information disclosure.

2. **Consensus Safety**: Reporting stale conditions doesn't affect consensus safety, as stale transactions were already 
   not being executed.

3. **Information Exposure**: The status reveals timing information about the consensus process, but this information is 
   already observable through existing timeout behavior and network monitoring.

## How to Teach This

### For Application Developers
- **Basic Handling**: Treat `STALE` similar to other retryable error conditions
- **Immediate Retry**: Unlike timeout-based failures, `STALE` transactions can be resubmitted immediately
- **User Experience**: Consider showing "network congestion detected, retrying..." instead of indefinite pending states

### For SDK Developers  
- **Retry Patterns**: Implement automatic retry logic for `STALE` transactions with appropriate backoff
- **Configuration**: Allow applications to configure stale handling behavior (auto-retry, notify, etc.)
- **Metrics**: Expose stale transaction counts for application monitoring

### For Network Operators
- **Monitoring**: Track stale event frequency as a network health indicator  
- **Alerting**: Consider alerting on elevated stale rates as they may indicate network issues
- **Load Testing**: Use stale detection to optimize testing scenarios and maintain consistent load

## Reference Implementation

A reference implementation should include:

1. **Consensus Node Changes**: 
   - Stale event detection logic
   - Receipt generation with `STALE` status
   - Timing optimizations to minimize stale detection latency

2. **Test Cases**:
   - Verification that `STALE` receipts are generated correctly
   - Timing tests ensuring immediate availability
   - Integration tests with SDK retry logic

3. **Monitoring Integration**:
   - Metrics collection for stale event frequency
   - Dashboard updates to display stale transaction rates

## Rejected Ideas

### Alternative Status Names
- `EXPIRED`: Could be confused with transaction validity periods
- `TIMEOUT`: Might imply client-side timeout rather than network-level staleness  
- `UNREACHABLE`: Less clear about the specific consensus-related cause
- `ABANDONED`: Could imply intentional cancellation rather than network conditions

`STALE` was chosen for its clarity about the consensus-specific nature of the condition.

### Event-Level Notification
Rather than transaction-level status codes, we considered notifying clients about stale events and letting them track 
which transactions were affected. This was rejected because:
- Requires clients to maintain additional state mapping transactions to events
- More complex integration with existing receipt-based workflows  
- Doesn't align with the existing pattern of per-transaction status reporting

### Separate API Endpoint
We considered adding a dedicated API for querying transaction staleness rather than using receipt status codes. This 
was rejected because:
- Creates inconsistency with existing status reporting patterns
- Requires clients to poll multiple endpoints
- More complex for SDK integration compared to standard receipt handling

## Open Issues

1. **Stale Detection Timing**: What is the optimal balance between quick stale detection and false positives?

2. **Network Partition Handling**: How should `STALE` status interact with network partition scenarios where events 
   might eventually reach consensus after extended delays?

3. **Auto-Resubmission Policies**: When automatic resubmission is implemented, what policies should determine which 
   stale transactions to resubmit versus abandon?

## References

- [Hiero Consensus Algorithm Documentation]
- [HAPI Response Code Definitions](https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hapi/hedera-protobuf-java-api/src/main/proto/services/response_code.proto)
- [Transaction Receipt Structure](https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hapi/hedera-protobuf-java-api/src/main/proto/services/transaction_receipt.proto)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.