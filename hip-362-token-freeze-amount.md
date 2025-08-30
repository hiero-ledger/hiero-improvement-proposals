**hip: TBD </br>
title: Integrate '.setTokenAmount()' custom function for 'TokenFreezeTransaction()' </br>
author: Tomachi Anura [shibartoken@protonmail.com](mailto:shibartoken@protonmail.com)</br>
type: Standards Track</br>
category: Service</br>
needs-council-approval: Yes</br>
status: Draft</br>
last-call-date-time:</br>
created: 22.02.13</br>
discussions-to:**</br>

## Abstract

When "locking" or "freezing" liquidity related to an associated Account Id, There is no way to freeze a specific amount of tokens. The Shibar Network Team strongly believes that it would bring many advantages to have the tokenFreezeTransaction like in the sequent example:

<img width="711" alt="Screen Shot 2022-02-13 at 5 44 48 PM" src="https://user-images.githubusercontent.com/96840872/153778591-6ba9b8b7-92a7-4438-b9fb-23e77a469e4d.png">

## Motivation

When "locking" or "freezing" liquidity related to an associated Account Id, There is no way to freeze a specific amount of tokens. This could be potentially detrimental in regards of DeFi, if the same token offers many use-cases. As it stands now, Users would have to set different accounts in order to use the same Network.


## Rationale
When Alice participates to a round 1 token pre-sale, she buys 1000 tokens. According to the terms and conditions of the round 1 pre-sale, she should have those tokens frozen and unable to move them from the wallet until the term expires. However Alice would also like to buy more tokens at round 2 which are supposed to be Unfrozen tokens. Unfortunately Hedera only allows to freeze the whole token amount of the account, while it would be much more beneficial to implement a child function .setTokenAmount(Amount) to the parent TokenFreezeTransaction().

This implementation allows Alice to interact with the token if she holds more than the frozen amount. for many use cases, without limiting her whole account by keeping the whole token amount frozen. This way, she can buy another 1000 tokens on round 2, having a total balance of 2000. And she is able to use unfrozen 1000 tokens from round 2 to interact with the network

## User Stories

- As dApp, I would like to allow users to stake their tokens by freezing a partial amount of TokenX in the user wallet for a pre-determined duration
## Specification
<img width="846" alt="Screen Shot 2022-04-12 at 5 38 09 PM" src="https://user-images.githubusercontent.com/96840872/163058963-50aef31d-875e-4e1f-970e-60cf1e96430c.png">
## Backwards Compatibility
## Security Implications
## How to Teach This
## Reference Implementation
## Rejected Ideas
## Open Issues

No blocking issues are known at this time.
## References
## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](https://github.com/hashgraph/hedera-improvement-proposal/LICENSE) or (https://www.apache.org/licenses/LICENSE-2.0)
