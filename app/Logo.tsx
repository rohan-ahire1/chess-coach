/** Coachmate knight mark — a clean knight silhouette in a rounded tile. */
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 448 512" width="58%" height="58%" role="img">
        <path
          fill="currentColor"
          d="M19 272.5c-1.6 4.6-2.6 9.5-2.6 14.7V304c0 8.8 7.2 16 16 16H416c8.8 0 16-7.2 16-16V287.2c0-71.5-39.7-128-128-128h-7.6c-12.7 0-24.8-5-33.8-14L191.3 60.6c-2.1-2.1-3.3-5-3.3-8 0-6.3 5.1-11.3 11.3-11.3H208c44.2 0 80 35.8 80 80 0 8.8 7.2 16 16 16s16-7.2 16-16c0-32.8-15.7-61.9-40-80.2V24c0-13.3-10.7-24-24-24H56C42.7 0 32 10.7 32 24c0 4.7 1.4 9.3 4 13.3L62.3 76.8C25.6 109.8 0 156.6 0 205.6c0 31.6 9.4 60.9 25.6 85.4L19 272.5z"
        />
      </svg>
    </span>
  );
}
