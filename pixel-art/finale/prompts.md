# The core ending's art (the playability pass, 2026-11-08)

One PixelLab generation (of the 12 allowed for this task; never SpriteCook, never USD credits).

- `raw/city_pixellab.png` (112x96): `create_image_pixflux`, side view, single colour black outline,
  medium shading, highly detailed, transparent, its palette forced to the 48 most used colours of
  `src/art/title_scene.png` (an 8x6 palette PNG), so it sits in the key art it lifts off from.
  Prompt: "a floating sky city lifting off: a round stone and brass platform with small white houses
  with orange tiled roofs and three tall teal spires with gold tips, four brass propeller rotors
  underneath, puffs of white cloud under it, side view, cozy fantasy pixel art".
- `build.py` cleans it by rule (the cloud puffs and their cool shading under the rim cut, stray
  outline pixels removed, cropped to 68x86) and writes `src/art/finale_city.png` with its rotor tips
  in the sidecar; the finale (`src/app/finale.ts`) spins a blade on each tip and draws its own
  puffs. Drawn at the key art's own whole scale, never smoothed.
