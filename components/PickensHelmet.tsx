// Navy/silver helmet mark from the brand identity sheet (Pickens Logo v3), rebuilt as
// self-contained inline SVG. Two variants, matching the identity sheet's own guidance that the
// full mark turns muddy below ~48px: `simple` (its 32px "mark at size" reduction -- just the
// shell and a facemask chip) for nav/small use, `full` (the detailed primary lockup mark) for
// anywhere larger.
export function PickensHelmet({
  size = 40,
  variant = "simple",
  className,
}: {
  size?: number;
  variant?: "full" | "simple";
  className?: string;
}) {
  if (variant === "simple") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pk-facemask-sm" x1="15" y1="13" x2="30" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#eef2f5" />
            <stop offset="0.46" stopColor="#8f9ba4" />
            <stop offset="1" stopColor="#d8dee2" />
          </linearGradient>
        </defs>
        <rect x="0" y="3" width="24" height="22" rx="11" fill="#041e42" />
        <rect x="11" y="21" width="15" height="8" rx="3.5" fill="#041e42" />
        <rect x="15" y="13" width="15" height="9" rx="3" fill="url(#pk-facemask-sm)" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pk-facemask" x1="15" y1="13" x2="69" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4f7f9" />
          <stop offset="0.3" stopColor="#aeb9c2" />
          <stop offset="0.54" stopColor="#38434c" />
          <stop offset="0.74" stopColor="#97a3ac" />
          <stop offset="1" stopColor="#e6ebee" />
        </linearGradient>
        <linearGradient id="pk-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* shell */}
      <rect x="8" y="20" width="106" height="92" rx="46" ry="46" fill="#041e42" />
      {/* facemask arm */}
      <rect x="74" y="44" width="44" height="22" rx="10" fill="#041e42" />
      {/* chin/jaw */}
      <rect x="54" y="94" width="62" height="30" rx="14" fill="#041e42" />
      {/* shell shine */}
      <rect x="14" y="28" width="96" height="32" rx="46" fill="url(#pk-shine)" />
      {/* eye hole */}
      <circle cx="40" cy="72" r="14" fill="none" stroke="#8a949c" strokeWidth="3" />
      {/* facemask cage */}
      <rect x="70" y="60" width="54" height="34" rx="10" transform="rotate(-4 97 77)" fill="url(#pk-facemask)" stroke="#c8ced4" strokeWidth="2" />
      <rect x="130" y="56" width="7" height="62" rx="3.5" transform="rotate(9 133.5 87)" fill="#8a949c" />
      <rect x="104" y="64" width="32" height="6" rx="3" transform="rotate(-7 120 67)" fill="#8a949c" />
      <rect x="104" y="84" width="32" height="6" rx="3" transform="rotate(-7 120 87)" fill="#8a949c" />
      <rect x="102" y="104" width="34" height="6" rx="3" transform="rotate(-7 119 107)" fill="#8a949c" />
    </svg>
  );
}
