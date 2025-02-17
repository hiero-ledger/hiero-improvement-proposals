---
hip: <HIP number (assigned by the HIP editor), usually the PR number>
title: Transaction Cleanup
author: Michael Heinrichs <@netopyr>
working-group: Richard Bair <@rbair>, Jasper Potts <@jasperpotts>
requested-by: Richard Bair <@rbair>
type: "Standards Track"
category: "Service"
needs-council-approval: "Yes"
status: "Draft"
created: 2025-02-17
updated: 2025-02-17
requires: 
replaces: 
superseded-by: 
---

## Abstract
There are three ways to store the `TransactionBody` and the `SignatureMap` in a `Transaction` which is unnecessarily complex.
This HIP defines a single standard of how these fields should be stored and how to handle transactions that do not follow the new normalized format.

## Motivation
Every program that parses transactions and extracts `TransactionBody` and `SignatureMap` requires special code to deal with all possible ways to store these fields. In addition, all but one possibility defines part of the data as byte arrays that need to be deserialized in an extra step.
This causes unnecessary complexity that we want to avoid.

## Rationale
To simplify the handling of transactions, we selected one of the possible ways to store the transaction data.

All incoming transactions that do not follow the standard format will be adjusted accordingly.
The required modifications will be done so that they do not break the signatures.

We chose `Transaction.body` and `Transaction.sigMap` as the standard format. 
This simplifies transaction parsing because `Transaction.body` is specified as a `TransactionBody` object, which allows us to parse a transaction in one go.

## User stories
1. As a transaction sender, I want to be able to send transactions using all possible formats so that I am not forced to rewrite the calling code (which may be impossible).
2. As a record stream/block stream consumer, I want a simple way to parse transactions and extract data.
3. As a transaction signer, I want to be sure that my signatures can always be validated, even if transactions are modified to follow the normalized format.

## Specification
The protobuf definition of the `Transaction` object will not change directly. 
However, we "un-deprecate" `body` and `sigMap`, while marking `signedTransactionBytes` as deprecated.

```protobuf
message Transaction {

    TransactionBody body = 1;

    SignatureList sigs = 2 [deprecated = true];

    SignatureMap sigMap = 3;

    bytes bodyBytes = 4 [deprecated = true];

    bytes signedTransactionBytes = 5 [deprecated = true];
}
```

### Modification of incoming transactions
All incoming transactions that do not follow the standard format will be adjusted.

If the consensus node receives a transaction that uses `bodyBytes` instead of `body`, we create a new `Transaction` with `body` set to the `TransactionBody` contained in `bodyBytes`.
The original byte array will be preserved to ensure all signatures can still be verified.
The `SignatureMap` will be copied over unmodified.

If the consensus node receives a transaction that uses `signedTransactionBytes`, we deserialize the byte array (which contains a `SignedTransaction`) and use the contained data to create a new `Transaction` with `body` and `sigMap` set to the extracted content.
The original byte array in `SignedTransaction.bodyBytes` will be preserved to ensure all signatures can still be verified.

### Changes in record stream and block stream
The record stream and block stream will contain the normalized transactions only.
The hash of a transaction is also calculated based on the normalized format.

## Backwards Compatibility
If a user sends a non-normalized transaction, they will not be able to find it in the record stream or block stream if they search for the exact bytes.
This has to be well communicated.

It is unlikely though that users search for transactions this way.

## Security Implications
This change has no security implication.

## How to Teach This
The change will be documented in the HAPI documentation. 
In addition, we should provide an article explaining the change and the reasons to drive awareness.

## Rejected Ideas
- Keep the current approach. This was deemed unnecessary complex and error-prone.
- Use any of the other fields as the standard format. We chose `Transaction.body` and `Transaction.sigMap` because it is the most straightforward way to store the transaction data.
- Introduce a new transaction type. This was rejected because it would be an incompatible change with no real benefit.

## Copyright/license
This document is licensed under the Apache License, Version 2.0 --
see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
