---
hip: <to be assigned>
title: Commerorative On-Chain Reactions (The Berlin Emoji Standard)
author: Michael Garber <@mgarbs>
working-group: Hendrik Ebbers <@hendrikebbers>, Michael Kantor <@kantorcodes>, Milan Wiercx <@MilanWR>, Daniel Ntege <@danielmarv>, Diane Mueller <@dmueller2001>, Alex Popowycz <@popowycz>
type: Informational
needs-hiero-approval: No
needs-hedera-review: No
status: Draft
created: 2026-07-07
discussions-to: <to be assigned>
---

## Abstract

This HIP proposes a lightweight, open standard for commemorative on-chain reactions: 
a way for anyone to permanently record a shared moment — a conference, a launch, a milestone — as a single canonical emoji written to a Hiero Consensus Service topic.
  
As its first canonical reaction, this HIP ratifies 🦄 as the official reaction of Hiero Community Day Berlin. 

🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄 🦄

## Motivation

Communities constantly create shared moments, but the usual way of remembering them — a hashtag, a photo dump, a chat reaction that scrolls away — is ephemeral and centrally owned. Hedera has no standard way to say "I was here" that is permanent, timestamped, and verifiable. 🦄. A commemorative reaction standard turns a fleeting moment into a piece of public, ordered, tamper-proof history.

## Rationale

Hedera Consensus Service already provides fair ordering and immutable timestamps for fractions of a cent — exactly what a commemorative reaction needs. Rather than invent a new primitive, this HIP defines a minimal message convention on top of HCS, so any wallet, dApp, or event can emit and read reactions without coordination.

## Specification

A commemorative reaction is a single message submitted to a dedicated HCS topic, formatted as JSON:
  
```json
  {
    "standard": "commemorative-reaction",
    "version": "1.0",
    "reaction": "🦄",
    "event": "hiero-community-day-berlin",
    "actor": "0.0.xxxx"
  } 
```
  
  - reaction (required): a single Unicode emoji.
  - event (required): a human-readable slug identifying the moment.
  - actor (optional): the account id of the reactor.
  
The first canonical reaction ratified under this standard is 🦄 for the event "hiero-community-day-berlin".

## Backwards Compatibility

N/A

## Security Implications

N/A

