/** Coachmate knight mark — a compact, platform-independent SVG silhouette. */
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 36 44" width="82%" height="82%">
        <path
          fill="currentColor"
          d="M10.4 31.2c.6-5.8 3.5-10.2 8.3-13.8l-2.5-8.1 5.8 2.3 2.7-4.1c4.9 2.5 7.7 6 8.4 10.4.7 4.1-.6 8.1-3.7 11.7H17.8c-1.5 0-2.6.5-3.4 1.6h-4Zm9.4-14.8c-2.7 2.1-4.7 4.4-5.8 7 2.4-.4 4.9-.3 7.2.4l4.1 1.2 2.8-3.1c1.4-1.6 1.8-3.5 1.1-5.7-.7-2-2.1-3.6-4.3-4.9l-1.8 2.8-3.3 2.3Zm7.2-.7a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0ZM8 32.8h22.5l1.4 4.1H6.6L8 32.8Zm-2.2 5.8h27a2.2 2.2 0 0 1 2.2 2.2V42H3.6v-1.2a2.2 2.2 0 0 1 2.2-2.2Z"
        />
      </svg>
    </span>
  );
}
