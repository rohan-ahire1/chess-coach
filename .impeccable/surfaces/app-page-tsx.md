---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/play/page.tsx"]
---

## Direction contract

THESIS: A chess game is a chart-recorder strip. The evaluation is one continuous ink trace, and the reader finds the moment it fell. This refuses the category default of a sidebar dashboard wrapped around a Chess.com style review panel; the strip is the navigation, the board answers to it.

OWN-WORLD: Saturated salmon chart paper with a red 8px/40px grid. Three inks and nothing else: thermal black for everything the engine measured, ballpoint blue for everything the coach says, highlighter yellow for "you are here". Signal red only on blunders and the falling segment of the trace. Board in paper white and brick pink. Heavy condensed Archivo headings, Archivo text with tabular figures, a real ballpoint hand for short margin notes only. Hairline ink rules; no cards, pills, tiles, or soft shadows.

STORY: A club player sees their own kind of game read like a chart, understands that one move decided it, believes the numbers because the method is printed, and types a username. After analysis they open one strip, scrub to the fall, read the coach's plain words, then solve that position themselves.

FIRST VIEWPORT: Full-bleed salmon grid. Left five columns: headline at display scale, one sentence, then platform switch, username field and primary button, all above the fold. Right seven columns: the real board at about 62vh. A full-bleed trace runs under both along the viewport bottom, printing left to right while the board replays the same sample game in sync; it stops at the blunder, a blue pen circle draws around the fall, and the best-move arrow draws on the board. Hovering or dragging the strip scrubs the board.

Signature interaction: the strip scrub. Dragging along a trace replays the game on the board, piece by piece, with a printhead cursor reading the move and the chances. Everywhere a game appears, it is a strip, and every strip scrubs.

Motion grammar: paper feed and pen. Traces print left to right at constant speed. Pen marks and arrows draw on with stroke-dashoffset. Pieces glide on a fast exponential ease with duration scaled by distance. Numbers print in place and never count up. No bounce and no fade-up entrances.

Raises kept from the challengers:
- Orienteering map raise: one overprint colour reserved for the route. Turning points carry blue numbered circles in reading order, and only the coach's blue may use that treatment.
- Japanese high-density raise: the report shows every game as a dense row at once, with no padded containers.
- Crouwel grid raise: every layout measure is a multiple of the 8px chart box, and the strip's vertical scale is literal, one small box is 5% chances.
- Terminal wayfinding raise: highlighter yellow is the only "you are here" signal across board, scoresheet and strip.
- Split-flap raise: state changes are discrete and mechanical; numbers change in place.
- Character goods raise: each strip is a labelled object carrying its own result, opponent and date.

Colour strategy: committed. Salmon carries the surface on Persuade and tints every Operate surface; Operate surfaces drop to a paler pink so the task leads, never to cream. Physical scene: a player at a kitchen table right after a bad session, unrolling a pink chart strip of the game under the overhead light, with a pen in hand. That scene is lit and on paper, so the product is light.

Modes: landing is Persuade. Analysis, report, game review, drill and play are Operate. Method is Read.

FORM: Chart-recorder strip, position 7 of 7 on my ordered list (Informant book, scoresheet, broadcast overlay, clock hardware, club room, Swiss 64 grid, chart recorder). Challengers all declined: orienteering map, Japanese high-density web, character goods catalog, Crouwel grid specimen, terminal yellow wayfinding, split-flap concourse. Seed key 0a3a8b88. Code-led; no image generation in this harness.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
