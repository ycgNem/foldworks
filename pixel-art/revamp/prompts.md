# The Lantern Bayou revamp (phase 2): PixelLab jobs and their cost

Balance at the start of phase 2: **2,178.90** generations (USD credit $2.00, never spent).
Palette passed to every job that takes one: `pal.ART` (51 colours; the palette names "Lantern
Bayou"). Pixflux jobs force it through `color_image` (phase 1's 48-colour swatch).

## 8-direction objects (10 generations each), size 32, view high top-down

| Object | Prompt | Id | Cost |
|---|---|---|---|
| miner | compact ore mining machine: a steel box body on a short base with a big conical drill bit on its front, small brass details, factory game building | `098b13f0-2f8f-4557-b4e5-733a81b92343` | 10 |
| smelter (Mk1 shrunk, Mk2 full) | large brick and iron smelting furnace with a glowing orange furnace mouth on its front and a short chimney on top, factory game building | `a3254ddb-3451-4877-9e53-406f0b298a87` | 10 |
| press test at 24 px (not used: too big for 16, too small for 32) | small metal stamping press machine ... | `0d3584bc-af94-485c-b670-e326c475017f` | 10 |
| press (Mk1 and Mk2) | metal stamping press machine: a sturdy steel frame with a heavy piston ram above an anvil plate at its front, brass bolts, factory game building | `bc1bf63f-d0b0-4840-98bf-5b2b8ad3fb62` | 10 |
| assembler (Mk1 and Mk2) | assembler machine: a steel workbench cabinet with two articulated robotic arms working over a tray at its front, brass joints, a small green lamp | `e7b1c3bb-c4e5-4ccf-8cde-081227c3ac7e` | 10 |
| hand furnace | small hand-cranked furnace: a round brick and clay furnace with a big iron crank wheel on its side, a leather bellows, and a glowing mouth at its front | `535e6109-d360-49fb-984a-d4e418d8c79d` | 10 |
| boiler | riveted steam boiler: a horizontal copper and iron tank on a brick firebox with a glowing fire door at its front, a pressure gauge and a steam pipe on top | `81e50bd8-b7a9-436f-8369-0a1eeb5007a1` | 10 |
| steam engine | steam engine: an iron cylinder with a piston rod driving a large spoked flywheel, brass pipes and valves | `6d72cdf0-1096-47c7-a39e-75ae123a7fa8` | 10 |
| generator | compact coal generator: a steel cabinet with a small chimney, a coal hopper on top, copper coils and a glowing gauge on its front | `83d07496-5036-45da-86ec-2afe1bd76430` | 10 |
| kiln | glass kiln: a domed brick kiln with a glowing arched opening at its front, a teal glass window and a short chimney | `ed5349c7-16df-4111-b014-86b1d953b865` | 10 |
| mixer | concrete mixer machine: a big tilted rotating drum with spiral fins on a steel stand, the drum mouth at its front | `1d057de8-c643-4594-b0dd-59d6e0ffa9e4` | 10 |
| refinery | small oil refinery: two tall steel tanks joined by pipes, a violet glowing heater and a red valve wheel at its front | `a0f7aa6b-f59b-4b4e-b98b-5b9421f55901` | 10 |

## Animations (animate_object v3, 4 frames, east/south/west/north: 1 generation per direction)

| Object | Motion | Cost |
|---|---|---|
| miner | the conical drill bit spins fast and the machine shakes slightly, working | 4 |
| assembler | the two robotic arms swing and reach down to the tray, assembling, then pull back | 4 |
| press | the heavy piston ram slams down onto the anvil plate and rises back up, one stamping stroke | 4 |
| steam engine | the flywheel turns and the piston rod pushes back and forth, puffs of steam | 4 |
| mixer | the big drum rotates steadily on its stand, its spiral fins turning | 4 |

Fire, glow and gauges (smelter, hand furnace, boiler, generator, kiln, refinery) are animated by
hand: `machines.flicker` steps the lantern ramp up and down a notch per frame.

## 1-direction review packs (10 generations each)

| Pack | Base prompt | Id | Cost | Used |
|---|---|---|---|---|
| 32 px, 64 candidates | cosy factory game building, lantern-lit bayou at dusk, light weathered wood and blue-grey steel, warm glowing lanterns, strong dark outline, clear bright highlights, readable silhouette (+24 item descriptions: docks, hoppers, factory dock and hopper, six houses, the Mayor's house, a stall, a lamp, a pole, a crate, a slag heap, splitter, merger, Unit 7's tower, Voltaire's pavilion, a frog) | `37b1d83a-7d77-41a3-a9e4-ee12d2fb13b7` | 10 | docks, hoppers, houses, stall, lamp, pole, crate, heap |

## Portraits (create_image_pixflux 48x48, 1 generation each)

Base portraits are img2img from the hand-drawn Milestone 1-4 portraits (recoloured to B) at
init strength 220, so the cast keeps its faces and gains PixelLab's shading; the Committee is new.

| Portrait | Id | Cost |
|---|---|---|
| Bramble | `c997ab5a-f825-4ad4-9db9-7c5606a1ba76` | 1 |
| Unit 7 | `1cac31fa-17e4-4409-8a7a-9b9898cdab4f` | 1 |
| Dame Voltaire | `6a469480-6fac-4713-9285-c1eacc6e828f` | 1 |
| The Committee (first roll, one raccoon: not used) | `8e6f0afc-b422-40c3-b06c-0b54831f6f63` | 1 |
| The Committee (second roll: used, the peeking raccoon and the tail added by hand) | `dcd64f49-fa42-416c-a3d7-40ed54ead192` | 1 |
| Bramble cheer (img2img over his cheer) | `cf00c180-5ccc-4730-ae63-29f50e97412d` | 1 |
| The Committee cheer | `5c678fa3-55d9-4210-be0b-1930dcfb107e` | 1 |

Unit 7's and Voltaire's img2img results were not used (Unit 7 lost its screen face, Voltaire's
skin changed); their hand-drawn portraits ship, recoloured.

## Total

| Kind | Generations |
|---|---|
| 8-direction objects (12 x 10) | 120 |
| animations (5 x 4) | 20 |
| review pack | 10 |
| portraits (7 x 1) | 7 |
| **phase 2** | **157** |

Balance after phase 2: **2,021.90** (2,178.90 − 157.00, matched by `get_balance`). USD credit
untouched ($2.00).

## Phase 3 (readability and the complete redraw)

No PixelLab jobs: every phase-3 sprite is hand-drawn by code or redrawn from its own
Milestone 1-5 recipe (recipes.py). Balance before and after phase 3: **2,021.90**.

## The title scene (create_image_pixflux 320x180, 1 generation each, palette B forced)

| Backdrop | Seed | Id | Cost | Used |
|---|---|---|---|---|
| dusk bayou, a row of stilt houses with lantern windows, moonlit teal water, reeds at the corners | 11 | `c7ae06e9-cd94-4cac-b53e-6326c4d46149` | 1 | yes (raw/title/bg_a.png) |
| the same prompt | 42 | `5b1c2330-6bdf-42e1-81a9-cf22de7c5b7b` | 1 | no (a canal in perspective) |
| a title-screen dusk swamp with strings of lanterns | 7 | `5fbd10e7-75bb-464b-a19e-db8db1c7a3a1` | 1 | no (no town) |

Balance after the title scene: **2,018.90** (2,021.90 − 3).
