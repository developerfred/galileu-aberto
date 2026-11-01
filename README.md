# Galileu Aberto

Dados agregados do uso do Galileu (Justiça do Trabalho), abertos para pessoas e agentes de IA, mais um chat open source para testar modelos Gemini. Projeto **independente**, sem vínculo oficial com o TRT4.

- **Site (GitHub Pages):** pasta `docs/`
- **Dados:** `data/` (CSV, JSON, Parquet) e `docs/data/` (CSV, JSON)
- **Agentes:** `docs/llms.txt`, `docs/data/datapackage.json`, servidor MCP em `mcp/server.py`
- **Coleta:** `scripts/` (consulta o painel público; veja `scripts/build.py`)

## Privacidade
Só agregados. O modelo do painel contém nomes de usuários e números de processo; esses campos **nunca** são extraídos. Texto de minutas não está disponível e não é publicado.

## Como interpretar
`minutas` = processos distintos, não somam entre períodos. `requisicoes` = chamadas aos modelos.

## MCP
```json
{"mcpServers":{"galileu-aberto":{"command":"python3","args":["/caminho/mcp/server.py"]}}}
```

## Licença
GPL-3.0 para código e dados (arquivo `LICENSE`).
