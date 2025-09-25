---
hip: 0000 # Assigned by HIP editor.
title: <The HIP Title> # Keep concise and descriptive.
author: <list of authors\' real names and GitHub handles, e.g., Jane Doe (@janedoe), John Smith (@johnsmith)>
working-group: <optional list of key stakeholders\' real names and GitHub handles who are actively involved in shaping the HIP>
requested-by: <optional name(s) of individual(s), project(s), or organization(s) requesting or sponsoring the HIP>
discussions-to: <URL of the GitHub Pull Request for this HIP> # This will be filled by the HIP editor upon PR creation.
type: <Standards Track | Informational | Process> # Refer to HIP-1 for definitions.
category: <Core | Service | Mirror | Block Node | Application | Process> # Required for Standards Track and Process HIPs. Refer to HIP-1 for category definitions.
needs-hiero-approval: Yes # Set to Yes if Hiero Technical Steering Committee (TSC) approval is required (typically for Standards Track & Process HIPs). Set to No for Informational HIPs or if not applicable as per HIP-1.
needs-hedera-review: No # Set to Yes if the HIP proposes changes for the Hedera network/ecosystem and requires review/acceptance by Hedera (typically Standards Track: Core, Service, Mirror). Refer to HIP-1 for details.
status: <Draft | Review | Last Call | Approved | Accepted | Final | Active | Deferred | Withdrawn | Stagnant | Rejected | Replaced> # Refer to HIP-1 for status definitions and workflow.
created: <yyyy-mm-dd> # Date of first submission as a Draft.
updated: <yyyy-mm-dd> # Date of last modification.
requires: <optional HIP number(s) that this HIP depends on>
replaces: <optional HIP number(s) that this HIP renders obsolete>
superseded-by: <optional HIP number(s) that this HIP is replaced by>
release: <optional, target release or version number for implementation if applicable>
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
