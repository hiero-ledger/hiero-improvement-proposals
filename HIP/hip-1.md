---
hip: 1
title: Hiero Improvement Proposal Process
author: Ken Anderson (@kenthejr), Serg Metelin (@sergmetelin), Simi Hunjan (@SimiHunjan), Michael Garber (@mgarbs)
type: Process
needs-hiero-review: No
needs-hedera-approval: No
status: Active
created: 2021-02-11
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/54
updated: 2025-03-25
hedera-reviewed-date: N/A
hedera-approval-status: N/A
---

## What is a HIP?

HIP stands for **Hiero Improvement Proposal**. A HIP is intended to provide information or initiate engineering efforts to update functionality under Hiero governance. The HIP should be technically clear and concise, and as granular as possible. Small, targeted HIPs are more likely to reach consensus and result in a reference implementation.

HIPs are intended to be the primary mechanism for proposing new features, for collecting community input, and for documenting the design decisions that go into the Hiero codebase. The HIP author is responsible for building consensus within the community and documenting dissenting opinions.

Because the HIPs are maintained as text files in a versioned repository, their revision history is the historical record of the proposal. HIPs are **not** meant to address *bugs* in implemented code. Bugs should be addressed using issues on the implementation's repository.

> **Note on Hedera Adoption**  
> While the Hiero Technical Steering Committee (TSC) decides on Accepting or Rejecting HIPs, there is an optional set of headers (`hedera-reviewed-date`, `hedera-approval-status`) to note if/when Hedera decides to adopt the HIP for its own mainnet. If Hedera chooses not to adopt, the `hedera-approval-status` can be set to `Rejected`.

## HIP Types

There are three kinds of HIP:

1. **Standards Track**
   Describes a new feature or implementation for the Hiero codebase or an interoperability standard recognized by Hiero. The Standards Track HIP abstract should include which part of the Hiero ecosystem it addresses. Standards Track HIPs require both a specification and a reference implementation.

   - **Core:** Proposals addressing the low-level protocol, algorithm, or networking layers.  
   - **Service:** Proposals that add or improve functionality at the service layer of the Hiero software stack.  
   - **Mirror:** Proposals for software designed to retrieve records (transactions, logs, etc.) from the core network and make them available to users in a meaningful way.  
   - **Application:** Proposals to standardize ecosystem software that isn’t directly a Hiero node or mirror (e.g., application network software, external contract consensus services, oracles).

2. **Informational**  
   Describes a Hiero design issue or provides general guidelines to the community but does not propose a new feature or standard. Such HIPs do not necessarily represent a community consensus or recommendation.

3. **Process**  
   Describes a process surrounding Hiero, or proposes a change to one. Process HIPs are similar to Standards Track HIPs but apply outside the code itself. Meta-HIPs are considered Process HIPs.

## HIP Workflow

### Hiero Technical Steering Committee

The Hiero Technical Steering Committee (Hiero TSC) is the body that makes final decisions on whether or not to Accept or Reject Standards Track HIPs pertaining to Hiero’s core or service layers. The Committee is also responsible for decisions regarding the technical governance of the open-source codebase donated by Hedera.

### Core Developers

Hiero’s “core developers” include those contributing to the open-source project under the Hiero Organizatioon—employees, contractors, or community members recognized by Hiero.

### HIP Editors

HIP editors are individuals responsible for the administrative and editorial aspects of the HIP workflow, such as assigning HIP numbers and merging pull requests once a HIP is properly formatted.

### Start With an Idea

The HIP process begins with a new idea. It is highly recommended that a single HIP contain a single key proposal or new idea. Collaborators reserve the right to reject a HIP if it appears too unfocused or broad. If in doubt, split your HIP into several well-focused ones.

Each HIP must have a champion (the “author”) who writes the HIP in the specified style, shepherds discussions, and attempts to build consensus. The champion can make a PR of their hip against the official repository and the PR will serve as the hip's discusion and the link to the PR will be the value of the `discussions-to` header.

### ⚠️ Setting up DCO

This repository inherits security practices requiring the Developer Certificate of Origin (DCO). Please set up your DCO sign-off before creating or updating a HIP. 

### Submitting a HIP

1. **Fork the HIP repository**, and create a markdown file named `hip-0000-my-feature.md`.  
2. Include the standard HIP front-matter (preamble) at the top, using “Draft” for `status` and “0000” as a placeholder HIP number.  
3. **Open a draft pull request** for your newly created file.  
4. Iterate with the community, updating the PR as needed.  
5. When ready, convert the PR from "Draft" to "Review" to request an editorial review.  
6. The editors will check for correct structure, formatting, and clarity. If the HIP is sound, they will:  
   - Assign a HIP number (usually the PR number)  
   - Merge the PR into the repository with `Draft` status  
7. From there, the community continues discussion—possibly leading to further commits or PRs that update the HIP.

### HIP Review & Resolution

When the HIP author believes the proposal is complete, they may request content review from the core developers and editors. A HIP must be clear and complete, presenting a net positive improvement.

A HIP may be marked **Last Call** to gather final user feedback before acceptance. At the end of the Last Call period, if no substantive changes are needed, editors mark the HIP as **Accepted** (or the Committee might ultimately mark it as **Rejected**).

- **Accepted** means the Committee believes it is ready to proceed.  
- **Final** means the reference implementation has been completed and merged, and the proposal is fully realized in code.

Alternatively, a HIP can be:
- **Deferred** (no progress),
- **Withdrawn** (the author decides to abandon it),
- **Stagnant** (stalled draft or review for six months),
- **Rejected** (if it's not accepted), or
- **Replaced** (superseded by a newer HIP).

> **Hiero Review vs. Hedera Review**
> - **Hiero Review**: Standards Track HIPs typically require a final vote by the Hiero TSC.
> Note: If the HIP is Accepted by Hiero, Hedera may choose whether to adopt it onto the Hedera mainnet. The `hedera-reviewed-date` header can be updated to mark the date of the review, and `hedera-approval-status` can be set to `Approved` or `Rejected`.

The possible paths of the status of HIPs are as follows:

⚠️ **NOTE**: The diagram below illustrates all valid status transitions:

![HIP States](../assets/hip-1/hip-states.png)

### HIP Status Titles

- **Idea** – Pre-draft, not in the repository.
- **Draft** – The formal starting point of a HIP.
- **Review** – Under editorial or community review.
- **Deferred** – Under consideration for future implementation, not immediate.  
- **Withdrawn** – Author has withdrawn the HIP.  
- **Stagnant** – Inactive for 6+ months while in Draft or Review.  
- **Rejected** – Declined by consensus or Hiero TSC.  
- **Last Call** – Final comment period before acceptance.  
- **Hiero Review** – Official review by the Hiero TSC.  
- **Accepted** – Hiero TSC has voted yes; ready for implementation.  
- **Final** – Implementation completed and recognized as the standard.  
- **Active** – Some Informational or Process HIPs that are ongoing.  
- **Replaced** – Rendered obsolete by a newer HIP.

### HIP Maintenance

Standards Track HIPs generally no longer change once they reach Final. Updates can be noted as errata. Informational or Process HIPs can be updated as needed, often with editorial oversight.

## What belongs in a successful HIP?

A successful HIP document typically includes:

1. **Preamble**  
   With metadata: HIP number, title, author(s), type, status, discussions-to, etc.
2. **Abstract**  
   A short summary (~200 words).  
3. **Motivation**  
   Explains why existing specifications are inadequate.  
4. **Rationale**  
   Explains why particular design decisions were made; includes discussion of alternatives.  
5. **User Stories**  
   "As a (user role), I want (action) so that (benefit)."  
6. **Specification**  
   Technical details and syntax.  
7. **Backwards Compatibility**  
   If incompatible changes are introduced, discuss severity and solutions.  
8. **Security Implications**  
   Address any security concerns explicitly.  
9. **How to Teach This**  
   Guidance on explaining this HIP to others.  
10. **Reference Implementation**  
   Required for Standards Track HIPs to become Final.  
11. **Rejected Ideas**  
   Summaries of alternative ideas and why they were not pursued.  
12. **Open Issues**  
   Items still under discussion.  
13. **References**  
   URLs and other resources used throughout the HIP.  
14. **Copyright/License**  
   HIPs must be placed under the Apache License, Version 2.0.

## HIP Formats and Templates

Use [GitHub-flavored Markdown] with the "HIP Template" as a base. 

### HIP Header Preamble

Each HIP must begin with a YAML front-matter block:
```yaml
---
hip: <HIP number>
title: <HIP Title>
author: <list of authors>
working-group: <optional list of stakeholders>
requested-by: <name(s) or project requesting it>
type: <Standards Track | Informational | Process>
category: <Core | Service | Mirror | Application> (if Standards Track)
needs-hiero-review: <Yes | No>
needs-hedera-approval: <Yes | No>
status: <Draft | Review | Last Call | Accepted | Final | Active | Deferred | Withdrawn | Stagnant | Rejected | Replaced>
created: <date in yyyy-mm-dd format>
last-call-date-time: <optional, set by editor for last call end>
discussions-to: <URL for official discussion thread>
updated: <dates in yyyy-mm-dd format>
requires: <optional HIP number(s)>
replaces: <optional HIP number(s)>
superseded-by: <optional HIP number(s)>
release: <optional implementation release version>
hedera-reviewed-date: <optional, e.g. N/A, or 2025-01-15>
hedera-approval-status: <optional, e.g. N/A, Approved, or Rejected>
---
```

These fields mirror the original system, but include the new Hedera review headers:
- `needs-hedera-approval`: Indicates whether the HIP requires Hedera's approval (Yes/No)
- `hedera-reviewed-date`: The date when Hedera reviewed the HIP (if applicable) 
- `hedera-approval-status`: Whether Hedera approved or rejected the HIP (Approved/Rejected/N/A)

### Reporting HIP Bugs or Updates

Report issues as GitHub issues or pull requests. Major changes to a Final HIP typically require either a new HIP or a very careful editorial process.

### Transferring HIP Ownership

If a HIP author no longer wishes to maintain it, they can arrange new ownership. If they cannot be reached, a HIP editor can assign a new champion.

### HIP Editor Responsibilities

Editors handle:

- Approving initial formatting and structural correctness.
- Assigning HIP numbers.
- Merging final changes once the HIP meets requirements.

They do *not* judge the proposals themselves, but ensure the process is followed.

## Style Guide

When referring to a HIP by number, write it as "HIP-X" (e.g. HIP-1). Where possible, link it using relative Markdown links, such as `[HIP-1](./hip-1.md)`.

## History

This document was derived from Bitcoin's BIP-0001, Ethereum's EIP-1, and Python's PEP-0001. Much text was simply copied and adapted.

## Copyright

This document is licensed under the Apache License, Version 2.0. See [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
