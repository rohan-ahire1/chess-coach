"use client";

import Image from "next/image";
import {
  MISTAKE_LABELS,
  PHASE_LABELS,
  bestMoveSan,
  blunderId,
  type Diagnosis,
} from "@/lib/insights";
import type {
  BlunderExample,
  MistakeKind,
  PatternPayload,
  Phase,
  Profile,
  ProgressState,
} from "@/lib/types";
import Icon, { type IconName } from "./Icon";

export type ReportView = "summary" | "evidence" | "drill";

export function PrivacyPill() {
  return (
    <span className="privacy-pill">
      <Icon name="lock" size={14} />
      Private. Local. Yours.
    </span>
  );
}

export function HeroArtwork({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`hero-art${compact ? " compact" : ""}`} aria-hidden="true">
      <span className="hero-art-orb" />
      <span className="hero-art-cloud one" />
      <span className="hero-art-cloud two" />
      <span className="hero-board">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} className={i % 2 === Math.floor(i / 6) % 2 ? "sage" : ""} />
        ))}
      </span>
      <Image
        src="/images/chess-hero.png"
        alt=""
        width={900}
        height={675}
        sizes={compact ? "(max-width: 640px) 88vw, 380px" : "(max-width: 900px) 90vw, 520px"}
        priority={!compact}
      />
    </div>
  );
}

export function ReportStepper({
  view,
  onChange,
}: {
  view: ReportView;
  onChange: (view: ReportView) => void;
}) {
  const steps: Array<{ key: ReportView; title: string; sub: string }> = [
    { key: "summary", title: "Summary", sub: "Understand your results" },
    { key: "evidence", title: "Evidence", sub: "See the proof" },
    { key: "drill", title: "Drill", sub: "Improve with practice" },
  ];
  const activeIndex = steps.findIndex((step) => step.key === view);

  return (
    <nav className="report-stepper" aria-label="Report steps">
      {steps.map((step, index) => (
        <div className="report-step-wrap" key={step.key}>
          <button
            className={`report-step${index === activeIndex ? " active" : ""}${
              index < activeIndex ? " complete" : ""
            }`}
            onClick={() => onChange(step.key)}
            aria-current={index === activeIndex ? "step" : undefined}
            aria-pressed={index === activeIndex}
            aria-label={`${step.title}: ${step.sub}`}
          >
            <span className="report-step-num" aria-hidden="true">
              {index < activeIndex ? <Icon name="check" size={14} /> : index + 1}
            </span>
            <span>
              <strong>{step.title}</strong>
              <small>{step.sub}</small>
            </span>
          </button>
          {index < steps.length - 1 && <span className="report-step-line" aria-hidden="true" />}
        </div>
      ))}
    </nav>
  );
}

export function AnalysisProgress({
  progress,
  percent,
  gamesAnalyzed,
}: {
  progress: ProgressState;
  percent: number;
  gamesAnalyzed: number;
}) {
  const overall =
    progress.status === "fetching"
      ? Math.max(6, percent * 0.1)
      : progress.status === "analyzing"
      ? 15 + percent * 0.68
      : progress.status === "coaching"
      ? 92
      : percent;
  const currentStep =
    progress.status === "fetching" ? 0 : progress.status === "analyzing" ? 1 : 3;
  const steps = [
    {
      label: "Fetching games",
      detail:
        progress.status === "fetching"
          ? progress.message
          : `${progress.total || gamesAnalyzed} games imported`,
    },
    {
      label: "Analyzing positions",
      detail:
        progress.status === "analyzing"
          ? `${progress.current} of ${progress.total} games`
          : progress.status === "fetching"
          ? "Waiting for games"
          : "Stockfish pass complete",
    },
    {
      label: "Detecting recurring patterns",
      detail: currentStep >= 2 ? "Comparing mistakes across games" : "Upcoming",
    },
    {
      label: "Writing coach summary",
      detail: progress.status === "coaching" ? "Crafting your personalized insights" : "Upcoming",
    },
  ];

  return (
    <section
      className="analysis-screen fade-in"
      aria-labelledby="analysis-title"
      aria-busy="true"
    >
      <p className="sr-only" role="status" aria-live="polite">
        {progress.message || `Report ${Math.round(overall)}% complete`}
      </p>
      <div className="analysis-main card">
        <span className="analysis-icon" aria-hidden="true">
          <Icon name="file-text" size={28} />
        </span>
        <h1 id="analysis-title">Building your report</h1>
        <p>
          We’re analyzing your recent games with Stockfish right in your browser.
          <br />
          No uploads, no cloud—your chess stays private.
        </p>
        <div className="analysis-progress-line">
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Report progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(overall)}
          >
            <div className="progress-fill" style={{ width: `${Math.min(100, overall)}%` }} />
          </div>
          <strong>{Math.round(overall)}%</strong>
        </div>
        <div className="analysis-stage-line">
          {steps.map((step, index) => (
            <div className="analysis-stage" key={step.label}>
              <span
                className={`analysis-stage-dot${
                  index < currentStep ? " complete" : index === currentStep ? " active" : ""
                }`}
                aria-hidden="true"
              >
                {index < currentStep ? <Icon name="check" size={15} /> : index + 1}
              </span>
              <strong>{step.label}</strong>
            </div>
          ))}
        </div>
        <div className="analysis-task-list">
          {steps.map((step, index) => (
            <div key={step.label} className={index === currentStep ? "active" : ""}>
              <span className="task-status" aria-hidden="true">
                {index < currentStep ? (
                  <Icon name="check-circle" size={18} />
                ) : index === currentStep ? (
                  <span className="spinner task-spinner" />
                ) : (
                  <span className="task-upcoming" />
                )}
              </span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
              <em>
                {index < currentStep ? "Complete" : index === currentStep ? "In progress…" : "Upcoming"}
              </em>
            </div>
          ))}
        </div>
        <div className="analysis-assurances">
          <span>
            <b><Icon name="info" size={21} /></b>
            <strong>You can leave this tab open</strong>
            <small>Analysis continues in your browser.</small>
          </span>
          <span>
            <b><Icon name="window" size={21} /></b>
            <strong>Runs locally</strong>
            <small>Your games never leave this device.</small>
          </span>
          <span>
            <b><Icon name="refresh" size={21} /></b>
            <strong>Progress is saved</strong>
            <small>We’ll restore completed games after a reload.</small>
          </span>
        </div>
      </div>
      <aside className="analysis-side card">
        <p className="card-eyebrow">What’s happening now</p>
        <h2>
          <span className="spinner" />
          {progress.status === "fetching"
            ? "Finding recent games"
            : progress.status === "coaching"
            ? "Finishing your report"
            : "Analyzing with Stockfish"}
        </h2>
        <HeroArtwork compact />
        <p>
          Stockfish is evaluating positions, comparing alternatives, and grouping the mistakes
          that repeat.
        </p>
        <ul>
          <li>Evaluating critical positions</li>
          <li>Calculating stronger move alternatives</li>
          <li>Measuring accuracy and advantage</li>
        </ul>
        <div className="analysis-private">
          <strong><Icon name="shield-check" size={18} /> Your data never leaves your device</strong>
          <small>100% private. 100% local. Nothing is uploaded or shared.</small>
        </div>
      </aside>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="report-metric">
      <span aria-hidden="true"><Icon name={icon} size={23} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </div>
  );
}

export function ReportSummary({
  profile,
  diagnosis,
  patternPayload,
  coaching,
  onEvidence,
  onDrill,
  onPosition,
}: {
  profile: Profile;
  diagnosis: Diagnosis;
  patternPayload: PatternPayload | null;
  coaching: string | null;
  onEvidence: () => void;
  onDrill: () => void;
  onPosition: (id: string) => void;
}) {
  const topCount = profile.mistakesByKind[diagnosis.kind] ?? 0;
  const share = profile.totalBlunders
    ? Math.round((topCount / profile.totalBlunders) * 100)
    : 0;
  const avgLoss = diagnosis.examples.length
    ? diagnosis.examples.reduce((sum, item) => sum + item.swingCp, 0) /
      diagnosis.examples.length /
      100
    : 0;
  const maxMistakes = Math.max(1, ...Object.values(profile.mistakesByKind));
  const mistakeRows = (Object.entries(profile.mistakesByKind) as Array<[MistakeKind, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const phases: Phase[] = ["opening", "middlegame", "endgame"];

  return (
    <section className="summary-layout fade-in">
      <div className="summary-primary">
        <article className="card summary-diagnosis">
          <p className="card-eyebrow">
            <Icon name="target" size={14} />
            Diagnosis
          </p>
          <h1>{diagnosis.title}</h1>
          <span className={`confidence ${diagnosis.confidence.toLowerCase().replace(" ", "-")}`}>
            <Icon name="bars" size={14} />
            {diagnosis.confidence} confidence
          </span>
          <div className="report-metrics">
            <Metric icon="pulse" label="Frequency" value={`${share}%`} detail="of flagged positions" />
            <Metric
              icon="arrow-down-right"
              label="Average impact"
              value={`−${avgLoss.toFixed(1)}`}
              detail="pawns in matching cases"
            />
            <Metric
              icon="bars"
              label="Games analyzed"
              value={`${profile.gamesAnalyzed}`}
              detail="recent games"
            />
          </div>
          <p className="summary-explanation">{diagnosis.summary}</p>
          {coaching && <p className="summary-coaching">{coaching}</p>}
          <h3>Recurring patterns</h3>
          <div className="summary-patterns">
            {(patternPayload?.top_patterns.length
              ? patternPayload.top_patterns
              : [
                  {
                    description: diagnosis.drill,
                    count: topCount,
                    avg_eval_loss: avgLoss,
                    examples: [],
                  },
                ]
            ).map((pattern) => (
              <span key={pattern.description}>
                <b><Icon name="target" size={17} /></b>
                <strong>{pattern.description}</strong>
                <small>{pattern.count} matching positions</small>
              </span>
            ))}
          </div>
          <div className="summary-action">
            <button className="primary inline" onClick={onEvidence}>
              Review the evidence <Icon name="arrow-right" size={17} />
            </button>
            <small>See the moments and engine comparisons behind this diagnosis.</small>
          </div>
        </article>

        <article className="card next-action">
          <span className="next-action-icon" aria-hidden="true">
            <Icon name="target" size={29} />
          </span>
          <div>
            <small>Next best action</small>
            <h2>Start with a curated drill set</h2>
            <p>{diagnosis.drill}</p>
          </div>
          <button className="secondary" onClick={onDrill}>
            Start drilling <Icon name="arrow-right" size={16} />
          </button>
        </article>
      </div>

      <aside className="summary-side">
        <article className="card report-snapshot">
          <h2><Icon name="bars" size={17} /> Report snapshot</h2>
          <p>Flagged themes</p>
          <div className="snapshot-bars">
            {mistakeRows.map(([kind, count], index) => (
              <div key={kind}>
                <span>{MISTAKE_LABELS[kind]}</span>
                <i>
                  <b
                    style={{
                      width: `${Math.max(10, (count / maxMistakes) * 100)}%`,
                      opacity: 1 - index * 0.11,
                    }}
                  />
                </i>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="phase-impact">
            <small>By game phase</small>
            <div>
              {phases.map((phase) => (
                <span key={phase}>
                  <small>{PHASE_LABELS[phase]}</small>
                  <strong>{profile.blundersByPhase[phase]}</strong>
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className="card critical-positions">
          <div className="critical-head">
            <h2>Critical positions</h2>
            <button className="link" onClick={onEvidence}>
              View all
            </button>
          </div>
          {diagnosis.examples.map((example: BlunderExample) => (
            <button
              key={blunderId(example)}
              className="critical-row"
              onClick={() => onPosition(blunderId(example))}
            >
              <span className="critical-piece" aria-hidden="true">
                ♞
              </span>
              <span>
                <strong>
                  Game {example.gameIndex + 1}, move {example.moveNumber}
                </strong>
                <small>
                  {example.move} → {bestMoveSan(example) ?? "stronger move"} · −
                  {(example.swingCp / 100).toFixed(1)}
                </small>
              </span>
              <b aria-hidden="true"><Icon name="chevron-right" size={16} /></b>
            </button>
          ))}
        </article>
      </aside>
    </section>
  );
}

export function DiagnosisRail({
  diagnosis,
  onSummary,
}: {
  diagnosis: Diagnosis;
  onSummary: () => void;
}) {
  return (
    <aside className="card diagnosis-rail">
      <PrivacyPill />
      <small>Your diagnosis</small>
      <h2>{diagnosis.title.replace("Your biggest leak: ", "")}</h2>
      <span className={`confidence ${diagnosis.confidence.toLowerCase().replace(" ", "-")}`}>
        {diagnosis.confidence} confidence
      </span>
      <p>{diagnosis.summary}</p>
      <h3>Focus of this review</h3>
      <p>{diagnosis.drill}</p>
      <button className="secondary" onClick={onSummary}>
        <Icon name="arrow-left" size={16} /> Back to summary
      </button>
      <div className="rail-tip">
        <strong><Icon name="lightbulb" size={16} /> Tip</strong>
        <p>Review the proof first, then solve the same positions so the pattern sticks.</p>
      </div>
    </aside>
  );
}

export function DrillCoachPanel({
  diagnosis,
  current,
  onEvidence,
}: {
  diagnosis: Diagnosis;
  current: BlunderExample | undefined;
  onEvidence: () => void;
}) {
  return (
    <aside className="drill-coach">
      <article className="card">
        <span className="coach-target" aria-hidden="true">
          <Icon name="target" size={25} />
        </span>
        <h2>Why this position matters</h2>
        <p>{diagnosis.summary}</p>
        <hr />
        <h3>What to watch for</h3>
        <ul>
          <li>Is every piece protected?</li>
          <li>Can my opponent attack with tempo?</li>
          <li>Are there safer forcing moves?</li>
        </ul>
        <div className="key-idea">
          <strong><Icon name="lightbulb" size={16} /> Key idea</strong>
          <span>{diagnosis.drill}</span>
        </div>
      </article>
      {current && (
        <article className="card related-evidence">
          <div>
            <h3>Related evidence</h3>
            <button className="link" onClick={onEvidence}>
              View all
            </button>
          </div>
          <p>
            Game {current.gameIndex + 1} · move {current.moveNumber}
          </p>
          <strong>
            {current.move} cost {(current.swingCp / 100).toFixed(1)} pawns of value.
          </strong>
        </article>
      )}
    </aside>
  );
}
