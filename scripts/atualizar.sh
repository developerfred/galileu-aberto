#!/usr/bin/env bash
# Atualiza todos os dados a partir do painel público. Rode na raiz do repositório.
# Falha (exit != 0) se qualquer coleta falhar ou a validação não passar: nada ruim é publicado.
set -euo pipefail
mkdir -p data/raw
python3 scripts/fetch_all.py
python3 scripts/fetch_daily.py
python3 scripts/fetch_extra.py
python3 scripts/fetch_cost.py
python3 scripts/build.py
python3 scripts/build_costs.py
python3 scripts/datapackage.py
python3 scripts/validar.py
