// The Swamp Gazette: the news ticker's flavour headlines (pillar 5: the absurdity escalates). The
// app mixes these with headlines about the player's own factory (src/app/gazette.ts), so the
// ticker reports real jams, records and orders (DECISIONS.md: re-derived from Cookie Clicker's
// news ticker). Lines unlock as the game goes on: `after` names research that must be done.
import type { ResearchId } from './research';

export interface Headline { text: string; after?: ResearchId }

export const HEADLINES: Headline[] = [
  { text: 'Mayor Bramble declares Tuesday "Gizmo Day". Nobody knows what a Gizmo is.' },
  { text: 'Local heron files noise complaint about "relentless clanking".' },
  { text: 'Frog council votes 7-0 for a boardwalk. The frog council has one member.' },
  { text: 'Weather: humid. Tomorrow: humid. Outlook: swamp.' },
  { text: "Bramble's hat \"not stolen, merely misplaced\", says Bramble, wearing the hat." },
  { text: 'Belt technology is "the future", claims man standing on a belt.' },
  { text: 'Scientists confirm iron is heavier than optimism.' },
  { text: 'Dragonflies unionize, demand shorter hours and longer wings.' },
  { text: 'Inspector seen with clipboard. Residents nervous. Clipboard empty.' },
  { text: 'Opinion: why I am not worried about the Slag Heap. By the Slag Heap.' },
  { text: 'Duck seen near the Hopper. Duck denies everything.' },
  { text: 'Study: four in five frogs prefer plates to ingots. The fifth frog ate the survey.' },
  { text: 'Copper prices: shiny.' },
  { text: 'Hand Furnace reportedly "a bit dizzy" after record cranking session.' },
  { text: 'BREAKING: a line ran perfectly for a whole minute. Engineers suspicious.' },
  { text: 'Tadpole enrolment at the Iron Academy reaches an all-time high of three.' },
  { text: 'Lily pad prices soar on rumours of a Dock renovation.' },
  { text: 'Mysterious robot spotted collecting "one of everything". More at eleven.' },
  { text: 'Local snail completes the 3-tile belt commute. "Faster to walk," says snail.' },
  { text: 'Slag found in the reservoir. Experts: "it was always slag."' },
  { text: 'Swamp art critic calls the ore patch "lumpy, honest, a bit blue".' },
  { text: 'Gizmo shortage: residents asked to stop using Gizmos as doorstops.', after: 'gizmoTheory' },
  { text: 'Gizmo Festival tickets sell out. Nobody knows what happens at it.', after: 'gizmoTheory' },
  { text: 'Plate surplus: Bramble builds a second boardwalk next to the first, "for symmetry".', after: 'pressing' },
  { text: 'Wire found coiled in a sock drawer. Wire claims it "just likes it there".', after: 'wireDrawing' },
  { text: 'Gears now available in "toothy" and "very toothy".', after: 'gearcutting' },
  { text: 'Splitter seen being "very fair" about something. Onlookers moved.', after: 'splitters' },
  { text: 'Brick-built outhouse wins Swamp Architecture Prize. Material: entirely slag.', after: 'slagBricks' },
  { text: 'Rumour: whole production lines are being folded into single tiles. Physicists: "no".', after: 'folding' },
  { text: 'A folded factory weighs exactly as much as a tile, residents relieved to learn.', after: 'folding' },
  // Act II (DESIGN.md §18): the absurdity escalates
  { text: 'Coal found under the swamp. The swamp "always suspected".', after: 'coalSeams' },
  { text: 'Robot asks for "one of each". Shopkeepers baffled, then delighted, then out of stock.', after: 'coalSeams' },
  { text: 'UNIT 7 REPORTS COLLECTION 4% COMPLETE. UNIT 7 REPORTS THIS IS FINE.', after: 'coalSeams' },
  { text: 'Steel declared "iron, but confident". Iron declines to comment.', after: 'steelmaking' },
  { text: "Dame Voltaire buys the moon's reflection in the pond. 'For the lighting.'", after: 'steamPower' },
  { text: 'Brownout at the Workshop. Machines slow down politely, all at once.', after: 'steamPower' },
  { text: 'Heron complaint escalates: now about "the hum".', after: 'steamPower' },
  { text: 'Survey Office opens. First customer: a mole, asking "who said you could".', after: 'surveying' },
  { text: 'Glass so clear a frog walked into it twice. Frog: "worth it".', after: 'glassworks' },
  { text: 'Gravel: officially no longer slag. Slag: "I am still in here".', after: 'crushing' },
  { text: 'Circuits now think about wire full time. Wire flattered.', after: 'circuits' },
  { text: 'Machine overclocked to 1.5x. Machine asks for a raise.', after: 'tuning' },
  { text: 'Module of modules folded. Physicists now say "no, really, no".', after: 'nestedFolds' },
  { text: 'Plans for a drill "the size of the town" approved by the town, which will be moved.', after: 'greatDrill' },
];
