#!/usr/bin/env python3
"""Cubo diário, uma consulta por tribunal (a consulta única estoura o tempo)."""
import json, sys, time
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import extract as e
T = e.col("t", "", "tribunal_formatado"); M = e.meas("m", "Total Minutas")
for n in range(1, 25):
    trib = "TRT%02d" % n
    s = time.time()
    try:
        out = e.run(e.query([e.col("d", "", "Data"), M], ["data", "minutas"], tribunal=trib))
        json.dump(out, open(f"data/raw/diario_{trib}.json", "w"))
        print(trib, "ok", round(time.time() - s), flush=True)
    except Exception as x:
        print(trib, "fail", round(time.time() - s), x, flush=True)
