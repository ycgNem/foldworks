// Cosmetics (DESIGN.md §24, Milestone 11): machine skins and decorations, all in one list. A skin is
// earned (the Endless Ledger's every tenth order, a customer's reputation, a Challenge won, a
// trophy) and kept for good in `meta.cosmetics`; the player picks one per kind of building with
// the `skin` command (`meta.skins[kind]`). Purely cosmetic: no system reads the choice. The art is
// `skin_<id>_<kind>` sprite sheets (src/art/, drawn later), in place of `<kind>` when chosen; a
// decoration is a skin of the Dock or the Hopper. The Ledger's numbered ribbons (`ribbon<n>`, after
// its three skins) are made on the fly by `cosmeticDef`, so there is always a next one.
import type { EntKind } from './machines';
import type { CustomerId } from './orders';
import type { ChallengeId } from './challenges';
import { LEDGER_COSMETICS } from './kernels';

/** What a skin dresses: a Workshop building, a module (every floor of modules), or a high floor's
 * skiffs (the District), barges (the World) and couriers (Beyond). */
export type SkinSlot = EntKind | 'module' | 'skiff' | 'barge' | 'courier';

export type CosmeticSource =
  | { k: 'ledger'; n: number }
  | { k: 'rep'; customer: CustomerId; level: number }
  | { k: 'challenge'; id: ChallengeId }
  | { k: 'trophy'; id: string };

export interface CosmeticDef {
  id: string;
  name: string;
  /** the kinds it dresses (one choice per kind) */
  slots: SkinSlot[];
  source: CosmeticSource;
  /** a decoration (on the Dock or Hopper) rather than a machine's skin */
  decoration?: boolean;
  flavor: string;
}

const S = (id: string, name: string, slots: SkinSlot[], source: CosmeticSource, flavor: string, decoration = false): CosmeticDef => ({ id, name, slots, source, flavor, ...(decoration ? { decoration } : {}) });

export const COSMETICS: CosmeticDef[] = [
  // the Endless Ledger (DESIGN.md §23): its every tenth order, the three skins in turn
  S('gilded', 'Gilded', ['miner'], { k: 'ledger', n: 10 }, 'A Miner in gold leaf. It digs exactly as fast. It feels faster.'),
  S('candy', 'Candy Stripe', ['press', 'pressMk2'], { k: 'ledger', n: 20 }, 'Red and white, like a barber\'s pole or a very serious sweet.'),
  S('starlit', 'Starlit', ['assembler', 'assemblerMk2'], { k: 'ledger', n: 30 }, 'Painted with the night sky over the cloud sea. The stars are to scale.'),
  // reputation: each customer's own skin at rep 3 and rep 5
  S('lilypad', 'Lily Pad', ['heap'], { k: 'rep', customer: 'bramble', level: 3 }, 'A Slag Heap on a lily pad. Bramble insists it is a water feature.'),
  S('mayoral', 'Mayoral Sash', ['dock'], { k: 'rep', customer: 'bramble', level: 5 }, 'The Dock wears the chain of office on market days.', true),
  S('chrome', 'Chrome', ['smelter', 'smelterMk2'], { k: 'rep', customer: 'unit7', level: 3 }, 'UNIT 7 POLISHED IT. UNIT 7 CAN SEE ITSELF IN IT. HELLO.'),
  S('specimen', 'Specimen Jar', ['hopper'], { k: 'rep', customer: 'unit7', level: 5 }, 'A Hopper with a label: CONTENTS: EVERYTHING, EVENTUALLY.', true),
  S('filigree', 'Filigree', ['steamEngine', 'generator'], { k: 'rep', customer: 'voltaire', level: 3 }, 'Brass curls on every pipe, darling. Power should look expensive.'),
  S('arcLight', 'Arc Light', ['pole'], { k: 'rep', customer: 'voltaire', level: 5 }, 'Poles that crackle a little at dusk. On purpose, mostly.'),
  S('trenchcoat', 'Trench Coat', ['crate'], { k: 'rep', customer: 'committee', level: 3 }, 'A Buffer Crate in a coat. Nobody asks what is in it.'),
  S('contraband', 'Contraband', ['splitter', 'merger'], { k: 'rep', customer: 'committee', level: 5 }, 'Unmarked, unpainted, and somehow always facing the right way.'),
  // Challenges (DESIGN.md §21, §24): each its own, for the kind of building it was about
  S('straightArrow', 'Straight Arrow', ['belt'], { k: 'challenge', id: 'noSplitters' }, 'Belts with a ruler painted down the middle.'),
  S('mittens', 'Mittens', ['furnace'], { k: 'challenge', id: 'handsOff' }, 'The Hand Furnace in knitted mittens. Hands off, but warm.'),
  S('thrifty', 'Thrifty', ['boiler'], { k: 'challenge', id: 'leanPower' }, 'A patched Boiler that has never wasted a lump.'),
  S('triad', 'Triad', ['module'], { k: 'challenge', id: 'threeKinds' }, 'Three stripes on every module: a frog, a press and a furnace.'),
  S('pocketSquare', 'Pocket Square', ['module'], { k: 'challenge', id: 'smallBoxes' }, 'A module with a folded handkerchief in its top pocket. Neat.'),
  S('spotless', 'Spotless', ['mixer'], { k: 'challenge', id: 'cleanHands' }, 'A Mixer so clean you could eat concrete off it. Please do not.'),
  S('vintage', 'Vintage', ['smelter', 'press', 'assembler'], { k: 'challenge', id: 'mk1Only' }, 'Riveted, dented, beloved. They made them to last.'),
  S('whittled', 'Whittled', ['module'], { k: 'challenge', id: 'handMade' }, 'A module carved by hand, with the maker\'s initials on the bottom.'),
  S('goldLeaf', 'Gold Seal', ['module'], { k: 'challenge', id: 'strictInspector' }, 'The Inspector\'s own seal. It took some getting.'),
  S('brassBelt', 'Brass Belt', ['belt'], { k: 'challenge', id: 'beltBudget' }, 'Every tile counted, and polished.'),
  S('kite', 'Kite', ['skiff'], { k: 'challenge', id: 'headwinds' }, 'Skiffs with a kite sail. They like a headwind.'),
  S('tug', 'Tug', ['skiff'], { k: 'challenge', id: 'shortHaul' }, 'Stubby, strong, never far from home.'),
  S('blueprint', 'Blueprint', ['module'], { k: 'challenge', id: 'zoningFreeze' }, 'Modules in white lines on blue, like the plan they were.'),
  S('stormproof', 'Stormproof', ['barge'], { k: 'challenge', id: 'roughSeas' }, 'Barges with a tarpaulin and a stubborn captain.'),
  S('feather', 'Feather', ['barge'], { k: 'challenge', id: 'lightFleet' }, 'A barge so light it floats on the cloud sea\'s foam.'),
  // trophies (src/data/trophies.ts, bonus kind 'cosmetic')
  S('ember', 'Ember', ['furnace'], { k: 'trophy', id: 'warmHands' }, 'The first furnace, glowing a little brighter for the effort.'),
  S('mortarboard', 'Mortarboard', ['hopper'], { k: 'trophy', id: 'eureka' }, 'A Hopper in a graduation cap. It earned it.', true),
  S('bunting', 'Bunting', ['dock'], { k: 'trophy', id: 'brambleApproves' }, 'Flags along the Dock for the first order filled.', true),
  S('circuitry', 'Circuitry', ['assembler'], { k: 'trophy', id: 'thinkingWire' }, 'Green, with tiny gold tracks that go nowhere.'),
  S('pinstripe', 'Pinstripe', ['assemblerMk2'], { k: 'trophy', id: 'spinDoctor' }, 'A big Assembler in a sharp suit.'),
  S('origami', 'Origami', ['module'], { k: 'trophy', id: 'foldception' }, 'Modules creased like paper cranes. Folded, after all.'),
  S('postmark', 'Postmark', ['module'], { k: 'trophy', id: 'stampCollector' }, 'Every copy franked with the date it was stamped.'),
  S('drillbit', 'Drill Bit', ['miner'], { k: 'trophy', id: 'greatDrill' }, 'A Miner with a little Great Drill on its hat.'),
  S('apron', 'Apron', ['assemblerMk2'], { k: 'trophy', id: 'lunchIsServed' }, 'A chef\'s apron, a little mustard on it.'),
  S('tinfoil', 'Tinfoil', ['hopper'], { k: 'trophy', id: 'theyKnow' }, 'For a Hopper that has heard things.', true),
  S('ghostly', 'Ghostly', ['module'], { k: 'trophy', id: 'unit6' }, 'Pale, quiet modules. They were here before you.'),
  S('mirrorBall', 'Mirror Ball', ['courier'], { k: 'trophy', id: 'beyondBusy' }, 'Couriers that throw little lights across Beyond.'),
  S('sunburst', 'Sunburst', ['dock'], { k: 'trophy', id: 'smallSun' }, 'A Dock with a very small sun on its sign.', true),
  S('paperCrane', 'Paper Crane', ['skiff'], { k: 'trophy', id: 'skyFull' }, 'Skiffs folded from paper. They fly fine.'),
  S('seedling', 'Seedling', ['seed'], { k: 'trophy', id: 'secondUniverse' }, 'The Seed with a single green leaf.'),
];

const BY_ID: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

/** The Ledger's skins, in the order it pays them (one place: kernels.ts names them). */
export const LEDGER_SKINS: readonly string[] = LEDGER_COSMETICS;

/** A cosmetic by id: one of the list, or a Ledger ribbon (`ribbon<n>`: a decoration of the Dock). */
export function cosmeticDef(id: string): CosmeticDef | null {
  const d = BY_ID[id];
  if (d) return d;
  const m = /^ribbon(\d+)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n >= LEDGER_SKINS.length + 1)) return null;
  return { id, name: `Ribbon No. ${n}`, slots: ['dock'], source: { k: 'ledger', n: n * 10 }, decoration: true, flavor: `The Ledger's ${n}th ribbon, pinned to the Dock with the others.` };
}

/** Every slot a skin can be chosen for (the picker's rows). */
export const SKIN_SLOTS: SkinSlot[] = [...new Set(COSMETICS.flatMap((c) => c.slots).concat(['dock']))];

/** The sprite the art draws for a skin on a kind (src/art/, Milestone 11's art). */
export const skinSprite = (id: string, slot: SkinSlot) => `skin_${id}_${slot}`;
