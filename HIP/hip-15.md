---
hip: 15
title: Address Checksum
author: Leemon Baird (@lbaird)
type: Standards Track
category: Application
needs-council-approval: Yes
status: Final
created: 2021-03-11
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/47
requires: 32
updated: 2021-12-09
---

## Abstract

Hedera defines two standard ways to write addresses: with-checksum or no-checksum. The with-checksum format consists of a no-checksum address followed by a 5-letter checksum. In the HTML JavaScript demonstration, enter an address in no-checksum format in the top box and click CONVERT to convert it to the with-checksum format in the second box. Or enter one manually in that box, and click VERIFY to see if it is valid or invalid.

## Motivation

The Hedera Hashgraph address format `0.0.12345` is a compact address identifier that has the advantage of being easy to memorize and communicate. However, it is prone to manual data entry mistakes as it's likely to leave a digit out, permute, or accidentally add extra digits to an address. When the wrong address is put in the recipient field of a Hedera wallet then funds are transferred out irreversibly.

Furthermore, a malicious actor could reserve addresses that are similar to ones of high value and high traffic accounts, such as accounts of exchanges, in order to take advantage of such addressing mistakes. Also, due to low account creation fees, a malicious actor can reserve a whole block of addresses , several thousand in a couple of hours, to maximize the probability of funds being transferred by mistake to one of the malicious accounts .

To prevent such manual entry mistakes, we propose the introduction of address check-sums, which could be optional to preserve address backward compatibility.

## Rationale

In the Hedera public ledger, each entity (account, file, smart contract, topic, token type) has an address such as `0.0.123` that is used to refer to it in transactions sent to the ledger. In the past, it was typical for applications such as wallet software to use that format. However, a user attempting to type in such an address might accidentally leave out a digit, or swap two digits, or modify a digit. If the result is an actual account, this could result in hbars being transferred to the wrong account.

It is therefore useful to catch such errors before the transaction is sent to the network. So this HIP defines a standard for an alternative address format that is designed to help prevent such mistakes. The old no-checksum format continues to be valid, but the new with-checksum format extends it by appending a 5-letter checksum to the address.

## Specification

Software should be written to always display Hedera entity addresses in with-checksum format (such as `0.0.123-vfmkw`), with the checksum after a dash, all lowercase, and no spaces or other characters added. It should accept address inputs in either no-checksum ( `0.0.123` ) or with-checksum ( 0.0.123-vfmkw ) format, all lowercase, with no additional whitespace or punctuation allowed, and no leading zeros for the integers. So these would both be accepted:

```
0.0.123
0.0.123-vfmkw
```

If the user enters any other format, or the checksum doesn't match, then the input should not be accepted, and the user should be told that it is incorrect, such as in these cases:

```
0.0.123-abcde
0.00.123
0.0.0123-vfmkw
0.0.123-VFMKW
0.0.123-vFmKw
0.0.123#vfmkw
0.0.123vfmkw
0.0.123 - vfmkw
0.123
0.0.123.
0.0.123-vf
0.0.123-vfm-kw
0.0.123-vfmkwxxxx
```

An address that is received as input should be rejected if it doesn't match the following regex. It should also be rejected if its checksum is incorrect.

```
/^(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))(?:-([a-z]{5}))?$/
```

An address that is displayed or sent as output should always be generated such that it would match the following regex. It is the same, except without the last ?, so the checksum is always included.

```
/^(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))(?:-([a-z]{5}))$/
```

The checksum (such as `vfmkw`) is calculated from the no-checksum address (such as `0.0.123` ) by this algorithm:

```
a = a valid no-checksum address string, such as 0.0.123
d = int array for the digits of a (using 10 to represent "."), so 0.0.123 is [0,10,0,10,1,2,3]
h = unsigned byte array containing the ledger ID followed by 6 zero bytes
p3 = 26 * 26 * 26
p5 = 26 * 26 * 26 * 26 * 26
sd0 = (d[0] + d[2] + d[4] + d[6] + ...) mod 11
sd1 = (d[1] + d[3] + d[5] + d[7] + ...) mod 11
sd = (...((((d[0] * 31) + d[1]) * 31) + d[2]) * 31 + ... ) * 31 + d[d.length-1]) mod p3
sh = (...(((h[0] * 31) + h[1]) * 31) + h[2]) * 31 + ... ) * 31 + h[h.length-1]) mod p5
c = (((d.length mod 5) * 11 + sd0) * 11 + sd1) * p3 + sd + sh ) mod p5
cp = (c * 1000003) % p5
checksum = cp, written as 5 digits in base 26, using a-z
```

The checksum is a function of the ledger ID, so that the same address will have different checksums if it is on different ledgers. Cryptographically secure ledger IDs will be implemented as part of state proofs. Please reference [HIP-198](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-198.md) for the latest information regarding ledger IDs.

The reference implementation is the Java code linked to in the Reference Implementation section. All implementations should match its outputs and behavior, including rejecting as invalid all the examples of invalid addresses above, and giving the the correct checksum in all of the following examples:

```
For ledger ID 0x00:
  0.0.1-dfkxr
  0.0.4-cjcuq
  0.0.5-ktach
  0.0.6-tcxjy
  0.0.12-uuuup
  0.0.123-vfmkw
  0.0.1234567890-zbhlt
  12.345.6789-aoyyt
  1.23.456-adpbr

For ledger ID 0xa1ff01:
  0.0.1-xzlgq
  0.0.4-xdddp
  0.0.5-fnalg
  0.0.6-nwxsx
  0.0.12-povdo
  0.0.123-pzmtv
  0.0.1234567890-tvhus
  12.345.6789-vizhs
  1.23.456-uxpkq
```

The checksum is always 5 lowercase letters, and is guaranteed to catch any of the following errors:

- remove a digit (or 2 or 3 or 4 digits)
- add a digit (or 2 or 3 or 4 digits)
- modify a digit (or 2 adjacent digits)
- swap two different adjacent digits

Doing any of those modifications is guaranteed to change the checksum. In fact, it is guaranteed to change at least one of the first 2 letters of the checksum (before the final permutation). Furthermore, if the no-checksum part of the address were simply replaced with a random one, or the ledger ID were replaced with a random one, then it is extremely unlikely that the new address would have the same 5-character checksum as the old address (less than one in a million chance).

In the algorithm for calculating the checksum, the variable s is a weighted sum of all the digits (mod 26^3), sh is a weighted sum of all the bytes of the ledger ID padded with 6 zeros (mod 26^5), s0 is a sum of the digits in the even positions (mod 11), and s1 is a sum of the digits in the odd positions (mod 11). If a digit is removed or added, then (d.length mod 5) will change. If a digit in an even position is modified, then s0 will change. If a digit in an odd position is modified, then s1 will change. If two different adjacent digits are swapped, then both s0 and s1 will change.

The 3 numbers d.length, s0, s1 are encoded in the 2 most significant letters of the checksum (before the final permutation), so if any of those conditions occur, that checksum will change in at least one of those two letters.

The other 3 letters of the checksum are a very simple hash of the address. There are over 10 million different 5-letter checksums possible, so typos are likely to be caught, even if they aren't one of the 4 kinds of typos listed here.

The hash described above would have strong guarantees that small changes in the address will change the checksum. However, incrementing the last digit of the address would often leave the first character of the checksum unchanged, and only change the other 4 characters. For example, the addresses 0.0.4, 0.0.5, and 0.0.6 would all have checksums starting with the letter "c". Therefore, the algorithm contains a final permutation, to increase the probability of the first character changing, too.  That final permutation simply multiplies c by 1,000,003 modulo 26^5. The multiplier is the minimum prime greater than a million, and is therefore coprime to the modulus, and therefore performs a permutation (an invertible transformation). Because it is large (over a million), it allows each of the 5 characters to be affected by each of the others.

## Backwards Compatibility

Address checksums should be optional so as to support backward compatibility. It is recommended that all software be upgraded to always display addresses with the checksum. But nothing will break if they don't.

## Security Implications

In general, this HIP would improve security, preventing mistakes in addressing that could lead to the loss of funds.

Any function that creates 5-letter checksums will inevitably have collisions, where two addresses have the same checksum. If the checksum function were a cryptographically-strong pseudorandom function (PRF), then there would be collisions where the addresses differ in only a single digit. The function defined here has no collisions like that.

When calculating checksums for all accounts of the form `0.0.x` as `x` counts up 1, 2, 3, ..., a PRF would be expected to reach a collision within the first 3,500 numbers (around sqrt(26^5)), but the function here goes more than 10 times further. It reaches its first collision at `0.0.39004-gyebe`, which collides with the earlier address `0.0.10690-gyebe`. But that is fine, because it is unlikely that a person trying to type `0.0.39004-gyebe` would accidentally type `0.0.10690-gyebe`. And a more likely typo such as `0.0.3904` has a different checksum `-csury`, so an entered address of `0.0.3904-gyebe` would be flagged as incorrect by any application that follows this standard.

## How to Teach This

[This web page](https://codepen.io/lbaird/full/QWKRPGv) demonstrates this standard using embedded Javascript code.

## Reference Implementation

Example code can be downloaded for these languages (the reference implementation is the Java version):
- Pseudocode: [HIP-15-pseudocode.md](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/assets/hip-15/HIP-15-pseudocode.md)
- Java: [AddressChecksums.java](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/assets/hip-15/AddressChecksums.java)
- Javascript: [HIP-15-javascript.html](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/assets/hip-15/HIP-15-javascript.html)
- Spreadsheet: [HIP-15-spreadsheet.xlsx](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/assets/hip-15/HIP-15-spreadsheet.xlsx)
- Mathematica: [HIP-15-mathematica.nb.txt](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/assets/hip-15/HIP-15-mathematica.nb.txt)
- All of the above: [HIP-15-all.zip](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/assets/hip-15/HIP-15-all.zip)



## Rejected Ideas

- 2021-01-23: The decision to change from `0.0.x(yyyyy)` format to `0.0.x-yyyyy` with strict input requirements became the majority preference and examples were updated to reflect the preference.

## Open Issues

N/A

## References

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
