---
hip: 1
title: Hiero Improvement Proposal Process
author: Ken Anderson (@kenthejr), Serg Metelin (@sergmetelin), Simi Hunjan (@SimiHunjan), Michael Garber (@mgarbs)
type: Process
needs-hiero-approval: Yes
needs-hedera-review: No
status: Active
created: 2021-02-11
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/54
updated: 2025-05-20
---

## What is a HIP?

HIP stands for **Hiero Improvement Proposal**. A HIP is intended to provide information or initiate engineering efforts to update functionality under Hiero governance. The HIP should be technically clear and concise, and as granular as possible. Small, targeted HIPs are more likely to reach consensus and result in a reference implementation.

HIPs are intended to be the primary mechanism for proposing new features, for collecting community input, and for documenting the design decisions that go into the Hiero codebase. The HIP author is responsible for building consensus within the community and documenting dissenting opinions.

For HIPs that propose changes to the Hiero codebase (typically Standards Track HIPs for Core, Service, Mirror Node or Block Node categories), the process involves Hiero providing technical approval and Hedera providing review and acceptance if the changes are to be incorporated into the Hedera network or ecosystem.

Because the HIPs are maintained as text files in a versioned repository, their revision history is the historical record of the proposal. HIPs are **not** meant to address *bugs* in implemented code. Bugs should be addressed using issues on the implementation's repository.

> **Note on Hedera Adoption**  
> While the Hiero Technical Steering Committee (TSC) decides on Approving or Rejecting HIPs into the Hiero codebase, there is an optional set of headers (`hedera-reviewed-date`, `hedera-approval-status`) to note if/when Hedera decides to Accept the HIP for its own mainnet. If Hedera chooses not to adopt, the `hedera-approval-status` can be set to `Not Accepted`.

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

The Hiero Technical Steering Committee (Hiero TSC) is the body that makes final decisions on whether or not to Approve Standards Track HIPs pertaining to Hiero’s core or service layers. The Committee is also responsible for decisions regarding the technical governance of the open-source codebase donated by Hedera.

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

A HIP may be marked **Last Call** to gather final user feedback. 

Following a successful Last Call period (or if Last Call is deemed unnecessary for minor changes):
- For HIPs requiring Hiero's technical endorsement (most Standards Track and Process HIPs, where `needs-hiero-approval: Yes`), the Hiero TSC will review the HIP. If they agree, the HIP status changes to **Approved**.
- For HIPs that also require Hedera's adoption (e.g., changes to be implemented on the Hedera mainnet, typically Standards Track HIPs of type Core, Service, Mirror Node, where `needs-hedera-review: Yes`), Hedera will conduct a review. If Hedera agrees to adopt and implement the HIP, its status changes to **Accepted**.

A HIP can only reach **Accepted** status after it has been **Approved** (if Hiero approval is required).

- **Final** means the reference implementation has been completed, merged, and the proposal is fully realized in code (e.g., deployed on the Hedera mainnet or integrated into the relevant Hiero open-source project).

Alternatively, a HIP can be:
- **Deferred** (no progress),
- **Withdrawn** (the author decides to abandon it),
- **Stagnant** (stalled draft or review for six months),
- **Rejected** (if it's not accepted), or
- **Replaced** (superseded by a newer HIP).


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
- **Rejected** – Declined by consensus or Hiero TSC
- **Last Call** – Final comment period before Hiero approval.
- **Approved** – Hiero TSC has formally approved the technical specification of the HIP. For Process HIPs not needing Hedera review (like this one), or Informational HIPs, this may be the final substantive state before Active/Final.
- **Accepted** – Hedera has formally agreed to adopt and implement the HIP (applies to HIPs where `needs-hedera-review: Yes`). This status follows 'Approved'.
- **Final** – Implementation completed and recognized as the standard (e.g., released on mainnet or in the relevant Hiero project).
- **Active** – Some Informational or Process HIPs that are ongoing or have been adopted.
- **Replaced** – Rendered obsolete by a newer HIP.

## HIP Statuses

HIPs have the following statuses:

*   **Draft**: The HIP is currently being drafted and is not yet ready for review.
*   **Review**: The HIP is ready for review by the community and HIP editors.
*   **Last Call**: The HIP is in a final review window, typically 14 days, before being moved to a Hiero TSC approval vote (Service, Core, Mirror, Block Node hips) or `Accepted` (Application hips).
*   **Approved**: A Standards Track HIP has been approved by Hiero and is awaiting review by Hedera.
*   **Accepted**: Standards Track HIPs that have been accepted by the community or the Hedera Council depending on the type of hip it is.
*   **Final**: A Standards Track HIP has been reviewed and accepted by Hedera, and its reference implementation has been merged.
*   **Active**: A Process or Informational HIP that is currently in effect.
*   **Stagnant**: A HIP that has been inactive for a significant period (e.g., 6+ months) may be marked as Stagnant by the HIP editors.
*   **Deferred**: A HIP that is not currently being pursued but may be revisited in the future.
*   **Withdrawn**: The HIP author has withdrawn the proposal.
*   **Rejected**: The HIP has been rejected by the HIP editors, the community, or a Hiero TSC vote.
*   **Replaced**: The HIP has been replaced by a newer HIP.

## HIP Workflow Overview

### Standards Track HIPs

Standards Track HIPs (categories: Core, Service, Mirror, Block Node) follow this general lifecycle:

1.  **Idea**: Propose your idea to the community. Create an [issue](https://github.com/hiero-ledger/hiero-improvement-proposals/issues) to discuss the idea.
2.  **Draft**: Create a copy of the [HIP template](./hip-0000-template.md), fill in the details, and submit it as a pull request (PR) to the HIPs repository. The HIP status should be `Draft`. `needs-hiero-approval` should be `Yes`, and `needs-hedera-review` should be `Yes`.
3.  **Review**: Once the PR is submitted, the HIP editors and community will review the proposal. The status changes to `Review`.
4.  **Last Call**: If the HIP is generally agreed upon, a HIP editor will assign a `last-call-date-time` and change the status to `Last Call`. This is a final opportunity for community feedback, typically lasting 14 days.
5.  **Approved**: After the Last Call period, if there are no major objections that cannot be resolved, Hiero TSC will vote on the hip and if it is approved, a HIP editor or maintainer will create a PR changing the status to `Approved`. At this point, the HIP is considered approved by the Hiero community and awaits review by Hedera.
6.  **Final**: When a hip is implemented in code and released to mainnet, a maintainer updates the status of the hip to `Final` and specifies a `Release` number.
7.  **Stagnant / Deferred / Withdrawn / Rejected / Replaced**: A HIP may also end up in one of these states as described in "HIP Statuses".

### Informational, Process and Application HIPs

Informational and Process HIPs follow a simpler lifecycle:

1.  **Idea**: Propose your idea. Create an [issue](https://github.com/hiero-ledger/hiero-improvement-proposals/issues) to discuss.
2.  **Draft**: Create a copy of the [HIP template](./hip-0000-template.md), fill in the details, and submit it as a PR. The HIP status should be `Draft`.
    *   For Process HIPs: `needs-hiero-approval` should be `Yes`, `needs-hedera-review` should be `No`.
    *   For Informational and Application HIPs: `needs-hiero-approval` should be `No`, `needs-hedera-review` should be `No`.
3.  **Review**: The HIP editors and community review the proposal. Status changes to `Review`.
4.  **Last Call**: If generally agreed upon, a HIP editor assigns a `last-call-date-time` and changes status to `Last Call` (typically 14 days).
5.  **Accepted**: After Last Call, if no major objections, a HIP editor merges the PR.
    *   Process and Informational HIPs: Status changes to `Active`.
    *   Application HIPs: Status changes to `Accepted`.
6.  **Stagnant / Deferred / Withdrawn / Rejected / Replaced**: As described in "HIP Statuses".

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
category: <Core | Service | Mirror | Application | Process> (if Standards Track or Process)
needs-hiero-approval: <Yes | No> # Does the HIP require formal approval by the Hiero TSC?
needs-hedera-review: <Yes | No> # Does the HIP require review and acceptance by the Hedera Council for implementation on its network/ecosystem?
status: <Draft | Review | Last Call | Approved | Accepted | Final | Active | Deferred | Withdrawn | Stagnant | Rejected | Replaced>
created: <date in yyyy-mm-dd format>
last-call-date-time: <optional, set by editor for last call end>
discussions-to: <URL for official discussion thread>
updated: <dates in yyyy-mm-dd format>
requires: <optional HIP number(s)>
replaces: <optional HIP number(s)>
superseded-by: <optional HIP number(s)>
release: <optional implementation release version>
---
```


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
