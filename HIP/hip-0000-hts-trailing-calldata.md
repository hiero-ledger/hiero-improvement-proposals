---
hip: 0000 # Assigned by HIP editor.
title: Ignore Trailing Calldata for System Contract
author: Giuseppe Bertone (@neurone)
working-group: Giuseppe Bertone (@neurone), Ian Holsman (@web3-nomad), Glib Kozyryatskyy (@gkozyryatskyy)
requested-by: Squid <https://www.squidrouter.com>; Axelar <https://www.axelar.network>; Hedera Foundation <https://hedera.foundation>
discussions-to: <URL of the GitHub Pull Request for this HIP> # This will be filled by the HIP editor upon PR creation.
type: Standards Track
category: Service
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2025-11-14
updated: 2025-11-14
release: TBD
---

## Abstract

This HIP proposes enabling system contract to accept and ignore trailing calldata beyond the ABI-defined parameters of a function. This restores EVM-parity behavior where contracts typically ignore additional bytes in calldata, allowing applications to append small "memo" or order identifiers to standard ERC-20-like calls (e.g., `transfer`, `approve`) without causing transaction failure. The change is implemented by updating the parameter decoding used by system contract so that decoding succeeds when extra bytes remain after all expected parameters are parsed. The extra bytes are ignored by the system contract and preserved in the underlying Ethereum transaction/record for off-chain consumption.

## Motivation

Several cross-chain and attribution workflows append a compact memo (e.g., 32-byte order ID) to calldata so downstream systems can correlate external processes with on-chain actions. On most EVM chains, contracts either tolerate or ignore extra calldata beyond expected arguments, so these transactions succeed and the memo is retrievable from the transaction input data.

System contracts currently fail when extra bytes are present in calldata, preventing ERC-20-style calls with a trailing memo from succeeding. This breaks compatibility for integrations relying on the memo pattern and requires workarounds that degrade developer experience. Enabling system contracts to accept and ignore trailing calldata resolves this incompatibility while preserving consensus integrity and transaction provenance.

## Rationale

- EVM compatibility: Typical Solidity contracts do not revert solely due to trailing calldata; the decoder consumes expected parameters and disregards the remainder. Bringing system contract behavior in line with this expectation reduces surprise and increases portability of EVM-based tooling.
- Minimal scope: The change is localized to ABI parameter decoding within system contracts (and possibly shared libraries), with no changes to the system contract semantics or state transitions.
- Data availability: The full calldata remains in the Ethereum transaction input; off-chain systems can continue to read memos via standard RPCs (e.g., `eth_getTransactionByHash`). HTS, account or transaction memo fields remain unrelated and are still only visible via native APIs.
- Operational safety: Transaction size limits and fee/size checks already constrain worst-case payloads.

## User stories

- As a cross-chain router, I want to append an order ID to ERC-20 `transfer` calls routed through HTS system contract, so I can correlate off-chain orders with on-chain settlements.
- As an analytics provider, I want to reliably extract app-defined identifiers from transaction calldata without modifying token contracts or system contracts.
- As a dApp developer, I want my integration that works on other EVM networks to work on Hiero without special-case logic when using system contracts.

## Specification

This section defines the required behavior changes for system contracts.

- Scope
  - HTS, HAS, HSS system contracts, including paths invoked via `redirectForToken` (see [HIP-218](https://hips.hedera.com/hip/hip-218)) that emulate ERC-20 functions (`transfer`, `transferFrom`, `approve`, etc.).
  - Apply the same decoding rule to all future system contracts to ensure consistent behavior across the precompile/system contract surface.

- Decoding Rule
  - When decoding calldata for a system contract function, the decoder MUST:
    1. Parse the function selector and decode the exact set of ABI-defined parameters for the matched function.
    2. If additional bytes remain after successfully decoding all expected parameters, decoding MUST NOT fail solely due to the presence of these extra bytes.
    3. The system contract MUST ignore (i.e., not read/use) any trailing bytes beyond the expected parameters.
  - If decoding of required parameters fails (e.g., insufficient bytes or invalid types), the call MUST revert as today.

- Limits and Validation
  - Existing transaction size limits (including jumbo Ethereum transaction limits where applicable) remain in force.
  - No changes to fees or throttles are required.

- Semantics
  - State transitions and events emitted by system contracts are unchanged.
  - The extra trailing bytes have no semantic effect and are not persisted in system contract-specific fields, but remain visible in the Ethereum transaction input data.

- Observability
  - Mirror Node and RPC layers continue to return full transaction input data. No schema changes are required.
  - SDKs need no API changes; developers may continue using standard Ethereum JSON-RPC to read input data if desired.

### Example Behavior

- A call to an HTS-redirected ERC-20 `transfer(address,uint256)` with 20 extra bytes appended for a memo MUST succeed (assuming other checks pass) and perform an ordinary transfer, ignoring the memo bytes. The full calldata, including the memo trailer, is visible in the transaction input data via `eth_getTransactionByHash`.

### Impact on Mirror Node

- No schema changes. Transactions that previously failed due to strict decoding may now succeed; mirrors will observe corresponding status codes and logs.
- The mirror node APIs are already compliant because they don't examine the calldata but just offer that information to clients.

### Impact on the Mirror Node Explorer

The mirror node explorer should show trailing data correctly:

- In case the ABI is unknown, the raw input is visible as-is, including any trailing bytes.
- In case the ABI is known, call arguments should be parsed and an extra field should be dedicated in the UI for the trailing data.

### Impact on SDK

- SDKs should adapt the Ethereum decoding functions so that they can safely ignore the additional info in the calldata.
- No API changes required: the "memo-in-calldata" technique can be considered an EVM workaround, and there's no intention to offer this ability via SDK, where developers can leverage the dedicated memo field present in every Hiero transaction.

## Backwards Compatibility

This is a consensus rule change: transactions that previously failed when extra trailing calldata was present will now succeed.

Mitigations:

- Analyze all the mainnet and testnet Ethereum transactions calling the system contracts and failing because of malformed calldata.
  - In case transactions like that are present, put in place actions to contact the developers/users for those transactions:
    - Known actors: contact them directly via email, Slack, GitHub
    - Unknown actors: contact them over the network (void transfers with memo attached).
- Document the change in release notes to alert any systems that may have (unusually) relied on reversion when extra bytes were present.

Overall, the change aligns Hiero behavior with common EVM expectations and improves portability.

## Security Implications

- Misinterpretation risk: System contracts must explicitly ignore the trailing bytes and never act on them, avoiding semantic ambiguity.
- Input size abuse: Extra bytes could be used to inflate input size. Existing transaction size limits and fees already constrain this. A configurable cap on trailing bytes further reduces risk.
- Audit: Treat the decoder change as security-sensitive; apply standard code review and fuzz testing for malformed calldata.

## How to Teach This

- Concept: "Memo via calldata" is an EVM pattern where applications append memo or metadata to calls. System contracts will accept and ignore these bytes, while preserving them in the transaction input for off-chain reading.
- Guidance: Continue using standard Ethereum JSON-RPC to obtain input data. Do not expect any `memo` field to reflect the appended calldata.
- Examples: Provide docs showing `transfer(to, amount)` with an appended 32-byte order ID and how to retrieve it via RPC.

### Examples

Retrieve the transaction input via JSON-RPC and parse the trailing memo with Ethers.js.

```js
const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://mainnet.hashio.io/api");
  const txHash = "0x976965d65ee09f20fb152ff5e1de9490720a8e4e4a0707ae6093a6d0341f6bb1";

  const input = (await provider.getTransaction(txHash)).data;
  const iface = new ethers.Interface(["function transfer(address to, uint256 amount)"]);
  const decoded = iface.decodeFunctionData("transfer", input);
  const trailingData = iface.encodeFunctionData("transfer", [decoded[0], decoded[1]]);
  const memoHex = "0x" + input.slice(trailingData.length);

  console.log("Calldata:", input);
  console.log("Decoded transfer:", decoded[1].toString(), "units to", decoded[0]);
  console.log("Unencoded memo:", memoHex);
}

main().catch(console.error);

// Result
// Calldata: 0xa9059cbb000000000000000000000000136c1cb3257dcf2615e25c914fd1767dcf08457700000000000000000000000000000000000000000000000000000000000000643372348f476a87cf942167a35e78e40f00c91c99072b0c515ba8118cbd927fb7
// Decoded transfer: 100 units to 0x136c1cb3257DCF2615E25c914fd1767dcf084577
// Unencoded memo: 0x3372348f476a87cf942167a35e78e40f00c91c99072b0c515ba8118cbd927fb7
```

## Reference Implementation

The implementation depends on the current state of the code base, but here is an overall potential flow that satisfies the HIP:

- Update the ABI decoding library used by system contracts (and shared system contract decoding utilities if present) to:
  - Succeed when extra bytes remain after expected parameters are decoded.
  - Ignore the trailing bytes without attempting to deserialize them.
- Add unit and property/fuzz tests covering:
  - Exact-length calldata (baseline)
  - Calldata with small trailing bytes (success)
  - Malformed inputs (revert)

## Rejected Ideas

- Map trailing calldata to HTS `memo` automatically: Rejected to avoid conflating EVM calldata with native memo semantics and to keep behavior consistent with EVM norms.
- Introduce new system contracts methods with explicit `bytes memo` parameters: Heavier API surface change with less compatibility benefit; ignores off-chain tools already reading calldata.
- Limit to only `transfer`: Applying uniformly across HTS and all system contracts is simpler, less surprising for developers and users, and fully EVM-compatible.
- Limit this HIP to HTS system contract only: Applying the change to all present and future system contracts ensures consistent behavior and avoids confusion.

## Open Issues

- Decide whether there should be a maximum tolerated trailing bytes cap and, if so, determine its value.

## References

- Ethereum StackExchange: "Is there a way to attach a memo to an ERC-20 approve transaction" (<https://ethereum.stackexchange.com/questions/138779/is-there-a-way-to-attach-a-memo-to-an-erc-20-approve-transaction>)
- Example success on Arbitrum with 3rd argument ignored: <https://arbiscan.io/tx/0x4d17711d22420314c7da40df8a7262944fe41ac394d508e79e48bc71add39e51>
- Example failure on Hedera (strict decoding): <https://hashscan.io/mainnet/transaction/1762783522.983266000/result>

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
