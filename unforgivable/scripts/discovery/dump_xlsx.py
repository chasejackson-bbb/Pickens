#!/usr/bin/env python3
"""Phase 0 discovery: dump every tab (cached values + formulas) from an .xlsx export of the league sheet.
Usage: python3 dump_xlsx.py league.xlsx discovery-output   (output has PII; it is gitignored)."""
import openpyxl, sys, os
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
wv = openpyxl.load_workbook(src, data_only=True)
wf = openpyxl.load_workbook(src, data_only=False)
for ws in wv.worksheets:
    f = wf[ws.title]
    fn = os.path.join(out, ws.title.replace(' ','_').replace('&','and')+'.txt')
    with open(fn,'w') as o:
        o.write(f"# {ws.title} dims={ws.dimensions} max_row={ws.max_row} max_col={ws.max_column}\n")
        for r in range(1, ws.max_row+1):
            cells=[]
            for c in range(1, ws.max_column+1):
                v = ws.cell(r,c).value; fv = f.cell(r,c).value
                if v is None and fv is None: continue
                s = f"{ws.cell(r,c).coordinate}={v!r}"
                if isinstance(fv,str) and fv.startswith('='): s += f" [{fv[:160]}]"
                cells.append(s)
            if cells: o.write(" | ".join(cells)+"\n")
    print(ws.title, ws.dimensions)
