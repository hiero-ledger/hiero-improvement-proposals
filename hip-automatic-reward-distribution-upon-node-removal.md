---
hip: <to be assigned>
title: Automatic Reward Distribution Upon Node Removal
author: HederaInform <hederainform@gmail.com>
type: Standards Track
category: Core
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-06-10
discussions-to: <to be assigned>
---

## Abstract

## Abstract

This HIP proposes an improvement to Hedera's staking experience when a Governing Council operated consensus node is removed from the network, such as when a council member's term concludes and its node is decommissioned. Recent node removals have demonstrated that stakers can lose pending staking rewards if they do not take action before a node is removed. This creates an unnecessary risk for passive participants who may be unaware of node removal announcements despite actively participating in the staking program.

The proposal introduces automatic handling of staking rewards during node removal events. Before a node is removed, any pending staking rewards attributable to eligible stakers would be automatically distributed. Following reward distribution, accounts staked to the removed node would be automatically transitioned to an unstaked state, allowing users to select a new node without risking the loss of pending rewards.

This proposal does not change staking reward calculations, eligibility requirements, or governance processes. Instead, it improves the user experience by ensuring that node removal events do not result in the forfeiture of pending rewards, making Hedera staking more predictable, resilient, and user friendly for long-term participants.


## Motivation

Recent node removals have shown that stakers can lose pending rewards if they do not take action before a node is removed from the network.

Many HBAR holders participate in staking passively and do not actively monitor Governing Council announcements or node lifecycle events. As a result, users may unintentionally forfeit rewards despite meeting all staking requirements.

This proposal aims to improve the staking experience by ensuring that node removals do not result in the loss of pending rewards.


## Rationale

Hedera (HBAR) Stakers should not need to monitor node removal announcements to avoid losing pending rewards.

Long term stakers should be rewarded for their participation, not penalized for missing a node removal announcement. Automatically distributing pending rewards before node removal provides a simpler and more predictable experience while preserving the existing staking system.


## Specification

When a consensus node is scheduled to be removed from the Hedera network:

1. Any pending staking rewards attributable to eligible stakers MUST be automatically distributed before the node is removed.

2. Accounts staked to the removed node MUST be automatically transitioned to an unstaked state.

3. Stakers MUST NOT lose pending rewards solely because a node was removed from the network.

4. Wallet providers and staking interfaces MAY notify affected users and encourage them to select a new node, but such notifications MUST NOT be required for users to retain pending rewards.

5. This proposal does not modify staking reward calculations, eligibility requirements, or existing governance processes.


