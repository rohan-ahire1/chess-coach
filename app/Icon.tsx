import type { SVGProps } from "react";

export type IconName =
  | "arrow-down-right"
  | "arrow-left"
  | "arrow-right"
  | "bars"
  | "check"
  | "check-circle"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "eye"
  | "eye-off"
  | "file-text"
  | "help-circle"
  | "info"
  | "lightbulb"
  | "lock"
  | "play"
  | "pulse"
  | "refresh"
  | "rotate-ccw"
  | "search"
  | "shield-check"
  | "shuffle"
  | "sparkle"
  | "target"
  | "trend-up"
  | "user"
  | "warning"
  | "window";

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number;
};

function IconPaths({ name }: { name: IconName }) {
  switch (name) {
    case "arrow-down-right":
      return (
        <>
          <path d="M7 7h10v10" />
          <path d="m7 17 10-10" />
        </>
      );
    case "arrow-left":
      return (
        <>
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </>
      );
    case "arrow-right":
      return (
        <>
          <path d="m9 18 6-6-6-6" />
          <path d="M5 12h10" />
        </>
      );
    case "bars":
      return (
        <>
          <path d="M5 20V10" />
          <path d="M12 20V4" />
          <path d="M19 20v-7" />
        </>
      );
    case "check":
      return <path d="m5 12 4 4L19 6" />;
    case "check-circle":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.7 2.7L16.5 9" />
        </>
      );
    case "chevron-left":
      return <path d="m15 18-6-6 6-6" />;
    case "chevron-right":
      return <path d="m9 18 6-6-6-6" />;
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      );
    case "eye-off":
      return (
        <>
          <path d="m3 3 18 18" />
          <path d="M10.7 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16.8 16.8 0 0 1-2.1 2.8" />
          <path d="M6.6 6.7A16.4 16.4 0 0 0 2.5 12s3.5 6 9.5 6a9.4 9.4 0 0 0 3.2-.6" />
        </>
      );
    case "file-text":
      return (
        <>
          <path d="M6 2h8l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v5h5" />
          <path d="M8 12h8M8 16h8" />
        </>
      );
    case "help-circle":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.7 9a2.5 2.5 0 1 1 3.6 2.2c-.9.5-1.3 1-1.3 1.8" />
          <path d="M12 17h.01" />
        </>
      );
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      );
    case "lightbulb":
      return (
        <>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M8.2 14.5A6 6 0 1 1 15.8 14.5c-.8.7-1.3 1.6-1.3 2.5h-5c0-.9-.5-1.8-1.3-2.5Z" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      );
    case "play":
      return <path d="m8 5 11 7-11 7V5Z" />;
    case "pulse":
      return <path d="M3 12h4l2-7 4 14 2-7h6" />;
    case "refresh":
      return (
        <>
          <path d="M20 7v5h-5" />
          <path d="M19 12a7 7 0 1 0-2 5" />
        </>
      );
    case "rotate-ccw":
      return (
        <>
          <path d="M4 4v6h6" />
          <path d="M5.5 15a8 8 0 1 0 .8-8.7L4 10" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 5 5" />
        </>
      );
    case "shield-check":
      return (
        <>
          <path d="M12 2 20 6v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      );
    case "shuffle":
      return (
        <>
          <path d="M16 3h5v5" />
          <path d="M4 20 21 3" />
          <path d="M21 16v5h-5" />
          <path d="m15 15 6 6M4 4l5 5" />
        </>
      );
    case "sparkle":
      return (
        <>
          <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
          <path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
          <path d="M5 16h.01" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="11" cy="13" r="8" />
          <circle cx="11" cy="13" r="3" />
          <path d="m14 10 7-7M16 3h5v5" />
        </>
      );
    case "trend-up":
      return (
        <>
          <path d="m3 17 6-6 4 4 8-9" />
          <path d="M15 6h6v6" />
        </>
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      );
    case "warning":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6M12 17h.01" />
        </>
      );
    case "window":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
        </>
      );
  }
}

export default function Icon({ name, size = 18, className = "", ...props }: IconProps) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <IconPaths name={name} />
    </svg>
  );
}
