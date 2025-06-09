---
hip: 1090
title: Increase CryptoCreate Throttle to 20,000 milliOpsPerSec
author: Ken Anderson (@kenthejr), Tony Camero (@tonycamero)
working-group: Ken Anderson, Tony Camero, Michal "Mehow" Pospieszalski
requested-by: Application developers requiring frequent account creation
discussions-to: 
status: Draft
created: 2025-05-29
updated: 2025-05-29
needs-council-approval: Yes
needs-hiero-review: Yes
hedera-reviewed-date: N/A
hedera-approval-status: N/A
type: Standards Track
category: Core, Service
---

## Table of Contents

* [Abstract](#abstract)
* [Motivation](#motivation)
* [Rationale](#rationale)
* [Specification](#specification)
* [Security Considerations](#security-considerations)
* [References](#references)
* [Copyright](#copyright)

## Abstract

This proposal recommends increasing the network-wide throttle for `CryptoCreate` transactions from **2,000** to **20,000** milliOpsPerSec – effectively raising the limit from **2 account creations per second** to **20 account creations per second** across the Hedera network. The current throttle (2/sec network-wide) has become a bottleneck for certain applications that require rapid and frequent account creation. By moderately expanding this capacity by 10×, we aim to enable new use cases (such as automated account generation for users or contracts) without overwhelming network stability. This change maintains fairness and predictability in network resource usage while reducing a unique friction point in Hedera (explicit account creation), which most other blockchain platforms do not impose.

## Motivation

**Current Limitation:** The Hedera network today limits `CryptoCreate` operations to a sustained rate of 2 per second for the entire network (2,000 milliOpsPerSec divided among all nodes). In practice, this means application developers can only create two accounts per second across all usage, which significantly constrains applications that onboard users or generate accounts frequently. For example, consider a decentralized application that needs to create an account for each new user or each session; at present, it would quickly hit the throttle and receive `BUSY` responses after 2 creations per second, degrading user experience.

**Workarounds and Pain Points:** Developers have resorted to inconvenient workarounds to avoid the `CryptoCreate` bottleneck. One common pattern is **pre-creating** a batch of accounts during off-peak times and later re-keying them to new users via `CryptoUpdate` transactions. This leverages the fact that `CryptoUpdate` has a much higher throughput allowance than the strict 2/sec on `CryptoCreate` (the update operation is not as tightly throttled). However, such workarounds add complexity and cost: developers must manage pools of pre-created accounts, handle key rotation (assigning a new key to an existing account), and ensure unused accounts do not expire. This approach is error-prone and inefficient, especially if the eventual account addresses or keys cannot be predetermined.

**Use Case Example – Pairwise EVM Addresses:** A motivating use case comes from applications where users collaboratively generate **pairwise Ethereum-compatible addresses** through multi-party cryptographic interactions. In this scenario, two or more parties jointly compute a new public key (and corresponding EVM address) that is unique to their interaction. Crucially, the resulting account ID or address is not known in advance – it is derived on the fly from the parties’ keys or contributions. Therefore, it is **not feasible to pre-create** these accounts ahead of time; they must be created when needed, via `CryptoCreate`. If an application needs to spawn such an account for every user pair or interaction, the 2/sec throttle becomes an immediate blocker. For instance, if a dApp needs to establish 10 new shared accounts in a burst, it would currently take 5 seconds or more, whereas the application’s logic might expect these accounts to be created near-instantaneously. This mismatch between application needs and network limits can stifle certain categories of dApps on Hedera.

In summary, the current `CryptoCreate` throttle severely limits throughput for **account creation-heavy use cases**. Developers face undue complexity by implementing workaround patterns. There is a clear need to relax this throttle to better accommodate modern application requirements, while still preserving network stability.

## Rationale

**Proposed Solution – 10× Throttle Increase:** We propose increasing the `CryptoCreate` transaction throttle from 2,000 to **20,000 milliOpsPerSec**, i.e. from **2 to 20 transactions per second** network-wide. This tenfold increase is chosen as a **moderate, safe step** that is expected to meet anticipated demand without approaching the network’s overall capacity. Even after a 10× increase, 20 account creations per second is only 0.2% of Hedera’s nominal throughput of 10,000 TPS for cryptocurrency transactions. In other words, this change provides substantial relief for developers (an order of magnitude more account creates) while still being a small fraction of total network capability. We believe 20 tps is a reasonable upper bound for foreseeable use cases that involve account creation bursts, and it leaves ample headroom to avoid any risk of destabilizing the network or unfairly crowding out other transaction types.

**Uniqueness of Hedera’s Account Creation Mechanism:** Hedera is unusual in requiring an explicit transaction to create an account. On most other blockchain platforms, there is **no dedicated “create account” operation** – an address simply comes into existence when it first receives funds or is first used. For example, on Ethereum any 20-byte address is considered valid, and if a transaction is sent to an address that has never been seen before, the protocol will still treat it as a valid recipient (the account is effectively created implicitly with an initial balance). Bitcoin and many other networks similarly allow new addresses to appear as outputs with no prior on-chain creation step. This means that in those systems there is no network-wide throttle specifically limiting account creations. By contrast, Hedera’s design uses an explicit `CryptoCreate` transaction, which introduces a **global rate limit on account creation** that developers coming from other ecosystems may find surprising and restrictive. The proposed increase to 20,000 milliOpsPerSec is intended to **reduce this friction** and offer a closer parity with the developer experience on other chains, where account/address generation is effectively unlimited (only constrained by transaction throughput and fees).

**Why 20,000 and not higher?** We have targeted a 10× increase as a balanced approach. Setting the throttle higher (or removing it entirely) was considered, but outright removal could pose risks (e.g. sudden surges of account creation could lead to extremely rapid state growth or other resource exhaustion if not coupled with other safeguards). A massive increase beyond 20 tps was deemed unnecessary for current needs and might invite abuse without significant benefit. On the other hand, smaller increases (e.g. to 5 or 10 tps) might not sufficiently support emerging high-volume use cases. **20 tps** was chosen as an approximate sweet spot that accommodates known demands (such as the multi-party address scenario in the Motivation) and provides headroom for growth, **while remaining well within safe limits** for the network. This number can be revisited in the future if usage patterns demand further adjustment, but for now it is expected to satisfy the majority of real-world requirements.

**Fee Considerations:** It is important to acknowledge that increasing the allowable rate of account creations could have economic implications. Account creation on Hedera is not free – each `CryptoCreate` carries a fee (priced in USD and paid in HBAR). If the throttle increase leads to substantially more accounts being created, **network fee revenue will increase**, but there is also a possibility that **malicious actors or misconfigured applications** could attempt to create many accounts rapidly. To **deter spam or abuse**, the **Hedera Council** may choose to adjust the fee for `CryptoCreate` transactions in the future. This proposal does *not* mandate any fee change, but it leaves room for the Council to make pricing adjustments through its normal governance process (e.g. the Council’s quarterly fee schedule votes) to ensure that account creation remains sufficiently costly to prevent abuse while not hindering legitimate use. In summary, the throttle increase solves the technical limitation, and any necessary economic tuning (fee increases or other measures) can be handled separately by the Council as needed.

## Specification

The core change is to update the network throttle configuration for `CryptoCreate` operations. In the Hedera **`throttles.json`** configuration file (which defines transaction rate limits for mainnet), the throttle group that includes **CryptoCreate** (and NodeCreate) must be modified to reflect the new limit. Specifically, the entry currently defining a **2000** milliOpsPerSec limit for CryptoCreate/NodeCreate will be changed to **20000** milliOpsPerSec. This change can be represented as a diff to the JSON config:

```diff
   {
     "operations": [ "CryptoCreate", "NodeCreate" ],
     "opsPerSec": 0,
-    "milliOpsPerSec": 2000
+    "milliOpsPerSec": 20000
   },
```

In words, the allowable rate for `CryptoCreate` (and `NodeCreate`) is increased from 2 transactions/sec to 20 transactions/sec network-wide. No other throttle buckets or operations are changed in this proposal. The change will apply to all Hedera network environments (Mainnet, Testnet, Previewnet) for consistency, though its primary motivation is Mainnet usage.

**Implementation considerations:** Updating the throttle JSON is a straightforward configuration change. Upon adoption of this HIP, the new throttle value would be included in a network upgrade. All nodes will need to pull the updated `throttles.json` (typically packaged with the Hedera Services code) so that the new rate limit is enforced uniformly. No changes to the Hedera API or SDKs are required, since this proposal does not alter any transaction format or introduce new features – it only adjusts an internal network setting. Clients should simply experience fewer `BUSY` rejections on high-rate account creation attempts once the new throttle is in effect.

We note that `NodeCreate` shares the same throttle bucket as `CryptoCreate`. Raising this bucket to 20,000 milliOpsPerSec will technically also allow up to 20 `NodeCreate` operations per second. In practice, `NodeCreate` (adding a new node to the network) is an administrative operation that is rarely performed, so this side effect is negligible and has no impact on normal network usage.

## Security Considerations

From a security and network stability perspective, increasing the `CryptoCreate` throttle must be evaluated carefully. The primary concern is **denial-of-service or resource exhaustion**: by allowing more accounts to be created in a short time, are we opening the door to abuse or network stress? After analysis, we believe the 10× increase to 20 tps is a **safe and incremental change**:

* **Network Throughput and State Growth:** Even at 20 account creations per second, the rate of state growth (new accounts added to the ledger) is manageable. In the extreme case of sustained max throughput, this would create 1,728,000 accounts per day. Hedera’s node infrastructure and account ID space can handle this scale in the near term, especially since such sustained use is unlikely except in attack scenarios (which would be mitigated by fees as noted below). By comparison, the network can handle 10,000 TPS of other transaction types; dedicating 20 TPS to account creation is a minor portion of overall capacity. We do not expect this change to interfere with other transactions or consensus latency in any meaningful way.

* **Fee as a Natural Brake:** Every `CryptoCreate` requires a fee paid in HBAR. Currently, the fee for creating an account is significant enough to impose an economic cost on anyone attempting to spam the network with accounts. With the throttle raised, an attacker could attempt to create accounts at a faster rate (up to 20/sec), but they would also burn HBAR 10× faster. Unless the fee is grossly mispriced, this remains a costly attack to sustain. If the Council observes an uptick in malicious high-rate account creation, they have the authority to increase the fee for `CryptoCreate` transactions, making such an attack financially impractical. Thus, the fee mechanism provides a check against abuse, and this proposal does not remove or alter that mechanism.

* **Comparative Security Posture:** Other transaction types on Hedera already allow much higher throughput (for example, cryptocurrency transfers can occur at thousands of TPS). The network and node infrastructure are designed to handle those loads. Relative to that, 20 TPS of account creation is very small and unlikely to introduce any new attack vector that isn’t already present with higher-TPS transactions. In essence, we are aligning the account creation rate with a level that is still very conservative compared to other operations.

* **Node-Level Throttling:** It’s worth noting that the throttle is apportioned per node (each node enforces a fraction of the network-wide limit based on the total number of nodes). This means that no single node can be overwhelmed by account create requests even with the higher limit—each node will only accept a proportionate share of the 20 TPS. This maintains fairness and prevents any one node from becoming a bottleneck or target for overloading via `CryptoCreate` spam.

In conclusion, the proposed throttle increase has **minimal security impact**. It maintains Hedera’s fundamental safeguards (like throttling and fees) while relaxing an overly restrictive parameter. We have considered the worst-case scenarios and find that existing measures (particularly fee economics and per-node throttling) sufficiently mitigate potential risks. The increase is a measured one, improving usability for honest developers without significantly empowering malicious actors.

## References

* [Hedera Blog – *“Throttling in Hedera: Ensuring Stability and Fairness”* (M. Cerone & M. Blackman, Feb 2025). Describes Hedera’s throttling system and notes the CryptoCreate limit of 2 ops/sec.](https://hedera.com/blog/throttling-in-hedera-ensuring-stability-and-fairness)
* [Ethereum Stack Exchange – *“Sending Ether or messages to addresses that don’t exist”* (2018). Shawn Tabrizi’s answer quotes *Mastering Ethereum* on how Ethereum accepts transactions to new addresses with no explicit creation step. This illustrates how most blockchains handle account creation implicitly.](https://ethereum.stackexchange.com/questions/53009/sending-ether-or-messages-to-addresses-that-dont-exist)

## Copyright

This document is licensed under the Apache License, Version 2.0 – see [LICENSE](https://www.apache.org/licenses/LICENSE-2.0).
