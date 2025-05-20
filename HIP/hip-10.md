---
hip: 10
title: Token Metadata JSON Schema
author: Sam Wood <sam.wood@luthersystems.com>, Susan Chan <susan.chan@luthersystems.com>, Stephanie Yi <stephanie.yi@luthersystems.com>, Khoa Luong <khoa.luong@luthersystems.com>
type: Informational
needs-council-approval: No
status: Replaced
last-call-date-time: 2021-11-23T07:00:00Z
created: 2021-02-18
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/50
updated: 2022-04-19
superseded-by: 412
---

## Abstract

This specification provides a standard way to interrogate tokens on HTS for associated metadata. For example, it provides a standard way for HTS token explorers to display an image associated with a NFT on HTS.

## Motivation

Token creators often desire to include an image and supplemental metadata that is associated with tokens, including Non-Fungible Tokens (NFTs).
For example, tokens representing artwork include an URL that serves an image of the artwork.
This specification provides an OPTIONAL standard for referencing and processing token metadata stored outside HTS.
A standard adopted by the community increases the interoperability and re-usability for systems that process tokens.

The motivation for this specific standard is the same as the metadata extension in [0]:
> A mechanism is provided to associate NFTs with URIs. We expect that many implementations will take advantage of this to provide metadata for each NFT. The image size recommendation is taken from Instagram, they probably know much about image usability. The URI MAY be mutable (i.e. it changes from time to time). We considered an NFT representing ownership of a house, in this case metadata about the house (image, occupants, etc.) can naturally change.

This standard also provides references for other token types beyond NFTs, and also includes localization and token-specific attributes similar to the metadata extension in [5].

## Rationale

The specific "Token Metadata JSON Schema" described below is chosen to make the implementation easier for token explorers and wallet providers that wish to display metadata for tokens issued on HTS.
The specification is loosely based on [0] and [5] which has served the Ethereum community well.
A familiar standard adapted for HTS could accelerate the implementation and adoption of HTS.

The choice for using the token "memo" field to represent the URI that serves the metadata is primarily because the intention of the memo is exactly for token metadata.

The inclusion of the localization standard is to encourage global adoption.

## Specification

The exact method for implementing different token types and NFTs on HTS is outside the scope of this specificaiton. See [3] for an example.

Tokens optionally specify a URI in the token "memo" attribute or token "metadata" attribute (for token type `NON_FUNGIBLE_UNIQUE`).
This URI MAY link to data on the Hedera File Service or Hedera Consensus Service (see HIP-30), IPFS, a DID, AWS, or any other URI the issuer specifies.
This URI references token metadata that MUST conform to the "Token Metadata JSON Schema".
This allows your tokens to be interrogated for its details about the assets which your tokens represent.

This is the "Token Metadata JSON Schema" referenced above:

```
{
    "title": "Token Metadata",
    "type": "object",
    "properties": {
        "version": {
            "type": "string",
            "description": "Semantic version for the metadata JSON format."
        },
        "name": {
            "type": "string",
            "description": "Identifies the asset to which this token represents."
        },
        "decimals": {
            "type": "integer",
            "description": "The number of decimal places that the token amount should display."
        },
        "description": {
            "type": "string",
            "description": "Describes the asset to which this token represents."
        },
        "image": {
            "type": "string",
            "description": "A URI pointing to a resource with mime type image/* representing the asset to which this token represents. Consider making any images at a width between 320 and 1080 pixels and aspect ratio between 1.91:1 and 0.7:1 inclusive."
        },
        "properties": {
            "type": "object",
            "description": "Arbitrary properties. Values may be strings, numbers, object or arrays."
        },
        "localization": {
            "type": "object",
            "required": ["uri", "default", "locales"],
            "properties": {
                "uri": {
                    "type": "string",
                    "description": "The URI pattern to fetch localized data from. This URI should contain the substring `{locale}` which will be replaced with the appropriate locale value before sending the request."
                },
                "default": {
                    "type": "string",
                    "description": "The locale of the default data within the base JSON"
                },
                "locales": {
                    "type": "array",
                    "description": "The list of locales for which data is available. These locales should conform to those defined in the Unicode Common Locale Data Repository (http://cldr.unicode.org/)."
                }
            }
        }
    }
}
```

The "version" field is a [semvar](https://semver.org/) version of the metadata JSON format. If omitted then the version MUST be interpreted as "0.0.1".

If the "decimals" field is supplied in the token metadata, then it MUST match that specified for the token on HTS.

The suggested aspect ratio for the image was chosen to include common sizes for NFT images, and trading cards.

### Localization

Metadata localization should be standardized to increase presentation uniformity across all languages.
As such, a simple overlay method is proposed to enable localization.
If the metadata JSON file contains a localization attribute, its content MAY be used to provide localized values for fields that need it.
The localization attribute should be a sub-object with three attributes: uri, default and locales.
If the string `{locale}` exists in any URI, it MUST be replaced with the chosen locale by all client software.

See "Reference Implementation" below for an example with localization.

## Backwards Compatibility

This HIP is entirely opt-in, and does not break any existing functionality. It simply provides standards to facilitate integratons for the display of metadata for HTS tokens.

## Security Implications

No known security concerns.

## How to Teach This

HTS implementations use this standard to provide additional metadata for their tokens. See the reference implementation below for an example.

Wallet and token explorer implementations interrogate HTS tokens using this standard to display additional metadata for tokens.

Note that the referenced URI must fit within the token memo size restrictions.

## Reference Implementation

See testnet token [4] which is a NFT deployed on the testnet that conforms to this specification.


Where the endpoint `https://dev.luthersystemsapp.com/nft-test-en.json` serves:

```
{
  "name": "Chloe Artwork",
  "description": "Chloe Searching For Light Artwork Test Token",
  "image": "https://dev.luthersystemsapp.com/chloe_assets/SearchingForLightNo_81_20/image_part_005.jpg",
  "localization": {
    "uri": "https://dev.luthersystemsapp.com/nft-test-{locale}.json",
    "default": "en",
    "locales": ["en", "es", "fr"]
  }
}
```

Endpoint `https://dev.luthersystemsapp.com/nft-test-es.json` serves:

```
{
  "name": "Obra De Arte De Chloe",
  "description": "Chloe busca un token de prueba de obra de arte ligera"
}
```

Endpoint `https://dev.luthersystemsapp.com/nft-test-fr.json` serves:

```
{
  "name": "Oeuvre de Chloé",
  "description": "Chloé à la recherche d'un jeton de test d'illustrations légères"
}
```

## Rejected Ideas

This proposal uses the HTS "memo" field to specify the URI for token metadata. Alternatives included the token "name" or "symbol" field or transaction "memo" field. Note that symbol is used to represent HTS metadata in [3].

This proposal originally only discussed NFTs and the JSON Metadata descried in [0]. After discussion with the community [6] it became clear that this scope unnecessarily restrictive for HTS, and a JSON Metadata that supported fields beyond NFTs was required.

## Open Issues

N/A

## References

[0] https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md#specification
[1] https://opensea.io/
[2] https://dcentwallet.com/
[3] https://github.com/hashgraph/hedera-hts-demo/pull/4
[4] https://explorer.kabuto.sh/testnet/id/0.0.411677
[5] https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1155.md#specification
[6] https://github.com/hiero-ledger/hiero-improvement-proposals/issues/40

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
