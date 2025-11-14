# Examples: Trailing Calldata Memos with HTS

These examples demonstrate how to append a small memo (e.g., 32 bytes) to standard ERC-20 calls such as `transfer` and `approve`, and how to retrieve and parse the memo from the Ethereum transaction input data. The HTS system contract should ignore the trailing bytes (per this HIP) while preserving them in the input data.

Note: Examples use ethers.js v5 for brevity. Adjust imports for v6 if needed.

## A) `transfer(address to, uint256 amount)` with 32-byte memo

```js
const { ethers } = require("ethers");

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const token = "0xYourTokenAddress";
const to = "0xRecipientAddress";
const amount = ethers.utils.parseUnits("1.0", 6); // example: 6 decimals

const iface = new ethers.utils.Interface([
  "function transfer(address to, uint256 amount)"
]);

// 1) Encode the normal call data
const dataNoMemo = iface.encodeFunctionData("transfer", [to, amount]);

// 2) Build a 32-byte memo. You can use utf8 bytes and right-pad/zero-pad to 32 bytes
const memoAscii = "ORDER-1234";
const memoBytes = ethers.utils.hexZeroPad(ethers.utils.toUtf8Bytes(memoAscii), 32);

// 3) Append the memo to the encoded data (strip 0x when concatenating)
const dataWithMemo = dataNoMemo + memoBytes.slice(2);

// 4) Send the transaction to the token contract
const tx = await signer.sendTransaction({ to: token, data: dataWithMemo });
console.log("Submitted tx:", tx.hash);
await tx.wait();
```

Retrieve and parse the memo from input data:

```sh
# JSON-RPC via curl (requires jq)
RPC_URL=https://mainnet.hashio.io/api
TX_HASH=0x...

curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":["'"$TX_HASH"'"],"id":1}' \
  "$RPC_URL" | jq -r .result.input
```

```js
// Parse the memo from input
const input = "0x..."; // value from eth_getTransactionByHash.result.input

// Decode the expected parameters
const decoded = iface.decodeFunctionData("transfer", input);

// Re-encode the expected parameters to compute the prefix length
const expected = iface.encodeFunctionData("transfer", [decoded[0], decoded[1]]);

// The remaining bytes (after expected) are the memo
const memoHex = "0x" + input.slice(expected.length);

// If memo is UTF-8, decode it (ignore errors for non-UTF-8 payloads)
let memoText = null;
try { memoText = ethers.utils.toUtf8String(memoHex); } catch (_) {}

console.log({ to: decoded[0], amount: decoded[1].toString(), memoHex, memoText });
```

## B) `approve(address spender, uint256 amount)` with trailing memo

```js
const iface2 = new ethers.utils.Interface([
  "function approve(address spender, uint256 amount)"
]);

const spender = "0xSpenderAddress";
const amount2 = ethers.utils.parseUnits("100.0", 6);

const dataNoMemo2 = iface2.encodeFunctionData("approve", [spender, amount2]);
const memoBytes2 = ethers.utils.hexZeroPad(ethers.utils.arrayify("0x1234"), 32); // sample binary memo
const dataWithMemo2 = dataNoMemo2 + memoBytes2.slice(2);

const tx2 = await signer.sendTransaction({ to: token, data: dataWithMemo2 });
console.log("Approve tx:", tx2.hash);
await tx2.wait();
```

Parse the memo similarly by decoding the expected params and slicing the remainder.

## Notes

- The memo bytes have no effect on HTS behavior and should be ignored by the system contract.
- Existing transaction size limits still apply. If a trailing-bytes cap is configured by the network, exceeding it will revert the call.
- For production identifiers, prefer structured encodings (e.g., fixed 32 bytes, binary IDs, or a compact TLV) rather than variable-length UTF-8.
