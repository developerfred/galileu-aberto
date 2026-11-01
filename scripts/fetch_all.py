#!/usr/bin/env python3
"""Baixa os cubos agregados (sem dados pessoais) do painel Galileu para data/raw/."""
import json, sys, time
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import extract as e

FALHAS = []
T = e.col("t", "", "tribunal_formatado"); M = e.meas("m", "Total Minutas")
CUBES = {
    "diario": (["tribunal", "data", "minutas"], [T, e.col("d", "", "Data"), M]),
    "mensal_grau": (["tribunal", "ano_mes", "grau", "minutas"], [T, e.col("d", "", "AnoMes"), e.col("p", "", "grau_jurisdicao"), M]),
    "mensal_modelo": (["tribunal", "ano_mes", "modelo", "minutas", "tokens_entrada", "tokens_saida"],
                      [T, e.col("d", "", "AnoMes"), e.col("c", "", "modelo_llm"), M, e.meas("m", "Total Tokens Entrada"), e.meas("m", "Total Tokens Saida")]),
}
for name, (names, sel) in CUBES.items():
    s = time.time()
    try:
        out = e.run(e.query(sel, names, limit=30000))
        json.dump(out, open(f"data/raw/{name}.json", "w"))
        print(name, "ok", round(time.time() - s), flush=True)
    except Exception as x:
        print(name, "fail", round(time.time() - s), x, flush=True)
        FALHAS.append(1)
sys.exit(1 if FALHAS else 0)
