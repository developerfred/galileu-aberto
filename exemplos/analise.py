"""Reproduz os números principais do Galileu Aberto. Precisa de pandas (e pyarrow só para ler Parquet).
Uso: python3 exemplos/analise.py   (rode na raiz do repositório)"""
import pandas as pd

tri = pd.read_csv("data/totais_tribunal.csv")
print("Minutas distintas (somam por tribunal):", tri.minutas.sum())            # 458696

cm = pd.read_csv("data/custos_modelo.csv")
print("Custo estimado total, R$:", round(cm.brl_estimado.sum(), 2))             # custo ESTIMADO, não oficial
print("Requisições:", cm.requisicoes.sum())                                     # requisições somam
print("R$ por minuta:", round(cm.brl_estimado.sum() / tri.minutas.sum(), 2))

cm["brl_por_requisicao"] = cm.brl_estimado / cm.requisicoes                      # ranking muda: total x unitário
print(cm.sort_values("brl_estimado", ascending=False)[["modelo", "brl_estimado", "brl_por_requisicao"]].head())

dia = pd.read_csv("data/minutas_diarias.csv")
print("ATENÇÃO: soma diária =", dia.minutas.sum(), "(não é o total oficial; o mesmo processo aparece em vários dias)")
