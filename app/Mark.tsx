/** A trace that falls once: the whole product in one line. */
export default function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path className="mark-trace" d="M2 7h5l3 2M15 19l3-2h4" />
      <path className="mark-fall" d="M10 9l5 10" />
    </svg>
  );
}
