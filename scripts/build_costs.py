#!/usr/bin/env python3
"""Estima custo (USD e BRL) por tokens × preço de tabela. O painel só precifica alguns modelos (os demais vêm com custo 0)."""
import datetime, json, os, urllib.request, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pandas as pd

PRECOS = {  # USD por 1 milhão de tokens: (entrada, saída, fonte)
    "gemini-1.5-flash-002": (0.075, 0.30, "painel"), "gemini-1.5-pro-002": (1.25, 5.00, "painel"),
    "gemini-2.0-flash-001": (0.075, 0.30, "painel"), "gemini-2.0-flash-lite-001": (0.0375, 0.15, "painel"),
    "gemini-2.5-flash": (0.30, 2.50, "tabela Google 2026-10-30"), "gemini-2.5-flash-lite": (0.10, 0.40, "tabela Google 2026-10-30"),
    "gemini-3-flash-preview": (0.50, 3.00, "tabela Google 2026-10-30"), "gemini-3.1-flash-lite": (0.25, 1.50, "tabela Google 2026-10-30"),
    "gemini-3.1-flash-lite-preview": (0.25, 1.50, "assumido: igual ao 3.1 Flash-Lite da tabela"),
    "gemini-3.5-flash-lite": (0.30, 2.50, "tabela Google 2026-10-30"),
    "gemini-3.7-flash": (0.75, 3.75, "assumido: igual ao 3.6 Flash da tabela"),
}
d = "docs/data/"
url = ("https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
       "?@dataInicial='01-01-2025'&@dataFinalCotacao='" + datetime.date.today().strftime('%m-%d-%Y') + "'&$format=json")
ptax = pd.DataFrame(json.load(urllib.request.urlopen(url, timeout=60))["value"])
ptax["ano_mes"] = ptax.dataHoraCotacao.str[:7]
ptax = ptax.groupby("ano_mes").cotacaoVenda.mean().round(4).rename("ptax_venda_media").reset_index()
# meses ainda sem cotação (mês corrente) usam a última média disponível
meses = pd.period_range("2025-01", pd.Timestamp.today().strftime("%Y-%m"), freq="M").astype(str)
ptax = ptax.set_index("ano_mes").reindex(meses).rename_axis("ano_mes")
ptax["ptax_fonte"] = ptax.ptax_venda_media.map(lambda v: "media do mes" if pd.notna(v) else "ultima media disponivel")
ptax["ptax_venda_media"] = ptax.ptax_venda_media.ffill()
ptax = ptax.reset_index()

def add(df):
    p = df.modelo.map(lambda m: PRECOS[m])
    df["usd_estimado"] = (df.tokens_entrada * p.map(lambda x: x[0]) + df.tokens_saida * p.map(lambda x: x[1])) / 1e6
    df = df.merge(ptax[["ano_mes", "ptax_venda_media"]], on="ano_mes", how="left")
    df["brl_estimado"] = df.usd_estimado * df.ptax_venda_media
    return df

mm = add(pd.read_json(d + "requisicoes_mensais_modelo.json"))
tt = add(pd.read_json(d + "tokens_mensais_tribunal_modelo.json"))
assert mm.brl_estimado.notna().all() and tt.brl_estimado.notna().all()
trib = tt.groupby("tribunal")[["tokens_entrada", "tokens_saida", "usd_estimado", "brl_estimado"]].sum().reset_index()
mn = pd.read_json(d + "totais_tribunal.json")[["tribunal", "minutas"]]
trib = trib.merge(mn, on="tribunal"); trib["brl_por_minuta"] = trib.brl_estimado / trib.minutas
modelo = mm.groupby("modelo")[["requisicoes", "tokens_entrada", "tokens_saida", "usd_estimado", "brl_estimado"]].sum().reset_index()
modelo["preco_entrada_usd_milhao"] = modelo.modelo.map(lambda m: PRECOS[m][0]); modelo["preco_saida_usd_milhao"] = modelo.modelo.map(lambda m: PRECOS[m][1])
modelo["preco_fonte"] = modelo.modelo.map(lambda m: PRECOS[m][2])
R2 = lambda df: df.round({c: 2 for c in ("usd_estimado", "brl_estimado", "brl_por_minuta") if c in df.columns})
mm, tt, trib, modelo = map(R2, (mm, tt, trib, modelo))
out = {"custos_mensais_modelo": mm, "custos_mensais_tribunal_modelo": tt, "custos_tribunal": trib, "custos_modelo": modelo, "ptax_mensal": ptax}
for n, df in out.items():
    df.to_csv(f"{d}{n}.csv", index=False); df.to_json(f"{d}{n}.json", orient="records", force_ascii=False)
    df.to_csv(f"data/{n}.csv", index=False); df.to_json(f"data/{n}.json", orient="records", force_ascii=False); df.to_parquet(f"data/{n}.parquet", index=False)
    print(n, len(df))
import dsr
painel = round(float(dsr.decode(json.load(open("data/raw/custo_total.json")))[2][0][2]), 2)
r = json.load(open(d + "resumo.json"))
r.update({"custo_usd_estimado": round(float(mm.usd_estimado.sum()), 2), "custo_brl_estimado": round(float(mm.brl_estimado.sum()), 2),
          "custo_usd_painel": painel, "minutas_distintas_base_custo": r["minutas_distintas"]})
json.dump(r, open(d + "resumo.json", "w"), ensure_ascii=False, indent=1); json.dump(r, open("data/resumo.json", "w"), ensure_ascii=False, indent=1)
print(r["custo_usd_estimado"], r["custo_brl_estimado"], round(r["custo_brl_estimado"] / r["minutas_distintas"], 2))
