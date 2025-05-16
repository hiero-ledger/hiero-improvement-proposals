---
hip: <HIP number (assigned by the HIP editor), usually the PR number>
title: <Brief title describing the purpose of the HIP. Ex: "Biometric Binding Codes">
author: <Comma separated list of the authors' names and/or usernames, or names and emails. Ex: John Doe <@johnDoeGithub1778>, Jane Smith <jane@email.com>>
working-group: <List of the technical and business stakeholders' names and/or usernames, or names and emails. Ex: John Doe <@johnDoeGithub1778>, Jane Smith <jane@email.com>>
requested-by: <Name(s) and/or username(s), or name(s) and email(s) of the individual(s) or project(s) requesting the HIP. Ex: Acme Corp <request@acmecorp.com>>
type: <"Standards Track" | "Informational" | "Process">
category: <"Core" | "Service" | "Mirror" | "Application">
needs-hedera-review: <"Yes" | "No">
hedera-review-date: <Date of Hedera's review in YYYY-MM-DD format>
hedera-approval-status: <"Approved" | "Rejected">
needs-hiero-approval: <"Yes" | "No">
status: <"Draft" | "Review" | "Last Call" | "Active" | "Inactive" | "Deferred" | "Rejected" | "Withdrawn" | "Accepted" | "Final" | "Replaced">
created: <Date the HIP was created on, in YYYY-MM-DD format>
discussions-to: <A URL pointing to the official discussion thread. Ex: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/000>
updated: <Latest date HIP was updated, in YYYY-MM-DD format.>
requires: <HIP number(s) this HIP depends on, if applicable. Ex: 101, 102>
replaces: <HIP number(s) this HIP replaces, if applicable. Ex: 99>
superseded-by: <HIP number(s) that supersede this HIP, if applicable. Ex: 104>
---

## Abstract
Please provide a short (~200 word) description of the issue being addressed.

This abstract should be copied to the description for your pull request.

## Motivation
The motivation is critical for HIPs that want to change the Hiero codebase or
ecosystem. It should clearly explain why the existing specification is
inadequate to address the problem that the HIP solves. HIP submissions without
sufficient motivation may be rejected outright.

## Rationale
The rationale fleshes out the specification by describing why particular design
decisions were made. It should describe alternate designs that were considered
and related work, e.g. how the feature is supported in other ecosystems.

The rationale should provide evidence of consensus within the community and
discuss important objections or concerns raised during the discussion.

## User stories
Provide a list of "user stories" to express how this feature, functionality,
improvement, or tool will be used by the end user. Template for a user story:
> “As (user persona), I want (to perform this action) so that (I can accomplish
> this goal).”

## Specification
The technical specification should describe the syntax and semantics of any new
features. The specification should be detailed enough to allow competing,
interoperable implementations for at least the current Hiero ecosystem. Details can include the low level design, and API/Protobuf definition. 

Some specifications are of exceptional size. If your HIP requires detail of
this level, add the large segments of specification as files of the appropriate
type (e.g. Solidity code, Protocol Buffer definition, Java code, etc.) in the
`assets` folder, and include descriptive links to each file here.

### Example Specification
Add a new `TokenAirdrop` transaction to `HieroFunctionality`:

```protobuf
enum HieroFunctionality {
    /**
     * Airdrops one or more tokens to one or more accounts.
     */
    TokenAirdrop = 94;
}
```

Define a new `TokenAirdrop` transaction body. This transaction distributes
tokens from the balance of one or more sending account(s) to the balance of
one or more recipient accounts. The full definition, for clarity, is detailed
in [an attached file](assets/hip-0000-template/sample.proto).

### Impact on Mirror Node
Describe impacts, if any, on the Hiero Mirror node.

### Impact on SDK
Describe Impacts, if any, on the Heiro SDKs

## Backwards Compatibility
All HIPs that introduce backward incompatibilities must include a section
describing these incompatibilities and their severity. The HIP must explain how
the author proposes to deal with these incompatibilities. HIP submissions
without a sufficient backward compatibility treatise may be rejected outright.

## Security Implications
If there are security concerns in relation to the HIP, those concerns should be
explicitly addressed to make sure reviewers of the HIP are aware of them.

## How to Teach This
For a HIP that adds new functionality or changes interface behaviors, it is
helpful to include a section on how to teach users, new and experienced, how to
apply the HIP to their work.

## Reference Implementation
The reference implementation must be complete before any HIP is given the status
of “Final.” The final implementation must include test code and documentation.

## Rejected Ideas
Throughout the discussion of a HIP, various ideas will be proposed that are not
accepted. Those rejected ideas should be recorded along with the reasoning as to
why they were rejected. This helps document the thought process behind the final
version of the HIP and prevents people from revisiting the same rejections later.

## Open Issues
While a HIP is in draft, new ideas may arise that warrant further discussion.
List them here so everyone knows they are under consideration but not yet
resolved. This reduces duplication in future discussions.

## References
A collection of URLs used as references throughout the HIP.

## Copyright/license
This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
