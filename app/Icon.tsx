const PATHS = {
  start: "M6 5v14M19 5l-9 7 9 7",
  back: "M16 5l-9 7 9 7",
  forward: "M8 5l9 7-9 7",
  end: "M18 5v14M5 5l9 7-9 7",
  flip: "M7 4v15M7 19l-3-3M7 19l3-3M17 20V5M17 5l-3 3M17 5l3 3",
  sound: "M4 10v4h3l5 4V6L7 10zM15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11",
  muted: "M4 10v4h3l5 4V6L7 10zM16 10l5 5M21 10l-5 5",
  right: "M4 12h15M13 6l6 6-6 6",
  left: "M20 12H5M11 6l-6 6 6 6",
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
