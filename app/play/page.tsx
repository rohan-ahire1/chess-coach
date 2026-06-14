"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Chess, type Square } from "chess.js";
import { Engine } from "@/lib/engine";

const Chessboard = dynamic(() => import("react-chessboard").then((m) => m.Chessboard), {
  ssr: false,
});

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type BoardArrow = [string, string, string?];
type Phase = "setup" | "playing" | "over";
type ColorChoice = "white" | "black" | "random";
type TcKey = "none" | "3+2" | "5+0" | "10+0";

const TCS: Record<TcKey, { label: string; base: number; inc: number }> = {
  none: { label: "No clock", base: 0, inc: 0 },
  "3+2": { label: "3 + 2", base: 180_000, inc: 2_000 },
  "5+0": { label: "5 + 0", base: 300_000, inc: 0 },
  "10+0": { label: "10 + 0", base: 600_000, inc: 0 },
};

const LAST_MOVE_COLOR = "#9a8f7d";
const HINT_COLOR = "#c98a2b";

function eloLabel(elo: number): string {
  if (elo <= 800) return "Beginner";
  if (elo <= 1200) return "Casual";
  if (elo <= 1600) return "Intermediate";
  if (elo <= 2000) return "Advanced";
  if (elo <= 2400) return "Expert";
  return "Master";
}

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function PlayPage() {
  // Config
  const [elo, setElo] = useState(1200);
  const [colorChoice, setColorChoice] = useState<ColorChoice>("white");
  const [tcKey, setTcKey] = useState<TcKey>("none");

  // Game
  const gameRef = useRef(new Chess());
  const engineRef = useRef<Engine | null>(null);
  const endedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [fen, setFen] = useState(START_FEN);
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<BoardArrow | null>(null);
  const [hint, setHint] = useState<BoardArrow | null>(null);
  const [whiteMs, setWhiteMs] = useState(0);
  const [blackMs, setBlackMs] = useState(0);

  // Responsive board sizing
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [boardW, setBoardW] = useState(360);
  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth;
      const h = wrapRef.current?.clientHeight;
      if (!w) return;
      const maxByHeight = h ? Math.max(240, h - 130) : Math.max(240, window.innerHeight - 320);
      setBoardW(Math.max(240, Math.min(w - 44, maxByHeight, 1040)));
    };
    measure();
    const t = setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [phase]);

  useEffect(() => () => engineRef.current?.terminate(), []);

  const botColor: "w" | "b" = playerColor === "w" ? "b" : "w";

  function addIncrement(color: "w" | "b") {
    const inc = TCS[tcKey].inc;
    if (!inc) return;
    if (color === "w") setWhiteMs((m) => m + inc);
    else setBlackMs((m) => m + inc);
  }

  function endGame(message: string) {
    endedRef.current = true;
    setResult(message);
    setStatus("");
    setThinking(false);
    setPhase("over");
  }

  function checkOver(): boolean {
    const g = gameRef.current;
    if (!g.isGameOver()) return false;
    let msg = "Game over.";
    if (g.isCheckmate()) {
      const loser = g.turn(); // side to move has been mated
      msg = loser === playerColor ? "Checkmate — you lose." : "Checkmate — you win! 🎉";
    } else if (g.isStalemate()) msg = "Stalemate — it's a draw.";
    else if (g.isThreefoldRepetition()) msg = "Draw by repetition.";
    else if (g.isInsufficientMaterial()) msg = "Draw — insufficient material.";
    else if (g.isDraw()) msg = "Draw (50-move rule).";
    endGame(msg);
    return true;
  }

  async function botMove() {
    const eng = engineRef.current;
    if (!eng || endedRef.current) return;
    setThinking(true);
    setStatus("Bot is thinking…");
    const { bestMove } = await eng.bestMove(gameRef.current.fen());
    if (endedRef.current) return;
    if (bestMove) {
      const from = bestMove.slice(0, 2);
      const to = bestMove.slice(2, 4);
      const promotion = bestMove.slice(4, 5) || "q";
      try {
        gameRef.current.move({ from, to, promotion });
      } catch {
        /* engine move should always be legal */
      }
      setFen(gameRef.current.fen());
      setHistory(gameRef.current.history());
      setLastMove([from, to, LAST_MOVE_COLOR]);
      addIncrement(botColor);
    }
    setThinking(false);
    if (!checkOver()) setStatus("Your move.");
  }

  function onDrop(source: Square, target: Square): boolean {
    if (phase !== "playing" || thinking) return false;
    if (gameRef.current.turn() !== playerColor) return false;
    let move;
    try {
      move = gameRef.current.move({ from: source, to: target, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;
    setFen(gameRef.current.fen());
    setHistory(gameRef.current.history());
    setLastMove([source, target, LAST_MOVE_COLOR]);
    setHint(null);
    addIncrement(playerColor);
    if (checkOver()) return true;
    setStatus("Bot is thinking…");
    window.setTimeout(botMove, 150);
    return true;
  }

  async function startGame() {
    const color: "w" | "b" =
      colorChoice === "random" ? (Math.random() < 0.5 ? "w" : "b") : colorChoice === "white" ? "w" : "b";
    const g = new Chess();
    gameRef.current = g;
    endedRef.current = false;
    setPlayerColor(color);
    setOrientation(color === "w" ? "white" : "black");
    setFen(g.fen());
    setHistory([]);
    setResult(null);
    setHint(null);
    setLastMove(null);
    setWhiteMs(TCS[tcKey].base);
    setBlackMs(TCS[tcKey].base);

    if (!engineRef.current) {
      engineRef.current = new Engine();
      await engineRef.current.init();
    }
    await engineRef.current.setStrength(elo);

    setPhase("playing");
    if (color === "b") {
      setStatus("Bot is thinking…");
      window.setTimeout(botMove, 300);
    } else {
      setStatus("Your move.");
    }
  }

  async function showHint() {
    if (phase !== "playing" || thinking || gameRef.current.turn() !== playerColor) return;
    setStatus("Finding a hint…");
    const { bestMove } = await engineRef.current!.suggest(gameRef.current.fen());
    if (bestMove) setHint([bestMove.slice(0, 2), bestMove.slice(2, 4), HINT_COLOR]);
    setStatus("Your move.");
  }

  function takeback() {
    if (thinking || phase === "setup") return;
    const g = gameRef.current;
    g.undo(); // bot's reply
    g.undo(); // your move
    endedRef.current = false;
    setFen(g.fen());
    setHistory(g.history());
    setLastMove(null);
    setHint(null);
    setResult(null);
    setPhase("playing");
    setStatus("Your move.");
  }

  function resign() {
    if (phase !== "playing") return;
    endGame("You resigned — bot wins.");
  }

  function newGame() {
    endedRef.current = true;
    setPhase("setup");
    setResult(null);
    setHint(null);
    setLastMove(null);
    setStatus("");
    setFen(START_FEN);
    setHistory([]);
  }

  // Clock tick
  useEffect(() => {
    if (phase !== "playing" || tcKey === "none") return;
    const id = setInterval(() => {
      const turn = gameRef.current.turn();
      if (turn === "w") setWhiteMs((m) => Math.max(0, m - 100));
      else setBlackMs((m) => Math.max(0, m - 100));
    }, 100);
    return () => clearInterval(id);
  }, [phase, tcKey]);

  // Flag fall
  useEffect(() => {
    if (phase !== "playing" || tcKey === "none" || endedRef.current) return;
    if (whiteMs <= 0)
      endGame(playerColor === "w" ? "You lost on time." : "Bot flagged — you win!");
    else if (blackMs <= 0)
      endGame(playerColor === "b" ? "You lost on time." : "Bot flagged — you win!");
  }, [whiteMs, blackMs, phase, tcKey, playerColor]);

  const arrows: BoardArrow[] = [hint, lastMove].filter(Boolean) as BoardArrow[];
  const draggable = phase === "playing" && !thinking && gameRef.current.turn() === playerColor;
  const topClockMs = orientation === "white" ? blackMs : whiteMs;
  const bottomClockMs = orientation === "white" ? whiteMs : blackMs;
  const topIsPlayer = (orientation === "white" ? "b" : "w") === playerColor;

  const Clock = ({ ms, who, active }: { ms: number; who: string; active: boolean }) => (
    <div className={`clock${active ? " active" : ""}`}>
      <span className="clock-who">{who}</span>
      <strong className="clock-time">{fmtClock(ms)}</strong>
    </div>
  );

  return (
    <main className="wrap">
      <div className="play-layout">
        <div className="area-board">
          <div className="card board-card" ref={wrapRef}>
            {tcKey !== "none" && phase !== "setup" && (
              <Clock
                ms={topClockMs}
                who={topIsPlayer ? "You" : "Bot"}
                active={gameRef.current.turn() === (orientation === "white" ? "b" : "w") && phase === "playing"}
              />
            )}
            <Chessboard
              position={fen}
              boardWidth={boardW}
              boardOrientation={orientation}
              arePiecesDraggable={draggable}
              onPieceDrop={(s, t) => onDrop(s as Square, t as Square)}
              customArrows={arrows as any}
              customBoardStyle={{ borderRadius: "10px", boxShadow: "none" }}
              customDarkSquareStyle={{ backgroundColor: "#b7c4ba" }}
              customLightSquareStyle={{ backgroundColor: "#eef1ec" }}
            />
            {tcKey !== "none" && phase !== "setup" && (
              <Clock
                ms={bottomClockMs}
                who={topIsPlayer ? "Bot" : "You"}
                active={gameRef.current.turn() === (orientation === "white" ? "w" : "b") && phase === "playing"}
              />
            )}
          </div>
        </div>

        <div className="area-side">
          {phase === "setup" ? (
            <div className="card">
              <p className="card-eyebrow">New game</p>
              <h2 className="section-title">Play the bot</h2>

              <label className="play-label" htmlFor="elo">
                Bot strength
                <span className="play-elo">
                  ~{elo} · {eloLabel(elo)}
                </span>
              </label>
              <input
                id="elo"
                className="play-slider"
                type="range"
                min={600}
                max={2600}
                step={50}
                value={elo}
                onChange={(e) => setElo(Number(e.target.value))}
              />

              <label className="play-label">Your color</label>
              <div className="seg">
                {(["white", "black", "random"] as ColorChoice[]).map((c) => (
                  <button
                    key={c}
                    className={`seg-btn${colorChoice === c ? " active" : ""}`}
                    onClick={() => setColorChoice(c)}
                  >
                    {c === "white" ? "White" : c === "black" ? "Black" : "Random"}
                  </button>
                ))}
              </div>

              <label className="play-label">Time control</label>
              <div className="seg">
                {(Object.keys(TCS) as TcKey[]).map((k) => (
                  <button
                    key={k}
                    className={`seg-btn${tcKey === k ? " active" : ""}`}
                    onClick={() => setTcKey(k)}
                  >
                    {TCS[k].label}
                  </button>
                ))}
              </div>

              <button className="primary" onClick={startGame}>
                Start game
              </button>
            </div>
          ) : (
            <div className="card play-panel">
              <div className="play-status-row">
                <span className="card-eyebrow">{eloLabel(elo)} bot · ~{elo}</span>
                <button className="link" onClick={newGame}>
                  New game
                </button>
              </div>

              <p className={`play-status${result ? " final" : ""}`}>
                {thinking && <span className="spinner" />}
                {result ?? status}
              </p>

              <div className="drill-actions">
                <button className="secondary" onClick={showHint} disabled={phase !== "playing" || thinking}>
                  Hint
                </button>
                <button className="secondary" onClick={takeback} disabled={thinking || history.length < 2}>
                  Takeback
                </button>
                <button className="secondary" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
                  Flip board
                </button>
                <button className="secondary bad" onClick={resign} disabled={phase !== "playing"}>
                  Resign
                </button>
              </div>

              <div className="movelist">
                {history.length === 0 ? (
                  <span className="movelist-empty">No moves yet.</span>
                ) : (
                  history.map((san, i) =>
                    i % 2 === 0 ? (
                      <span key={i} className="move-pair">
                        <span className="move-no">{i / 2 + 1}.</span>
                        <span className="move-san">{san}</span>
                        {history[i + 1] && <span className="move-san">{history[i + 1]}</span>}
                      </span>
                    ) : null
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
