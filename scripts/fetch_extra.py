#!/usr/bin/env python3
"""Totais oficiais do painel (contagem distinta) e requisições por modelo."""
import json, sys, time
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import extract as e

def agg(src, prop, fn):
    return {"Aggregation": {"Expression": e.col(src, "", prop), "Function": fn}}

FALHAS = []
T = e.col("t", "", "tribunal_formatado"); M = e.meas("m", "Total Minutas")
CUBES = {
    "total": (["minutas", "tokens_entrada", "tokens_saida"], [M, e.meas("m", "Total Tokens Entrada"), e.meas("m", "Total Tokens Saida")]),
    "tribunal": (["tribunal", "minutas", "tokens_entrada", "tokens_saida"], [T, M, e.meas("m", "Total Tokens Entrada"), e.meas("m", "Total Tokens Saida")]),
    "jurisdicao": (["jurisdicao", "minutas"], [e.col("p", "", "descricao_jurisdicao"), M]),
    "modelo_req": (["modelo", "requisicoes", "tokens_entrada", "tokens_saida"],
                   [e.col("c", "", "modelo_llm"), agg("c", "id_processo", 5), e.meas("m", "Total Tokens Entrada"), e.meas("m", "Total Tokens Saida")]),
    "mensal_modelo_req": (["ano_mes", "modelo", "requisicoes", "tokens_entrada", "tokens_saida"],
                   [e.col("d", "", "AnoMes"), e.col("c", "", "modelo_llm"), agg("c", "id_processo", 5), e.meas("m", "Total Tokens Entrada"), e.meas("m", "Total Tokens Saida")]),
}
for name, (names, sel) in CUBES.items():
    s = time.time()
    try:
        json.dump(e.run(e.query(sel, names)), open(f"data/raw/{name}.json", "w"))
        print(name, "ok", round(time.time() - s), flush=True)
    except Exception as x:
        print(name, "fail", round(time.time() - s), x, flush=True)
        FALHAS.append(1)
sys.exit(1 if FALHAS else 0)
