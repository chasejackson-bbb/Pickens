// Chevron mark from the Nocturne brand identity sheet: "the blurple accent is the brand's --
// it carries the logo, links and rules, and nothing else." A single stroked chevron, always in
// var(--accent), never filled or recolored per-context.
export function PickensMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M13 34 L26 21 L39 34"
        stroke="var(--accent)"
        strokeWidth="6"
        strokeLinecap="square"
        fill="none"
      />
    </svg>
  );
}
