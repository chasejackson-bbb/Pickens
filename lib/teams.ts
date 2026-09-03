// Canonical list of the 32 current NFL teams, plus a normalization table mapping every
// informal/historical name we found in the legacy spreadsheet (2019-2025) -- typos,
// abbreviations, and inside-joke nicknames included -- to the correct team.
//
// Notably: "Buckaroos" is NOT a joke about the Broncos. The 2025-season sheets include a
// "Remaining Teams" reference column that lists all 32 team nicknames used by the league;
// "Buckaroos" and "Broncos" both appear in it as distinct entries, and every other team in
// that list maps 1:1 to a real NFL team except "Buckaroos" -- which lines up with the
// Tampa Bay Buccaneers slot (the only team otherwise missing from the list). Confirmed
// further by "BUCCS" / "Buccaneers " / "Bucs" appearing as separate, more literal spellings
// in other seasons for the same team.
//
// The Washington franchise is stored under its current name (Commanders); "Redskins" and
// "Football Team" both map there for historical seasons before the 2022 rename.

export const NFL_TEAMS = [
  "Arizona Cardinals",
  "Atlanta Falcons",
  "Baltimore Ravens",
  "Buffalo Bills",
  "Carolina Panthers",
  "Chicago Bears",
  "Cincinnati Bengals",
  "Cleveland Browns",
  "Dallas Cowboys",
  "Denver Broncos",
  "Detroit Lions",
  "Green Bay Packers",
  "Houston Texans",
  "Indianapolis Colts",
  "Jacksonville Jaguars",
  "Kansas City Chiefs",
  "Las Vegas Raiders",
  "Los Angeles Chargers",
  "Los Angeles Rams",
  "Miami Dolphins",
  "Minnesota Vikings",
  "New England Patriots",
  "New Orleans Saints",
  "New York Giants",
  "New York Jets",
  "Philadelphia Eagles",
  "Pittsburgh Steelers",
  "San Francisco 49ers",
  "Seattle Seahawks",
  "Tampa Bay Buccaneers",
  "Tennessee Titans",
  "Washington Commanders",
] as const;

export type NflTeam = (typeof NFL_TEAMS)[number];

// key: lowercase, whitespace-collapsed alias -> canonical team name
export const TEAM_ALIASES: Record<string, NflTeam> = {
  // Cardinals
  cardinals: "Arizona Cardinals",
  cards: "Arizona Cardinals",
  arizona: "Arizona Cardinals",
  // Falcons
  falcons: "Atlanta Falcons",
  atlanta: "Atlanta Falcons",
  atl: "Atlanta Falcons",
  // Ravens
  ravens: "Baltimore Ravens",
  baltimore: "Baltimore Ravens",
  // Bills
  bills: "Buffalo Bills",
  buffalo: "Buffalo Bills",
  // Panthers
  panthers: "Carolina Panthers",
  carolina: "Carolina Panthers",
  // Bears
  bears: "Chicago Bears",
  chicago: "Chicago Bears",
  chi: "Chicago Bears",
  // Bengals
  bengals: "Cincinnati Bengals",
  cincinnati: "Cincinnati Bengals",
  cinci: "Cincinnati Bengals",
  cincy: "Cincinnati Bengals",
  // Browns
  browns: "Cleveland Browns",
  cleveland: "Cleveland Browns",
  // Cowboys
  cowboys: "Dallas Cowboys",
  dallas: "Dallas Cowboys",
  // Broncos
  broncos: "Denver Broncos",
  denver: "Denver Broncos",
  // Lions
  lions: "Detroit Lions",
  detroit: "Detroit Lions",
  // Packers
  packers: "Green Bay Packers",
  "green bay": "Green Bay Packers",
  gb: "Green Bay Packers",
  // Texans
  texans: "Houston Texans",
  houston: "Houston Texans",
  // Colts
  colts: "Indianapolis Colts",
  indianapolis: "Indianapolis Colts",
  // Jaguars
  jaguars: "Jacksonville Jaguars",
  jags: "Jacksonville Jaguars",
  jacksonville: "Jacksonville Jaguars",
  // Chiefs
  chiefs: "Kansas City Chiefs",
  "kansas city": "Kansas City Chiefs",
  kc: "Kansas City Chiefs",
  // Raiders
  raiders: "Las Vegas Raiders",
  "las vegas": "Las Vegas Raiders",
  oakland: "Las Vegas Raiders",
  lv: "Las Vegas Raiders",
  // Chargers
  chargers: "Los Angeles Chargers",
  "la chargers": "Los Angeles Chargers",
  lac: "Los Angeles Chargers",
  "san diego": "Los Angeles Chargers",
  // Rams
  rams: "Los Angeles Rams",
  "la rams": "Los Angeles Rams",
  lar: "Los Angeles Rams",
  // Dolphins
  dolphins: "Miami Dolphins",
  miami: "Miami Dolphins",
  fins: "Miami Dolphins",
  // Vikings
  vikings: "Minnesota Vikings",
  minnesota: "Minnesota Vikings",
  // Patriots
  patriots: "New England Patriots",
  pats: "New England Patriots",
  ne: "New England Patriots",
  "new england": "New England Patriots",
  // Saints
  saints: "New Orleans Saints",
  "new orleans": "New Orleans Saints",
  // Giants
  giants: "New York Giants",
  nyg: "New York Giants",
  // Jets
  jets: "New York Jets",
  nyj: "New York Jets",
  "j-e-t-s": "New York Jets", // literal legacy sheet spelling ("J-E-T-S, Jets Jets Jets")
  // Eagles
  eagles: "Philadelphia Eagles",
  philadelphia: "Philadelphia Eagles",
  philly: "Philadelphia Eagles",
  // Steelers
  steelers: "Pittsburgh Steelers",
  pittsburgh: "Pittsburgh Steelers",
  pitt: "Pittsburgh Steelers",
  // 49ers
  "49ers": "San Francisco 49ers",
  niners: "San Francisco 49ers",
  whiners: "San Francisco 49ers", // literal legacy sheet nickname (a jab, not a typo)
  sf: "San Francisco 49ers",
  sfo: "San Francisco 49ers",
  "san francisco": "San Francisco 49ers",
  // Seahawks
  seahawks: "Seattle Seahawks",
  hawks: "Seattle Seahawks",
  "go hawks": "Seattle Seahawks", // literal legacy sheet entry
  seattle: "Seattle Seahawks",
  sea: "Seattle Seahawks",
  // Buccaneers
  buccaneers: "Tampa Bay Buccaneers",
  buccs: "Tampa Bay Buccaneers",
  bucs: "Tampa Bay Buccaneers",
  buckaroos: "Tampa Bay Buccaneers", // see file header note
  "tampa bay": "Tampa Bay Buccaneers",
  tampa: "Tampa Bay Buccaneers",
  tb: "Tampa Bay Buccaneers",
  // Titans
  titans: "Tennessee Titans",
  tennessee: "Tennessee Titans",
  // Commanders
  commanders: "Washington Commanders",
  cummanders: "Washington Commanders", // legacy sheet typo
  redskins: "Washington Commanders",
  washington: "Washington Commanders",
  "football team": "Washington Commanders",
  skins: "Washington Commanders",
};

function normalizeKey(raw: string): string {
  return raw
    .replace(/\n/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .toLowerCase();
}

/**
 * Resolve any team name/nickname/abbreviation to its canonical NFL team name.
 * Returns null if it can't be resolved (caller decides whether that's an error
 * or an expected non-NFL entry, e.g. a legacy sheet's college-football tiebreaker row).
 */
export function normalizeTeam(raw: string | null | undefined): NflTeam | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  if ((NFL_TEAMS as readonly string[]).includes(raw.trim())) {
    return raw.trim() as NflTeam;
  }
  return TEAM_ALIASES[key] ?? null;
}
