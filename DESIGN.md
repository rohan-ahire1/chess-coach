---
name: Coachmate
description: A chess game read as one ink trace on pink chart paper.
colors:
  salmon: "#f4b8a8"
  paper: "#fbe9e3"
  paper-lift: "#fdf3ee"
  grid: "rgb(226 102 76)"
  ink: "oklch(21% 0.01 40)"
  ink-2: "oklch(38% 0.02 30)"
  rule: "oklch(21% 0.01 40 / 0.22)"
  blue: "oklch(42% 0.17 262)"
  marker: "#ffe033"
  red: "oklch(52% 0.2 28)"
  board-light: "#fdf3ee"
  board-dark: "#d9796a"
  board-coord: "#b24e3b"
typography:
  display:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(2.75rem, 5.4vw, 5.75rem)"
    fontWeight: 800
    lineHeight: 0.96
    letterSpacing: "-0.015em"
    fontVariation: "wdth 72"
  headline:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(2.25rem, 4.4vw, 4rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "wdth 72"
  page-title:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "wdth 72"
  title:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(2rem, 3.6vw, 3rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "wdth 72"
  move:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: "40px"
    fontVariation: "wdth 72"
  figure:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: "24px"
    fontVariation: "wdth 75"
    fontFeature: "tnum"
  coach-read:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "32px"
  coach-note:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "28px"
  body:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  button:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.5
  machine:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "24px"
    fontFeature: "tnum"
  ruler:
    fontFamily: "Archivo, Arial Narrow, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "24px"
    fontFeature: "tnum"
  hand:
    fontFamily: "Reenie Beanie, Bradley Hand, cursive"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: "32px"
rounded:
  none: "0"
  pen: "50%"
spacing:
  half: "4px"
  box: "8px"
  box-2: "16px"
  box-3: "24px"
  box-4: "32px"
  box-5: "40px"
  box-6: "48px"
  box-8: "64px"
  box-12: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-text:
    textColor: "{colors.ink}"
  input-field:
    backgroundColor: "{colors.paper-lift}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "48px"
  nav-current:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.ink}"
    padding: "0 4px"
  strip-plot:
    backgroundColor: "{colors.salmon}"
    textColor: "{colors.ink}"
    height: "160px"
  strip-plot-mini:
    backgroundColor: "{colors.salmon}"
    textColor: "{colors.ink}"
    height: "48px"
  strip-readout:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "0 8px"
    height: "24px"
  game-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "72px"
  scoresheet-current:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.ink}"
    padding: "0 4px"
  coach-note:
    textColor: "{colors.blue}"
    typography: "{typography.coach-note}"
  turn-number:
    textColor: "{colors.blue}"
    rounded: "{rounded.pen}"
    size: "28px"
---

# Design System: Coachmate

## Overview

**Creative North Star: "The Chart Recorder Strip"**

Coachmate draws every chess game as a strip of chart paper. The player's chances print from left to right as one ink line, and the reader's job is to find where that line fell. The strip is how you move through a game. The board follows it.

The material is a roll of saturated salmon paper under a kitchen light, marked up with a pen. The surface is printed and flat, with one continuous thread of data and short notes written in its margin. Density comes from showing every game at once as a labelled row. Ruled lines divide the page, so nothing needs a box around it.

Colour is committed. Salmon carries the landing page, and every working screen sits on a paler pink so the task leads. The system is light only, because the scene it comes from is lit paper. It must never read as a SaaS dashboard or as a copy of Chess.com's Game Review.

**Key Characteristics:**
- A game always appears as a strip, with a literal vertical scale.
- Three inks with fixed jobs, plus signal red for the fall.
- Heavy condensed Archivo headings over tabular Archivo text.
- Hairline ink rules with sharp corners and no raised surfaces.
- Motion that feeds paper and draws pen lines.

## Colors

A saturated pink paper family carries the surface, and four inks write on it, each with one job.

### Primary
- **Chart Salmon** (#f4b8a8): the landing hero, the privacy band and the plot of every strip. It is also the browser theme colour.
- **Chart Grid Red** (rgb(226 102 76)): the printed grid. Used as a transparent line on salmon only, at 0.07 and 0.18 on chart paper and at 0.2 and 0.42 inside a strip plot.

### Secondary
- **Ballpoint Blue** (oklch(42% 0.17 262)): the coach. Coach notes, the coach's read, handwriting, numbered turning points, pen rings around the fall and the best-move arrow.

### Tertiary
- **Highlighter Yellow** (#ffe033): "you are here". The last move on the board, the current scoresheet move, the printhead band on the strip, the running clock, the current nav item, the selected option and the game being read.
- **Signal Red** (oklch(52% 0.2 28)): blunders and the falling trace. The ?? glyph and count, the blunder badge on the board, the fall segment of a strip and the falling stroke of the logo. On salmon, small red text uses `--red-on-salmon` (oklch(46% 0.18 28)), which reaches 4.57:1. On the black footer, the logo's fall is salmon, because red only reaches 2.91:1 there.

### Neutral
- **Thermal Black** (oklch(21% 0.01 40)): the engine. The trace, the printhead, chances, accuracy and every measured figure. It also prints the interface around them, including headings, body text, buttons and rules.
- **Faded Thermal** (oklch(38% 0.02 30)): secondary print such as dates, ratings, ruler numbers and move numbers.
- **Hairline** (oklch(21% 0.01 40 / 0.22)): row dividers inside a ruled list.
- **Operate Pink** (#fbe9e3): the ground of report, review, drill, play and method.
- **Lifted Paper** (#fdf3ee): input fills, row and move hover, and the promotion picker.
- **Board Paper** (#fdf3ee) and **Board Brick** (#d9796a): the light and dark squares. Coordinates on light squares use **Board Coordinate** (#b24e3b), and coordinates on dark squares use Thermal Black.

### Named Rules

**The Three Inks Rule.** Thermal black is the engine, ballpoint blue is the coach and highlighter yellow is "you are here". A new element takes an ink by who is speaking, and a colour is never added for variety. Blue has one mechanical exception: the focus ring, the text caret and the keyboard cursor on the board are the pen in the user's hand.

**The Fall Rule.** Signal red appears only on blunders and the falling trace. Errors, warnings, destructive actions and low clocks do not get red. A low clock inverts to a thermal black block.

**The No Paler Rule.** The Operate ground is #fbe9e3 and must go no paler. Below that the page turns to cream and the world is gone. Lifted Paper is a fill for small parts inside a screen and never a page ground.

## Typography

**Display Font:** Archivo variable, width axis (with Arial Narrow, Arial, sans-serif)
**Body Font:** Archivo (same stack)
**Label/Mono Font:** Reenie Beanie (with Bradley Hand, cursive) for handwriting. `ui-monospace, Menlo, monospace` appears only for the formulas on the method page.

**Character:** Archivo squeezed to 72% width at weight 800 reads like the header printed on a chart roll. Reenie Beanie is a real ballpoint hand, and it reads as someone marking that roll.

### Hierarchy
- **Display** (800, clamp(2.75rem, 5.4vw, 5.75rem), 0.96): the landing headline only.
- **Headline** (800, clamp(2.25rem, 4.4vw, 4rem), 1): landing section headings.
- **Page title** (800, clamp(2.5rem, 6vw, 4.5rem), 1): method and empty states. The report title uses the same ceiling at 5vw.
- **Title** (800, clamp(2rem, 3.6vw, 3rem), 1): drill, play and setup headings, and the habit section.
- **Move** (800, 72% width, 32px/40px): the current move in the review note.
- **Figure** (800, 75% width, 20px/24px): results, accuracy and bot level numbers.
- **Coach read** (400, 20px/32px, max 70ch): the coach's read on the report, in blue.
- **Coach note** (400, 18px/28px, max 62ch): move notes and feedback, in blue.
- **Body** (400, 16px, 1.5): default text. Long reading on the method page runs 18px/30px.
- **Machine** (400, 14px/24px): engine readouts and print lines, set as wrapping spans.
- **Ruler** (400, 12px/24px): move numbers under a strip.
- **Hand** (Reenie Beanie 400, 32px/32px, rotated -2deg, blue): short margin notes.

### Named Rules

**The Print Figure Rule.** All text sets tabular figures from the body down, so numbers hold their columns and change in place.

**The Margin Note Rule.** The hand is for a few words written in the margin, such as "it turned here" or "nice". It is always blue and never carries instructions or sentences.

## Layout

Everything sits on the chart box. The base unit is 8px, a bold grid line falls every 40px on chart paper, and layout measures come in multiples of 8px. A 4px half step is allowed for the inline inset of a highlight and for tight optical gaps. The board width snaps down to a multiple of 8px, and on small screens the gutter absorbs the slack so every edge lines up with it.

The landing page and report habit section use a 12-column grid with a 24px gap and a 32px gutter inside a 1600px maximum. The top bar is 56px. Sections are separated by 96px of padding and a full ink rule, dropping to 64px on small screens.

The working screens share a board column and a working column. The board size comes from the viewport height so the whole board stays visible. Review adds a 224px scoresheet and runs the strip under the note and the scoresheet.

Reports list every game at once as 72px ruled rows, with no padding wrappers. At 860px and below the gutter drops to about 16px, rows restack with the strip at full width, and review stacks board, strip, note and sheet with the transport fixed to the bottom edge at 56px. The strip also shrinks on short viewports under 840px tall, keeping its scale.

### Named Rules

**The Box Rule.** Every layout measure is a multiple of 8px. Inline half steps, text leading and pen marks sit outside it.

**The Literal Scale Rule.** One small box on a strip equals 5% chances, and a strip plot is always 20 × `--s-box` tall. The bold line sits at 50%, and a heavier grid line falls every five boxes. Change the size only by changing `--s-box` and `--s-height` together. The shipped pairs are 8px and 160px, 6px and 120px, 5.6px and 112px, and 2.4px and 48px.

## Elevation & Depth

The system is flat. Depth comes from paper colour, ink rules and printed blocks. Nothing floats. Only the sticky top bar, the fixed mobile transport and the promotion picker sit above other content. The promotion picker uses a flat scrim of thermal black at 0.4.

### Shadow Vocabulary
- **Inset rule** (`box-shadow: inset 0 1px 0 var(--ink), inset 0 -1px 0 var(--ink)`): the top and bottom edges of a strip plot. It draws a line over the background grid and has no blur or offset.
- **Inset outline** (`box-shadow: inset 0 0 0 1px var(--ink)`): the promotion buttons.

### Named Rules

**The Flat Paper Rule.** Blur is never used for depth. If an element needs separating, give it a hairline ink rule or a change of paper.

## Shapes

Corners are square at 0 on every button, field, block, row and badge. The only round forms are pen marks: hand-drawn rings around the fall, numbered turning points and the small mini-strip rings. Line joins on the logo and icons are mitred. The strip trace alone is drawn with round joins, like a pen on paper.

Structure comes from rules. Full ink at 1px marks the top and bottom of a list, Hairline divides rows, and controls carry a 1.5px ink border. Filled black blocks with paper text are native to the world: the strip readout, the low clock and the closing landing band with the footer are printed black on the same roll, and they do not make a dark theme.

## Components

### Buttons
- **Shape:** square corners (0), 48px minimum height, 24px inline padding, 1.5px ink border.
- **Primary:** thermal black fill with paper text.
- **Secondary:** transparent with an ink border. Hover inverts to black fill and paper text over 80ms linear.
- **Press:** moves down 1px. Disabled sits at 0.45 opacity.
- **Text button:** 15px at weight 600, underlined at 1px, thickening to 2px on hover.
- **Primary hover:** fades from thermal black to `--ink-2`. On the black band, a secondary button inverts to paper. Hover never takes blue or yellow.

### Inputs / Fields
- **Style:** 48px tall, square, 1.5px ink border, Lifted Paper fill, Faded Thermal placeholder.
- **Joined row:** the field and its button share a border by overlapping 1.5px. Below 860px they stack.
- **Selects:** underlined with a 1px ink rule on a transparent ground, with a small drawn caret.
- **Choice groups:** platform and setup options are plain ruled text. The chosen option gets a highlighter swipe behind its words.
- **Focus:** 2px blue outline at 2px offset, everywhere.

### Navigation
- **Style:** 56px sticky bar on paper with a 1px ink rule. On the hero it goes transparent over the chart.
- **Links:** 15px at weight 600. The current page gets a highlighter swipe and hover gets an underline.
- **Mobile:** the player name hides below 860px and the wordmark drops to the logo below 360px.

### Strip
The signature object, drawn by one component everywhere a game appears. A full strip has a 24px rail above the plot for judgement glyphs and the black printhead readout, and a 24px ruler below it for move numbers. The plot holds a 1.75px black trace, a 3px red segment for each of the player's mistakes and blunders, a yellow band and a 1.5px black head at the current position, and blue numbered pen rings at turning points in reading order. The largest fall can take one large ring that stretches to its height.

A full strip scrubs by drag, by hover on the landing page, and by arrow, Page and Home/End keys, and it is exposed as a slider. A mini strip is 48px with a five-box line only and small blue rings at turning points. In a report row it scrubs on hover and writes the readout into the row's text. A strip for a game still being read prints live as the engine works.

**The No Future Rule.** The drill strip does not scrub. Scrubbing would show moves played after the position the player is solving. It sits at that position as a fixed mark, with a link out to the game for anyone who wants to see the rest.

### Board
Our own board, with stable piece identity so pieces slide. The last move is a highlighter square at 0.86 opacity, legal targets are thin ink dots and rings at 0.3, and check is an 8-unit ink outline inside the square. Pieces lift to 1.14 while dragged. A square badge sits at the top right of the destination square: red with white text for a blunder, black with white text for a mistake, and Lifted Paper with an ink stroke for an inaccuracy. Best-move arrows and hint squares are blue because the coach is pointing. Knight arrows turn at a true right angle. Quality is always carried by a glyph as well as a colour.

### Game Row
A labelled object with no container: result, opponent and rating, opening and details, mini strip, accuracy, and glyph counts, on one 72px ruled line. Hover lifts the row to Lifted Paper, and the whole row is a link. Below 860px it restacks with the strip at full width.

### Scoresheet
Ruled 32px rows of move number, white and black. The current move gets a yellow fill and weight 700, and the list keeps it in view. Six square transport buttons sit below it at 40px, using stroke icons drawn in `app/Icon.tsx`.

### Coach Voice
Blue text with no box, border or avatar. Notes sit directly on the paper next to black machine lines, so the two voices read by ink alone. Turning points on the review note repeat the strip's number in a 28px blue circle, and only coach blue may use that treatment.

### Print Lines
Wrapping spans of real data in machine type, with gaps doing the work of separators. They carry figures from the engine and the game, and nothing invented.

### Motion
Motion is paper feed and pen. Traces print left to right at constant speed: the landing strip reveals one ply every 360ms on a linear clip. Pen rings draw on over 420ms and arrows over 180ms with `stroke-dashoffset`. Pieces glide on `cubic-bezier(0.16, 1, 0.3, 1)` for 120 to 260ms scaled by distance, and 90ms while scrubbing. A captured piece clears in 110ms. Button colour swaps take 80ms.

**The Feed And Pen Rule.** Paper feeds, pens draw and pieces slide. Numbers change in place and never count up, and nothing bounces or fades up on entry.

Reduced motion is honoured. With `prefers-reduced-motion: reduce`, the landing strip opens already printed to the fall, pen marks and arrows appear finished, pieces move instantly and buttons stop shifting.

### Credits And Sample Labels
Stockfish 19 lite is GPLv3 and lives in `public/engine/` with its licence at `public/engine/COPYING.txt`. The method page links that licence and the landing footer credits it. The Cburnett pieces are credited there as GPLv2+.

Sample data is always labelled as bot games. The hero says so under the strip, the sample report carries "Sample report, bot games" under its title, and sample games name their opponents as bots.

## Do's and Don'ts

### Do:
- **Do** choose an ink by who is speaking: thermal black for the engine, ballpoint blue for the coach, highlighter yellow for "you are here".
- **Do** draw every game with the shared strip and keep one small box equal to 5% chances, with the plot 20 × `--s-box` tall.
- **Do** keep every Operate surface on #fbe9e3 or deeper.
- **Do** separate content with 1px ink rules and Hairline dividers, with layout measures in multiples of 8px.
- **Do** show highlighter yellow behind the words or square it marks, as a flat swipe.
- **Do** pair every quality colour with its glyph, since move quality is never carried by colour alone.
- **Do** make state changes discrete, with numbers changing in place.
- **Do** give every new animation a `prefers-reduced-motion` state that shows the finished result.
- **Do** label sample data as bot games wherever it appears.
- **Do** keep Stockfish's GPLv3 licence and credit with `public/engine/`.

### Don't:
- **Don't** use cards, pills, tiles or soft shadows.
- **Don't** add a dark theme. Black printed blocks and the closing landing band are part of the light paper world.
- **Don't** use signal red for errors, warnings, destructive actions or decoration. It belongs to blunders and the falling trace.
- **Don't** use yellow for hover or emphasis, or blue for general links and accents.
- **Don't** let a drill strip scrub, because it would show moves played after the position being solved.
- **Don't** go paler than #fbe9e3 for a page ground, and don't let it drift to cream or white.
- **Don't** resize a strip by height alone, since that breaks the literal scale.
- **Don't** animate figures counting up, or add bounce or fade-up entrances.
- **Don't** put the hand in sentences, instructions or any colour but blue.
- **Don't** invent stats, Elo ranges or speed claims to fill a print line.
