#!/usr/bin/env python3
"""Custo que o PRÓPRIO painel calcula (USD). Serve só para comparar com a nossa estimativa."""
import json, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import extract as e
M = lambda n: e.meas("m", n)
q = e.query([M("Valor Tokens Entrada $"), M("Valor Tokens Saida $"), M("Valor Tokens $")], ["usd_entrada", "usd_saida", "usd_total"])
json.dump(e.run(q), open("data/raw/custo_total.json", "w"))
print("custo_total ok")
