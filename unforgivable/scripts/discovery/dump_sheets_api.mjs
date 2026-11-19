#!/usr/bin/env node
// Phase 0 discovery: dump the header rows + sample rows of every tab via the Sheets API.
// READ-ONLY: uses spreadsheets.get (metadata) and spreadsheets.values.batchGet only.
//
// Usage:
//   GOOGLE_ACCESS_TOKEN=ya29.... node scripts/discovery/dump_sheets_api.mjs [rows=15] [outDir=discovery-output]
//
// Get a token quickly with the OAuth Playground (scope spreadsheets.readonly) or
// `gcloud auth print-access-token` after `gcloud auth login --enable-gdrive-access`.
// Output contains league members' personal info (League Info tab) -- it is gitignored, don't commit it.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SHEET_ID = process.env.SHEET_ID ?? "1SnXHm4OFNAHo5xmJ9R1t6Wu4fxHuqT_rXRkCG0f6oyo";
const TOKEN = process.env.GOOGLE_ACCESS_TOKEN;
const ROWS = Number(process.argv[2] ?? 15);
const OUT = process.argv[3] ?? "discovery-output";

if (!TOKEN) {
  console.error("Set GOOGLE_ACCESS_TOKEN (scope https://www.googleapis.com/auth/spreadsheets.readonly)");
  process.exit(1);
}

const api = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
const get = async (url) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

const meta = await get(`${api}?fields=sheets.properties(title,gridProperties)`);
const titles = meta.sheets.map((s) => s.properties.title);
const quote = (t) => `'${t.replace(/'/g, "''")}'`;
const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
for (const t of titles) params.append("ranges", `${quote(t)}!1:${ROWS}`);
const batch = await get(`${api}/values:batchGet?${params}`);

await mkdir(OUT, { recursive: true });
for (const [i, vr] of batch.valueRanges.entries()) {
  const p = meta.sheets[i].properties;
  const lines = [`# ${p.title} (${p.gridProperties.rowCount} rows x ${p.gridProperties.columnCount} cols)`];
  (vr.values ?? []).forEach((row, r) => lines.push(`${r + 1}\t${row.map((v) => JSON.stringify(v)).join("\t")}`));
  await writeFile(path.join(OUT, `${p.title.replace(/[^\w]+/g, "_")}.tsv`), lines.join("\n") + "\n");
  console.log(`${p.title}: ${vr.values?.length ?? 0} rows`);
}
