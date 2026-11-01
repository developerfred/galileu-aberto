#!/usr/bin/env python3
"""Barreira de sanidade antes de publicar. Sai com erro se algo não bate."""
import json, sys
import pandas as pd
d = "docs/data/"
r = json.load(open(d + "resumo.json"))
tri = pd.read_csv(d + "totais_tribunal.csv"); jur = pd.read_csv(d + "totais_jurisdicao.csv")
tok = pd.read_csv(d + "tokens_mensais_tribunal_modelo.csv"); cm = pd.read_csv(d + "custos_modelo.csv"); cmm = pd.read_csv(d + "custos_mensais_modelo.csv")
erros = []
chk = lambda ok, msg: ok or erros.append(msg)
chk(tri.tribunal.nunique() == 24, "esperava 24 tribunais")
chk(tri.minutas.sum() == r["minutas_distintas"], "minutas por tribunal != total oficial")
chk(jur.minutas.sum() == r["minutas_distintas"], "minutas por jurisdição != total oficial")
chk(tok.tokens_entrada.sum() == r["tokens_entrada"] and tok.tokens_saida.sum() == r["tokens_saida"], "tokens por tribunal×modelo != total oficial")
chk(cmm.requisicoes.sum() == r["requisicoes"] == cm.requisicoes.sum(), "requisições inconsistentes entre tabelas")
chk(abs(cm.brl_estimado.sum() - cmm.brl_estimado.sum()) < 1, "custo BRL inconsistente")
chk(cmm.brl_estimado.notna().all() and (cmm.brl_estimado >= 0).all(), "custo com nulos ou negativos")
if erros: print("FALHOU:\n- " + "\n- ".join(erros)); sys.exit(1)
print("validação ok:", r["minutas_distintas"], "minutas;", r["requisicoes"], "requisições")
