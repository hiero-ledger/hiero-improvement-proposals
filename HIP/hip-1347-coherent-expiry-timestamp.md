---
hip: 1347
title: Coherent Token Expiry Timestamp Encoding
author: Giuseppe Bertone <giuseppe.bertone@hashgraph.com>
type: Standards Track
category: Mirror
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Review
created: 2025-11-19
updated: 2025-11-19
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1347
---

## Abstract

This HIP proposes to standardize the encoding of the `expiry_timestamp` field in the Mirror Node REST API's token endpoints to match the encoding format used by all other timestamp fields. Currently, `expiry_timestamp` used in tokens is the only field encoded as an integer representing nanoseconds (e.g., `1762038186000000000`), while all other timestamps follow the OpenAPI specification using the string format `seconds.nanoseconds` (e.g., `"1586567700.453054000"`). The same token API uses the string format for other timestamp fields. This inconsistency creates confusion for developers and violates the declared OpenAPI schema specification.

## Motivation

The current implementation of the `expiry_timestamp` field for tokens creates several problems:

- **API Inconsistency**: The field is documented in the [OpenAPI specification](https://github.com/hiero-ledger/hiero-mirror-node/blob/6fdaf74a87a2e13a9f233597f38d99e5450e97d9/rest/api/v1/openapi.yml#L3446) as `#/components/schemas/TimestampNullable`, which explicitly defines timestamps as strings in `seconds.nanoseconds` format with the pattern `^\d{1,10}(\.\d{1,9})?$`. However, the actual API response returns an integer.
- **Developer Confusion**: Developers must implement special handling logic for token expiry timestamps that differs from handling other timestamp fields (like `created_timestamp` and `modified_timestamp` on the same token object, or `expiry_timestamp` for accounts). This issue was previously raised in GitHub issue [#5779](https://github.com/hiero-ledger/hiero-mirror-node/issues/5779) and more recently in [#11721](https://github.com/hiero-ledger/hiero-mirror-node/issues/11721), indicating recurrent developer pain points.
- **Ecosystem Fragmentation**: Tools and libraries that parse Mirror Node responses must handle this field differently, leading to unnecessary complexity and potential bugs.

## Rationale

While this change is technically breaking, several factors make this the right time to address the issue:

- **Limited Usage**: Expiration is not enabled on the network yet, and the `expiry_timestamp` field for tokens has historically been underutilized compared to other fields, potentially minimizing the impact on existing integrations.
- **Long-term Maintainability**: Continuing to maintain this exception adds technical debt and increases the likelihood of errors in future development.
- **Consistency Principle**: All other timestamp fields in the Mirror Node API use the string format.
- **Align with the OpenAPI Specification**: The current implementation violates the published OpenAPI specification, which is a contract with API consumers.

## User stories

- As an **application developer**, I want all timestamp fields in the Mirror Node API to use the same format, so that I can write consistent parsing logic and avoid special-case handling.
- As a **DApp builder**, I want the API implementation to match the OpenAPI specification, so that my auto-generated client libraries work correctly without manual patches.
- As a **data analyst**, I want timestamps in a human-readable format with clear seconds and nanoseconds components, so that I can easily process and analyze expiration data without complex conversions.

## Specification

### Affected Endpoints

The following Mirror Node REST API endpoints will be affected:

- `GET /api/v1/tokens/{tokenId}` - Token info by ID

All responses containing the `TokenInfo` schema will reflect the change.

### Current Behavior

The `/api/v1/tokens/{tokenId}` endpoint currently returns timestamps like this:

```json
{
  "created_timestamp": "1754262193.443183536",
  "custom_fees": { "created_timestamp": "1754262193.443183536", ... },
  "expiry_timestamp": 1762038186000000000,
  "modified_timestamp": "1754262193.443183536"
  ...
}
```

Where `expiry_timestamp` is:

- **Type**: `integer` (nullable)
- **Format**: Total nanoseconds since Unix epoch
- **Example**: `1762038186000000000`

### Proposed Behavior

The `/api/v1/tokens/{tokenId}` endpoint will return:

```json
{
  "created_timestamp": "1754262193.443183536",
  "custom_fees": { "created_timestamp": "1754262193.443183536", ... },
  "expiry_timestamp": "1762038186.000000000",
  "modified_timestamp": "1754262193.443183536"
  ...
}
```

Where `expiry_timestamp` is:

- **Type**: `string` (nullable)
- **Format**: `seconds.nanoseconds` per `TimestampNullable` schema
- **Pattern**: `^\d{1,10}(\.\d{1,9})?$`
- **Example**: `"1762038186.000000000"`

### OpenAPI Schema Changes

The OpenAPI specification already correctly defines the field. No schema changes are required, as the implementation will now match the specification:

```yaml
TokenInfo:
  type: object
  properties:
    expiry_timestamp:
      $ref: "#/components/schemas/TimestampNullable"

...

TimestampNullable:
  description: A Unix timestamp in seconds.nanoseconds format
  type: string
  example: "1586567700.453054000"
  pattern: '^\d{1,10}(\.\d{1,9})?$'
  nullable: true
```

### Impact on Mirror Node

1. Modify the `TokenInfo` response serialization in the Mirror Node REST API
2. Update database query/mapping layer if timestamps are stored as numeric types

### Impact on SDK

1. Update response parsing logic in SDKs that interact with Mirror Node
2. Update type definitions to reflect `expiry_timestamp` as a string
3. Update examples and documentation

## Backwards Compatibility

This is a **breaking change** that will affect any application currently parsing the `expiry_timestamp` field from token API responses.

### Impact Assessment

**Who is affected:**

- Applications that query token information via Mirror Node REST API
- SDKs and client libraries that wrap Mirror Node responses
- Blockchain explorers and analytics tools that display token expiry information
- Any automated systems that monitor or process token expiry data

**What breaks:**

- Code that expects `expiry_timestamp` to be a numeric type will fail type checks
- Code that directly performs mathematical operations on the value will need updates

### Conversion Logic

To convert from the old integer format to the new string format:

```javascript
// Old format: 1762038186000000000 (nanoseconds)
// New format: "1762038186.000000000" (seconds.nanoseconds)

function convertOldToNew(oldTimestamp) {
  if (oldTimestamp === null) return null;
  
  const seconds = Math.floor(oldTimestamp / 1_000_000_000);
  const nanoseconds = oldTimestamp % 1_000_000_000;
  
  return `${seconds}.${nanoseconds.toString().padStart(9, '0')}`;
}
```

To update existing client code that expects the old format:

```javascript
// Before:
const expiryNanos = tokenInfo.expiry_timestamp;
const expirySeconds = expiryNanos / 1_000_000_000;

// After:
const expiryString = tokenInfo.expiry_timestamp;
const [seconds, nanos] = expiryString.split('.');
const expirySeconds = parseInt(seconds);
const expiryNanos = parseInt(seconds) * 1_000_000_000 + parseInt(nanos || '0');
```

## Security Implications

This change has minimal security implications:

- **Input Validation**: The Mirror Node already validates timestamp data internally; this change only affects output formatting.
- **Parsing Vulnerabilities**: The new string format is simpler and less prone to parsing errors than very large integers, potentially reducing edge cases in client implementations.
- **Type Safety**: The change actually improves type safety by aligning implementation with specification, reducing the risk of type confusion in strongly-typed languages.

## How to Teach This

### For Application Developers

**What Changed:**
The `expiry_timestamp` field for tokens is now a string in `"seconds.nanoseconds"` format instead of an integer representing total nanoseconds.

**How to Update Your Code:**

**Before:**

```javascript
const expiryNanos = tokenData.expiry_timestamp;
const expiryDate = new Date(expiryNanos / 1_000_000);
```

**After:**

```javascript
const [seconds, nanos] = tokenData.expiry_timestamp.split('.');
const expiryMillis = parseInt(seconds) * 1000 + Math.floor(parseInt(nanos || '0') / 1_000_000);
const expiryDate = new Date(expiryMillis);
```

**Helper Function:**

```javascript
function parseHederaTimestamp(timestamp) {
  if (!timestamp) return null;
  const [seconds, nanos = '0'] = timestamp.split('.');
  return {
    seconds: parseInt(seconds),
    nanos: parseInt(nanos.padEnd(9, '0')),
    toDate: function() {
      return new Date(this.seconds * 1000 + Math.floor(this.nanos / 1_000_000));
    }
  };
}

const expiry = parseHederaTimestamp(tokenData.expiry_timestamp);
const expiryDate = expiry.toDate();
```

### For SDK Maintainers

- Update type definitions to reflect `expiry_timestamp` as a string
- Update documentation and examples

### Documentation Updates

- Update Mirror Node REST API documentation to show correct format
- Update code examples across all documentation
- Highlight the change in "Breaking Changes" section of release notes

## Open Issues

- **API Versioning**: Should this change be part of a broader API versioning strategy (e.g., `/api/v2/`), or should it be implemented as a version-bumping breaking change in v1?

## References

1. [GitHub Issue #11721 - The encoding of the token expiry timestamp is inconsistent throughout the APIs](https://github.com/hiero-ledger/hiero-mirror-node/issues/11721)
2. [GitHub Issue #5779 - expiry_timestamp field inconsistency](https://github.com/hiero-ledger/hiero-mirror-node/issues/5779)
3. [Mirror Node OpenAPI Specification](https://github.com/hiero-ledger/hiero-mirror-node/blob/6fdaf74a87a2e13a9f233597f38d99e5450e97d9/rest/api/v1/openapi.yml)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
