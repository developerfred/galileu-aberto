#!/usr/bin/env python3
"""Gera datapackage.json (Frictionless) a partir dos CSVs de docs/data."""
import json, glob, os
import pandas as pd
DESC = {"minutas_diarias": "Minutas (processos distintos) por dia e tribunal. Não somam entre dias.", "minutas_mensais_grau": "Minutas por mês, tribunal e grau.",
 "tokens_mensais_tribunal_modelo": "Tokens por mês, tribunal e modelo.", "requisicoes_mensais_modelo": "Requisições (somam normalmente) e tokens por mês e modelo.",
 "totais_tribunal": "Totais por tribunal.", "totais_jurisdicao": "Totais por jurisdição.", "totais_modelo": "Totais por modelo.",
 "custos_mensais_modelo": "Custo estimado (USD e BRL) por mês e modelo: tokens × preço de tabela × PTAX média do mês.",
 "custos_mensais_tribunal_modelo": "Custo estimado por mês, tribunal e modelo.", "custos_tribunal": "Custo estimado e custo por minuta por tribunal.",
 "custos_modelo": "Custo ESTIMADO (não oficial) por modelo, com os preços usados e sua fonte.", "ptax_mensal": "Cotação PTAX (venda) média mensal, Banco Central."}
COL = {"data": "Dia (AAAA-MM-DD).", "ano_mes": "Mês (AAAA-MM).", "tribunal": "Tribunal Regional do Trabalho, TRT01 a TRT24.", "grau": "Grau de jurisdição: 1º Grau ou 2º Grau.",
 "jurisdicao": "1º Grau, 2º Grau ou Admis. RR (admissibilidade de recurso de revista).", "modelo": "Modelo de IA usado (nome da API do Google).",
 "minutas": "Processos distintos com minuta gerada. NÃO soma entre dias, meses ou graus; só os totais por tribunal e por jurisdição somam o total oficial.",
 "requisicoes": "Pedidos feitos ao modelo. Somam normalmente; uma minuta pode gerar várias.", "tokens_entrada": "Tokens enviados ao modelo (unidade: token).",
 "tokens_saida": "Tokens gerados pelo modelo (unidade: token).", "usd_estimado": "Custo estimado em dólares (US$): tokens × preço de tabela.",
 "brl_estimado": "Custo estimado em reais (R$): usd_estimado × PTAX média do mês.", "ptax_venda_media": "Cotação PTAX de venda, média do mês (R$ por US$).",
 "ptax_fonte": "'media do mes' ou 'ultima media disponivel' (mês corrente sem cotação).", "preco_entrada_usd_milhao": "Preço usado, US$ por milhão de tokens de entrada.",
 "preco_saida_usd_milhao": "Preço usado, US$ por milhão de tokens de saída.", "preco_fonte": "Origem do preço: painel, tabela Google (data) ou assumido (suposição, ver README).",
 "brl_por_minuta": "Custo estimado em R$ dividido pelas minutas distintas do tribunal."}
res = []
for n, t in DESC.items():
    df = pd.read_csv(f"docs/data/{n}.csv")
    ty = lambda c: "integer" if pd.api.types.is_integer_dtype(df[c]) else "number" if pd.api.types.is_float_dtype(df[c]) else "string"
    res.append({"name": n, "path": n + ".csv", "format": "csv", "mediatype": "text/csv", "description": t, "schema": {"fields": [{"name": c, "type": ty(c), "description": COL.get(c, "")} for c in df.columns]}})
pkg = {"name": "galileu-aberto", "title": "Galileu Aberto", "version": "0.2.0", "homepage": "https://developerfred.github.io/galileu-aberto/",
       "licenses": [{"name": "GPL-3.0-or-later", "path": "https://www.gnu.org/licenses/gpl-3.0.html"}],
       "sources": [{"title": "Painel público do Galileu (Power BI)", "path": "https://app.powerbi.com/view?r=eyJrIjoiMjU5NTU4NjItYjU3MC00OGI1LWEyNTMtNWY5ZjU2MTkzMGVhIiwidCI6ImIyY2FlYjA4LTI4N2QtNGFmNi1iYjBhLTg4ZmE3N2IyOWIwNiJ9"},
                   {"title": "Preços da API Gemini", "path": "https://ai.google.dev/gemini-api/docs/pricing"}, {"title": "PTAX, Banco Central do Brasil"}],
       "resources": res}
for p in ("docs/data", "data"): json.dump(pkg, open(f"{p}/datapackage.json", "w"), ensure_ascii=False, indent=1)
print(len(res), "recursos")
