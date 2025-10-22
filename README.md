![](./assets/hiero_logo.png)

[![](https://img.shields.io/discord/905194001349627914)](https://discord.com/channels/905194001349627914/1289954446712770600)
[![](https://img.shields.io/badge/view-published-blue)](https://hips.hedera.org)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hiero-ledger/hiero-improvement-proposals/badge)](https://scorecard.dev/viewer/?uri=github.com/hiero-ledger/hiero-improvement-proposals)
[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/10697/badge)](https://bestpractices.coreinfrastructure.org/projects/10697)
[![License](https://img.shields.io/badge/license-apache2-blue.svg)](LICENSE)

## Submit a HIP
1. Fork this repository
1. Fill out this template: [hip template](hip-0000-template.md)
   1. If the proposal contains exceptionally large specification text,
      particularly API changes or source code, place those changes
      in `assets` and link them as described in the template document.
1. Create a pull request against hiero-ledger/hiero-improvement-proposals main
<dl>
<dt>But what category do I make my HIP?</dt>
<dd>See <a href="HIP/hip-1.md#hip-types">hip-1 HIP types</a>.</dd>
</dl>

See [hip-1](HIP/hip-1.md) for details on the HIP process.

## What is a HIP?
HIP stands for "Hiero Improvement Proposal". These improvement proposals can
range from core protocol changes, to the applications, frameworks, and protocols
built on top of the Hiero network and used by the community. The HIP
author is responsible for building consensus within the community and
documenting dissenting opinions, as well as tracking their HIP through
the process outlined below.

You can see the list of all HIPs on [the official HIPs site](https://hips.hiero.org).

## What is Hiero?
[Hiero](https://hiero.org) is an open-source distributed ledger project under
the Linux Foundation Decentralized Trust (LF Decentralized Trust). Hiero builds
upon the [Hashgraph consensus algorithm](http://www.leemon.com/papers/2016b.pdf)
created by [Dr. Leemon Baird](http://www.leemon.com/). The project provides a
fast, fair, and secure environment for distributed ledger technologies. You can
learn more about the Hashgraph Consensus Algorithm by reading the
[hashgraph algorithm whitepaper](http://www.leemon.com/papers/2016b.pdf).

## Purpose
The goal of HIPs is to have a place to propose new features, to collect
community thoughts and input on a particular issue, and further to document
all these subject matters in one place. It's a great way to document these
discussions and proposals
[here on GitHub](https://github.com/hiero-ledger/hiero-improvement-proposals),
because any revisions made on these text files will be recorded.

## Qualifications
Each HIP should only be one single key proposal and/or idea. The idea should be
focused and only issue to one subject matter to be successful. A HIP must meet
certain minimum criteria: it must be clear and have a complete description of
the proposed enhancement, the enhancement must represent a net improvement,
the proposed implementation, if applicable, must be solid and must not
complicate the protocol unduly.

## Before Submitting
1. Evaluate your idea: consider why you'd like to request changes or
   improvements, and how it benefits the Hiero community.
1. Thoroughly look through those proposals already submitted to ensure there
   are no duplicates.
1. Ask the Hiero community first if your idea is original, or has
   already been through the HIP process.
1. Reevaluate your proposal to ensure sure the idea is applicable
   to the entire community and not just to one particular author, application,
   project, or protocol.

## Local Jekyll Site
Pre-requisites:
- `ruby`: `2.7.8p225`
- `gem`: `3.4.10`
- `bundler`: `1.17.3`
You can run a local version of the HIPs dashboard site:
```shell
bundle install
bundle exec jekyll serve --livereload
```
The site will be available on `http://localhost:4000`.

You can read more about Jekyll on its official [website](https://jekyllrb.com/)

##### Note
An excellent place to discuss your proposal and get feedback is in the
[issues section of this repository](https://github.com/hiero-ledger/hiero-improvement-proposals/issues),
or on [LFDT's Discord Server](https://discord.com/channels/905194001349627914/1289954446712770600);
there you can start formalizing the language around your HIP and ensuring it has broad
community support.

## Disclaimer(s):
These proposals and discussions have no effect regarding private (permissioned)
implementations of the Hashgraph consensus algorithm; additionally, this
repository and its contents are maintained by the Hiero community under the
governance of the Linux Foundation Decentralized Trust.
