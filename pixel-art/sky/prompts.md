# PixelLab log: the sky island (style test, then production)

Cap for this phase: 50 generations (the redesign's floor is 1,396.9 remaining; never USD credits).

Balance before (2026-10-21, start of the style test): 1,591.90 generations remaining, $2.00 credits.

| # | tool | prompt | cost | used for |
|---|---|---|---|---|
| | | none | 0 | |

**Generations used: 0.** Every piece in this folder is drawn by its script (pixel-art-studio
rules): the floors, edges, cliff and underside must tile with themselves by rule, which a
generator does not guarantee, and the clouds, islets, trees and rotors came out well enough by
hand that a draft was not worth the snap-and-repair pass. Production may still spend some on the
title scene or on richer tree canopies (log them here).

Balance after: 1,491.90 generations remaining, $2.00 credits. The 100 that went between the two
readings are not this folder's (no PixelLab call was made here): another session on the same
account spent them while this one ran.

## Production (cap 80; counted from each call's own result, other sessions share the account)

| # | tool | prompt | settings | cost | used for |
|---|---|---|---|---|---|
| 1 | create_image_pixflux (job 2665299f) | "a round leafy deciduous tree seen from high top-down 3/4 view, crown made of distinct rounded leaf clumps each lit on its top-left with a dark shadow under each clump, short brown trunk, cartoon style, bright green" | 32x32, no background, high top-down, black outline, medium shading, palette forced to ink1 grass0-3 wood1-3 moss1 | 1 | rejected: soft, no clusters, no outline (`raw/pl_tree1.png`) |
| 2 | create_image_pixflux (job 5a75e03e) | "a bushy oak tree seen from high top-down 3/4 view, wide crown of five big rounded leaf clusters with bright highlights and dark gaps between clusters, thick short trunk, cute cartoon pixel art" | 32x32, as #1, detailed shading | 1 | `prop_tree` frame 0 (oak) and, turned round and recoloured peach and cream, frame 3 (blossom): `props.py` `oak_draft()` snaps it, clears its dirt patch and adds our shadow (`raw/pl_tree2.png`) |

**Production generations used: 2.**
