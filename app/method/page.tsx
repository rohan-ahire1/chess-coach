import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Method",
  description: "How Coachmate turns a chess game into chances, accuracy and move labels. The formulas are public.",
};

export default function MethodPage() {
  return (
    <article className="page method">
      <h1>How a move earns its label.</h1>
      <p className="lede">
        Every number here comes from the engine, through formulas anyone can check. We use the method Lichess
        publishes, so a game should read close to its Lichess review.
      </p>

      <h2>The engine</h2>
      <p>
        Stockfish 19 runs inside your browser tab and looks 14 moves deep at every position in the game. A faster
        device finishes sooner, but it reaches the same depth and gets the same answer. One search per position is
        enough for most moves. When a move looks like a mistake, we search again after the best alternative at the
        same depth, because a forced move in a lost position shouldn&apos;t count against you.
      </p>

      <h2>Chances</h2>
      <p>The trace is your chance of winning. It comes from the engine score in centipawns, capped at 1000:</p>
      <pre>
        <code>chances = 50 + 50 × (2 / (1 + e^(−0.00368208 × cp)) − 1)</code>
      </pre>
      <p>
        Lichess fitted that curve to millions of real games. It matters because a pawn is worth far more in a level
        position than when you are already winning by a rook. On the strip, one small box is 5%.
      </p>

      <h2>Labels</h2>
      <p>A move&apos;s label depends on the chances it gave away:</p>
      <table>
        <tbody>
          <tr>
            <th scope="row">?! Inaccuracy</th>
            <td>5 points or more</td>
          </tr>
          <tr>
            <th scope="row">? Mistake</th>
            <td>10 points or more</td>
          </tr>
          <tr>
            <th scope="row">?? Blunder</th>
            <td>15 points or more</td>
          </tr>
        </tbody>
      </table>

      <h2>Accuracy</h2>
      <p>Each move scores out of 100 by how much it dropped:</p>
      <pre>
        <code>accuracy = 103.1668 × e^(−0.04354 × drop) − 3.1669 + 1</code>
      </pre>
      <p>
        A game&apos;s accuracy is the average of two means of those scores, one weighted by how sharp the position was
        and one harmonic, which keeps a single huge blunder from being averaged away.
      </p>

      <h2>The coach</h2>
      <p>
        When the AI coach is on, it gets your mistake counts and a few single moves with the engine&apos;s facts about
        them. It never gets a full game, your username or a link to your profile. It is told to use only those facts.
        If it&apos;s offline, the same notes are written by rule from the board, and they say so.
      </p>

      <h2>Sources</h2>
      <ul>
        <li>
          <a href="https://lichess.org/page/accuracy" target="_blank" rel="noreferrer">
            Lichess accuracy
          </a>
        </li>
        <li>
          <a href="https://github.com/lichess-org/lila/tree/master/modules/analyse" target="_blank" rel="noreferrer">
            Lichess analysis source code
          </a>
        </li>
        <li>
          <a href="https://stockfishchess.org" target="_blank" rel="noreferrer">
            Stockfish
          </a>
          , used under GPLv3. The license ships with the engine at{" "}
          <a href="/engine/COPYING.txt">/engine/COPYING.txt</a>.
        </li>
      </ul>

      <p>
        <Link className="btn btn-primary" href="/report">
          Read my games
        </Link>
      </p>
    </article>
  );
}
