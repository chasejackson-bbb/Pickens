// Per-player pick colors, from the Nocturne brand identity sheet. Each player's hue sits on
// a shared OKLCH formula at three lightness/chroma tiers -- fill (dark, for a badge
// background), base (the swatch/bar color), ink (light, for text on the dark fill):
//   fill = oklch(0.3  0.055 H)
//   base = oklch(0.735 0.125 H)
//   ink  = oklch(0.88  0.06  H)
// so any player's three colors read as the same "weight" as any other's -- no one's color
// outranks another's. Per the brand sheet's own rule: a player's color only ever appears as a
// fill behind their own text, a dot, or a bar -- never as page chrome.
const PLAYER_HUES: Record<string, number> = {
  Chase: 148, // Turf Green
  Blake: 232, // Signal Blue
  Jay: 52, // Sideline Amber
};

// Fallback hues for any player beyond the original three (evenly spread, avoiding the hues
// above), so the roster can still grow without a design change.
const FALLBACK_HUES = [300, 20, 200, 100];

function hueForName(name: string): number {
  if (name in PLAYER_HUES) return PLAYER_HUES[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_HUES[hash % FALLBACK_HUES.length];
}

export interface PlayerColor {
  fill: string;
  base: string;
  ink: string;
}

export function playerColor(name: string): PlayerColor {
  const h = hueForName(name);
  return {
    fill: `oklch(0.3 0.055 ${h})`,
    base: `oklch(0.735 0.125 ${h})`,
    ink: `oklch(0.88 0.06 ${h})`,
  };
}
