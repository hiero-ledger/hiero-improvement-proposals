---
hip: 21
title: Free network info query              
author: Simi Hunjan (@SimiHunjan)
type: Standards Track
category: Mirror
needs-council-approval: Yes
status: Final
last-call-date-time: 2021-11-30T07:00:00Z
release: v0.54.0
created: 2021-06-09 
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/82
updated: 2024-05-14
---

## Abstract

The HIP proposes a free address book query.

## Motivation

The address book files `0.0.101` and `0.0.102` collectively maintain information about the nodes in a given Hedera network (previewnet, testnet, mainnet). The two files contain the following [information](https://github.com/hashgraph/hedera-protobufs/blob/main/services/basic_types.proto#L1194) for each node:

- IP address
- Port number
- Node account ID
- Node ID
- Node certificate hash
- RSA_PublicKey
- Description
- Stake

Today, applications have to use the File Service and submit two file contents query requests to return all the required node information. This results in two transaction fees for processing each of the queries. The information contained within the address book files is required for clients to send Hedera transactions or queries to valid Hedera consensus nodes.

## Rationale 

The proposal is to create a rest API and gRPC query to return network information. As we continue to grow the network and transition into a permissionless model, the number of times the local address book will be required to update will increase. The transaction fee associated with the current file query hinders the ability to update the address book as frequently as it might be needed for applications to ensure their address book is always up to date. This information should be free. 

## Specification 

gRPC

The gRPC API will use server streaming technology to deliver all of the `NodeAddress` entries contained within the latest address book. The stream will automatically complete when all entries are delivered, avoiding the complexity of client side paging.

```protobuf
// Request object to query an address book for its list of nodes
message AddressBookQuery {
    .proto.FileID file_id = 1; // The ID of the address book file on the network. Can be either 0.0.101 or 0.0.102.
    int32 limit = 2;           // The maximum number of node addresses to receive before stopping. If not set or set to zero it will return all node addresses in the database.
}

// Provides cross network APIs like address book queries
service NetworkService {

    // Query for an address book and return its nodes. The nodes are returned in ascending order by node ID. The
    // response is not guaranteed to be a byte-for-byte equivalent to the NodeAddress in the Hedera file on
    // the network since it is reconstructed from a normalized database table.
    rpc getNodes (AddressBookQuery) returns (stream .proto.NodeAddress);

}
```

REST API

GET `/api/v1/network/nodes`

Response:

```json

{
  "nodes": [
    {
      "description": "",
      "node_id": 0,
      "node_account_id": "0.0.3",
      "node_cert_hash": "0x333432343464353061386564346434636261646632353632306431616238386133323038313937376432663864373062613832626135326233333035613435363038323463663662303130366436333565643563333932373266666661626538",
      "public_key": "0x308201a2300d06092a864886f70d01010105000382018f003082018a02820181009098865def2f2ab376c7f0f738c1d87a27ac01afd008620c35cb6ebfcbb0c33003193a388c346d30231727012193bb76fd3004b864312c689ef5213cbb901101509deab94f26a732e637929da4c4cb32517e3adbb3811d50ac4c77c1fce8b651606215f34707f3e7265545e58c894609e28376bdb7775fe30439e0e1592fdcb0c3ee1c305773d072a6b8957eafce1a11be965edaff3843366cb6a44ec25a890106e6247567f76b550fda482baec6307d698ec88841fd66f23f210e47b8a9dcba6ba4e1fa716db33c80e30819496dcb5e5609fb6e7c615379bdded427e9231b9254c2baf943608a86d698ae9a3c8639df887d6f6b5a71385d24338d911a212bf71f1e2acc8b186b96ec8e69c86b6d058217776a09c9c68953edb5916578b5a263b2f469e3b0c07eada71a447eea7f8fc1bb8074255567b7f0bd1e6afb0358718c98b429e24b2298596fc76cf6af396ca9434d7926ec7d37d4b92af56d45feff8196095224a916c1ffe6b667e255fc3ac8cccef920dc044b25003132b87806742f0203010001",
      "service_endpoints": [
        {
          "ip_address_v4": "13.124.142.126",
          "port": 50211
        },
        {
          "ip_address_v4": "13.124.142.126",
          "port": 50212
        },
        {
          "ip_address_v4": "13.82.40.153",
          "port": 50211
        }
      ],
      "stake": 0,
      "timestamp": "1636052707.740848001"
    }
  ],
  "links": {
    "next": null
  }
}


```
Response Description
* description: a memo associated with the address book
* node_id: A non-sequential identifier for the node
* node_account_id: The account to be paid for queries and transactions sent to this node
* node_cert_hash: Hash of the node's TLS certificate. Precisely, this field is a string of hexadecimal characters which, translated to binary, are the SHA-384 hash of the UTF-8 NFKD encoding of the node's TLS cert in PEM format. Its value can be used to verify the node's certificate it presents during TLS negotiations.
* public_key: The node's X509 RSA public key used to sign stream files (e.g., record stream files). Precisely, this field is a string of hexadecimal characters which, ranslated to binary, are the public key's DER encoding.  
* service_endpoints: Contains the IP address and the port representing a service endpoint of a Node in a network. Used to reach the Hedera API and submit transactions to the network.
* ip_address_v4: The 32-bit IPv4 address of the node encoded in left to right order (e.g.  127.0.0.1 has 127 as its first byte)
* port: The port of the node
* stake: The amount of tinybars staked to the node
* timestamp: The timestamp the address book was retrieved



## Security Implications

- A client could spam the network since the query is free and disable other users from processing their request. This could be mitigated by rate limiting, limiting connections per IP and caching the address book response.

## Rejected Ideas

The original idea was to have a non-file HAPI network query that returns the address book information.
```diff
service NetworkService {
   rpc getVersionInfo (Query) returns (Response); // Retrieves the active versions of Hedera Services and HAPI proto
+  rpc getNetworkInfo (Query) returns (Response); //Retrieves network information
   rpc uncheckedSubmit (Transaction) returns (TransactionResponse); // Submits a "wrapped" transaction to the network, skipping its standard prechecks. (Note that the "wrapper" <tt>UncheckedSubmit</tt> transaction is still subject to normal prechecks, including an authorization requirement that its payer be either the treasury or system admin account.)
} 
```

The other idea was to have the mirror node return the full address book in a single response. This was rejected since the address book is large and only getting bigger. The current mainnet `0.0.102` address book is 25 KiB.

```protobuf
rpc getNetworkInfo () returns (NodeAddressBook); //Retrieves network information
```

## Open Issues

- Throttle the query to prevent spamming of the network

## How to Teach This

- Hedera Mirror node design document
- Description and code example of the query added to Hedera documentation
- Reviewed in Engineering Insights

## References

- https://github.com/hashgraph/hedera-protobufs/blob/main/services/basic_types.proto#L1171
- https://github.com/hashgraph/hedera-protobufs/blob/main/services/basic_types.proto#L1194
- https://github.com/hiero-ledger/hiero-mirror-node/issues/946
