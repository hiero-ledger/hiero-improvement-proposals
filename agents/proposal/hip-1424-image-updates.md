# HIP-1424 image updates needed

Written 2026-07-29, updated 2026-08-08. All text/prose changes to HIP-1424 are
done and committed (see `git log d1bf49d..HEAD -- HIP/hip-1424.md` on
`block-stream-hashing`). The items below are image-only fixes that were **not**
made, because the assets are either raster (can't be text-edited at all) or
vector diagrams whose text is outlined into paths rather than real SVG `<text>`
elements (can't be find-and-replaced, and safely repositioning hand-edited
glyph paths without a render/adjust loop was judged too risky to attempt
blind). Nana confirmed there is no separate design-tool source file for the
SVGs — the SVGs themselves are the only artifact — so any fix has to happen by
editing these files directly (by hand in a vector editor, or by regenerating
the affected diagram).

I verified every item below by rendering the actual current file (via headless
Chrome / QuickLook), not by re-reading old review comments — so this reflects
what's really in the files today, in this exact checkout.

## 0. UPDATE 2026-08-10: three of the five now redesigned from scratch — local only, awaiting review

**Correction to my own note below first:** the paragraph I originally wrote
here claimed these three files "do have real, findable `<text>` elements."
That was wrong — I re-verified directly (`grep -c '<text' *.svg` on all
three, before touching anything) and all three are, like the ones in item 1,
Lucidchart exports with **zero** `<text>` elements (513/451/1214 `<use>`
glyph-reference elements respectively, `xmlns:lucid="lucid"` present, no
native `<rect>` either — boxes are `<path>`-drawn). A find-and-replace or
hand-patch was never viable for these; a separate verification pass I ran
mid-session asserted the opposite and I'm flagging that it was incorrect so
it doesn't get trusted later.

**What I did instead:** wrote a small Python generator
(kept under my scratch dir, not checked in) that lays out the corrected
16-leaf structure programmatically and emits plain SVG with real `<text>`
elements, using the color palette extracted from the original
`block-n-merkle-mountain-hashing.svg` (`#3a414a` dark navy, `#1071e5` blue for
formula text, `#c3f7c8` green, `#ffdda6` orange, `#ffd6f5` pink, `#e8e2c8` tan,
plus a new `#e2e5e9` grey for the reserved half) so the result stays visually
in-family with the rest of the HIP's diagrams rather than looking like a
foreign asset. All three now show the reserved half (positions 9–16) with the
**same solid styling** as positions 1–8, joined with a normal two-child
(`0x02`) node at every level — no dashed/faint/red-dotted treatment, no
single-child `0x01` node anywhere in the tree. Render-verified with headless
Chrome before committing.

- **`assets/hip-1424/block-n-merkle-mountain-hashing.svg`** → replaced with
  "Block Root Merkle Tree — Full Structure": the full 16-leaf tree only.
- **`assets/hip-1424/16-leaf-merkle-mountain-top.svg`** → replaced with "Full
  Block Root Tree": the same tree plus a Block Proof box, singular
  signature (also resolves item 1 below for this file).
- **`assets/hip-1424/expanded-merkle-mountain-top.svg`** → replaced with
  "Expanded Merkle Mountain Top": tree + Block Proof + a legend callout
  (`0x00` / `0x02` / `E = hash(0x00)`) that states directly "this half is
  never omitted, and its parent is never a single-child (0x01) node" (also
  resolves item 1 and item 3 below for this file — the old "repeated Proof
  signatures," "single child... 0x1," "None of this exists," and
  "embeded"/"histirical" text is gone because the file was rewritten, not
  patched).

**Status: local only, not pushed.** Committed on `block-stream-hashing` as
its own commit, per your instruction to leave image changes for your review
before anything goes out. Also note: none of the three are currently
*referenced* from `HIP/hip-1424.md` — all five Mountain Top images were
un-referenced from the text in the earlier `ddf18bc` commit because they
contradicted it. Now that these three match the decided model, re-adding
`![...]` references back into the relevant sections is a separate, deliberate
edit I have not made — happy to do it once you've looked at the images
themselves.

**Original note (context on why a hand-patch was ruled out), preserved
below:** the diagram's own label was the clearest evidence of the defect —
`block-n-merkle-mountain-hashing.svg`'s `Internal Node 2` was explicitly
annotated `hash(0x1 | IN3#)`, a single-child hash of only the left half, with
no right/reserved half fed in at all. `16-leaf-merkle-mountain-top.svg` drew
the reserved half in faint/grey styling inside a red dotted box, connected by
a dashed line. `expanded-merkle-mountain-top.svg` had explicit text making it
unambiguous: the joining node was labeled *"This node is a single child
internal node so has prefix byte `0x1`,"* and the reserved half was captioned
*"None of this exists to start with, but we added a extra parent to allow for
future expansion."*

**`assets/hip-1424/block-n-1-reserved-node-merkle-mountain-hashing.svg`** and
**`block-n-3-reserved-node-merkle-mountain-hashing.svg`** (were "Block with
One/Three Reserved Node(s)," illustrating "activating" a reserved position by
adding new `0x01` single-child nodes). Under the corrected model, assigning a
reserved position changes nothing about the tree's shape, so this
illustration no longer has anything to show — these two are candidates for
deletion rather than redesign, unless a different illustration (e.g., simply
highlighting that one slot's value changed from `E` to something else, same
shape throughout) would be useful instead.

**Not re-checked against the new model:**
`assets/hip-1424/simplified-merkle-mountain-top.svg` (still referenced, first
image in the Block Merkle Mountain Design section) — didn't show an explicit
contradictory claim when rendered, just a generic "FUTURE RESERVED" box in
similar dashed styling to the other three. Lower priority, but worth a look
before assuming it's fine.

All five orphaned/removed files are still on disk under `assets/hip-1424/` —
nothing has been deleted, only un-referenced from the HIP text.

## 1. "repeated" should be singular — two files, one fix each — RESOLVED 2026-08-10 by the item 0 rewrite

Both files listed below were fully replaced under item 0; the new versions
read "One signature on the Block Root Hash." Original note preserved for
context:

**Files:** `assets/hip-1424/16-leaf-merkle-mountain-top.svg` and
`assets/hip-1424/expanded-merkle-mountain-top.svg` (used at HIP lines 292 and
319 respectively).

**Current text in both:** the blue "Block Proof" box reads:
> Block Proof
> repeated Proof signatures on Block Root

**Problem:** a block has exactly one Block Proof / one signature, never
multiple ("repeated"). This is a standing, still-unresolved review comment from
jsync-swirlds: *"Block Proof has a single signature, not repeated."*

**Suggested fix text:** change the second line to read **"Proof signature on
Block Root"** (drop "repeated", singularize "signatures" → "signature"). Same
fix in both files, same box.

**Not affected:** `assets/hip-1424/simplified-merkle-mountain-top.svg` (HIP
line 273) — its "Block Proof" box has no subtitle line at all, so there's
nothing to fix there.

**Why I couldn't do this myself:** both files are Lucidchart exports
(`xmlns:lucid="lucid"`). Text is drawn as `<use xlink:href="#<glyph-id"/>`
references into a shared `<defs>` block of per-glyph `<path>` outlines — there
is no literal string `"repeated"` anywhere in the file to find-and-replace (a
plain grep for `<text` and for `repeated` both return zero matches, even
though the word is clearly visible when rendered). Fixing it correctly means
either editing in whatever tool can open a Lucidchart-style SVG, or
programmatically identifying and removing the exact `<use>` elements for
"repeated " and the trailing "s" in "signatures," then shifting the remaining
glyphs to close the gap and stay centered in the box — doable, but needs a
render-and-check loop to get the spacing right, which felt like the wrong
tradeoff to attempt unsupervised on a file with 451 glyph placements.

## 2. State Merkle Tree legend is missing the `0x1` prefix

**File:** `assets/hip-1424/state-merkle-tree-hashing.png` (used at HIP line
266). This is a **raster PNG** — there is no vector/text data in it at all, so
this one can only be fixed by regenerating the image from whatever produced
it originally.

**Current legend (top-left yellow box), verbatim:**
> `0x0` prefix byte for nodes with zero children
> `0x2` prefix byte for node with two children

**Problem:** the third prefix byte, `0x1` (single-child internal node), is
missing from the legend — standing review comment from jsync-swirlds: *"The
note top-left is missing `0x01` for nodes with a single child."* Note: the
specific 5-leaf example tree drawn in this image happens to be fully balanced
(every internal node shown has exactly two children — State Root, Node A,
Node AA, and Node B are all 2-child), so there's no single-child node actually
*depicted* needing a `0x1` label on the tree itself. This is purely about the
legend being incomplete relative to the full three-prefix scheme used
elsewhere in the HIP (`0x00` / `0x01` / `0x02`).

**Suggested fix text:** add a third legend line, matching the existing style:
> `0x1` prefix byte for node with one child

## 3. Lower-priority: leftover typo in `expanded-merkle-mountain-top.svg` — RESOLVED 2026-08-10 by the item 0 rewrite

The file was fully replaced under item 0; the new annotation text doesn't
carry this typo forward. Original note preserved for context:

Not tied to any review comment — just noticed while rendering the file. One
small typo in the diagram's own annotation text (not in the main HIP
markdown, just inside this one image): "Previous Block's root is **embeded**
twice... to form **histirical** block merkle sub-tree" → should be
"**embedded**" and "**historical**." (The other annotation I originally
flagged here — "None of this exists to start with, but we added a extra
parent..." — isn't a typo fix anymore; that whole sentence describes the
rejected mechanism and needs to go as part of item 0's redesign, not a
grammar patch.)

Cosmetic only. Fix opportunistically if you're already in this file for the
item 0 redesign — not worth a special trip on its own.

## Not included here

`assets/hip-1424/Merkle%20proof%20sketches.png`, referenced at HIP line 483
(`![Streaming Merkle Tree Growth](../assets/hip-1424/Merkle%20proof%20sketches.png)`),
does not exist in the assets folder at all (0 files matching that name or
similar). This is a broken image reference, not a content-accuracy issue like
1–3 above — it needs a new asset created (a diagram of the streaming tree
growing leaf-by-leaf, matching the step-by-step example table right above it
in the HIP text), or the image reference should be removed if no such diagram
is planned. Flagging here since it's also image-related, but it's a "create
new" task rather than a "fix existing" task like the others.
