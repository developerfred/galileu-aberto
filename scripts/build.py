#!/usr/bin/env python3
"""Converte data/raw/*.json em CSV, JSON e Parquet em data/ e docs/data/. Só agregados."""
import json, os, sys
import pandas as pd
sys.path.insert(0, os.path.dirname(__file__))
import dsr

RAW, OUT = "data/raw", "data"
def load(name):
    n, _, rows = dsr.decode(json.load(open(f"{RAW}/{name}.json")))
    return pd.DataFrame(rows, columns=n)

tables = {}
daily = []
for i in range(1, 25):
    t = "TRT%02d" % i
    d = load(f"diario_{t}"); d["tribunal"] = t; d["data"] = d["data"].map(dsr.to_date); daily.append(d)
tables["minutas_diarias"] = pd.concat(daily)[["data", "tribunal", "minutas"]].dropna().astype({"minutas": int}).sort_values(["data", "tribunal"])

g = load("mensal_grau"); g["ano_mes"] = g["ano_mes"].str.replace("/", "-"); g["grau"] = g["grau"].map({1: "1º Grau", 2: "2º Grau"})
tables["minutas_mensais_grau"] = g.dropna(subset=["minutas"]).astype({"minutas": int}).sort_values(["ano_mes", "tribunal", "grau"])

m = load("mensal_modelo"); m["ano_mes"] = m["ano_mes"].str.replace("/", "-")
m = m[(m.tokens_entrada.fillna(0) > 0) | (m.tokens_saida.fillna(0) > 0)]
tables["tokens_mensais_tribunal_modelo"] = m[["ano_mes", "tribunal", "modelo", "tokens_entrada", "tokens_saida"]].astype({"tokens_entrada": "int64", "tokens_saida": "int64"}).sort_values(["ano_mes", "tribunal", "modelo"])

r = load("mensal_modelo_req"); r["ano_mes"] = r["ano_mes"].str.replace("/", "-")
r = r[r.requisicoes.fillna(0) > 0]
tables["requisicoes_mensais_modelo"] = r.astype({"requisicoes": int, "tokens_entrada": "int64", "tokens_saida": "int64"}).sort_values(["ano_mes", "modelo"])

t = load("tribunal"); tables["totais_tribunal"] = t.dropna(subset=["minutas"]).astype({"minutas": int}).sort_values("tribunal")
tables["totais_jurisdicao"] = load("jurisdicao").astype({"minutas": int})
mr = load("modelo_req"); tables["totais_modelo"] = mr[mr.requisicoes.fillna(0) > 0].astype({"requisicoes": int})

os.makedirs("docs/data", exist_ok=True)
for name, df in tables.items():
    df = df.reset_index(drop=True)
    df.to_csv(f"{OUT}/{name}.csv", index=False)
    df.to_parquet(f"{OUT}/{name}.parquet", index=False)
    df.to_json(f"{OUT}/{name}.json", orient="records", force_ascii=False)
    df.to_json(f"docs/data/{name}.json", orient="records", force_ascii=False)
    df.to_csv(f"docs/data/{name}.csv", index=False)
    print(name, len(df))
tot = load("total").iloc[0]
json.dump({"minutas_distintas": int(tot.minutas), "tokens_entrada": int(tot.tokens_entrada), "tokens_saida": int(tot.tokens_saida),
           "requisicoes": int(tables["totais_modelo"].requisicoes.sum()), "coletado_em": pd.Timestamp(os.path.getmtime(f"{RAW}/total.json"), unit="s", tz="UTC").strftime("%Y-%m-%d"),
           "fonte": "Painel público Power BI do Galileu (TRT4/Justiça do Trabalho)"},
          open("docs/data/resumo.json", "w"), ensure_ascii=False, indent=1)
