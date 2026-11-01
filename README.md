# Galileu Aberto

Dados agregados do uso do Galileu (Justiça do Trabalho), abertos para pessoas e agentes de IA, mais um chat open source para testar modelos Gemini. Projeto **independente**, sem vínculo oficial com o TRT4.

- **Site (GitHub Pages):** pasta `docs/`
- **Dados:** `data/` (CSV, JSON, Parquet) e `docs/data/` (CSV, JSON)
- **Agentes:** `docs/llms.txt`, `docs/data/datapackage.json`, servidor MCP em `mcp/server.py`
- **Coleta:** `scripts/` (consulta o painel público; veja `scripts/build.py`)

## Custo e água
- **Custo é estimativa a preço de lista (teto provável):** tokens × preço de tabela público de cada modelo × PTAX média do mês. O painel original zera o custo dos modelos mais usados; a fonte de cada preço está em `custos_modelo`. Limites: usa o preço atual para todo o período; não modela faixas de contexto longo, cache, lote nem contrato; não sabemos se "tokens de saída" incluem raciocínio (cobrado como saída); preços dos modelos 2.0 vêm do painel e podem diferir da tabela atual do Google.
- **Água é referência, não medição:** Google informou 0,26 mL e 0,24 Wh por prompt de texto mediano do Gemini (ago/2025). O site usa isso como piso, com multiplicador. Custo e água correlacionam por construção (ambos seguem as requisições).

## Água
O 0,26 mL do Google vale para o aplicativo Gemini (mediana, só resfriamento do data center) e não foi medido para estes modelos. Os multiplicadores do site são exemplos, não medições.

## Atualização
`scripts/atualizar.sh` refaz tudo; `.github/workflows/atualizar.yml` roda toda segunda-feira.

## Quais números somam
| Tabela | Soma? |
|---|---|
| `totais_tribunal`, `totais_jurisdicao` | Somam o total oficial de minutas (458.696) |
| `minutas_diarias`, `minutas_mensais_grau` | **Não** somam: o mesmo processo aparece em vários dias, meses e graus |
| `requisicoes_*`, tokens | Somam normalmente |
| `custos_*` | Somam; são estimativas |

Custo por minuta = custo estimado total ÷ minutas distintas (não é custo por processo). Total e custo por requisição dão rankings diferentes de "modelo mais caro".

## Usar os dados
- Exemplo em pandas: `python3 exemplos/analise.py`. Ler Parquet exige `pip install pyarrow`.
- Cada coluna está descrita em `data/datapackage.json` (unidade, valores, observações).
- **Versão:** cada commit é um snapshot; fixe pelo hash do commit ou por uma tag. A coleta é semanal e os valores podem mudar.
- Citação: veja `CITATION.cff`.
- "assumido" em `preco_fonte`: preço sem lista pública (gemini-3.1-flash-lite-preview e gemini-3.7-flash, volume pequeno); usamos o de um modelo irmão.
- Dados vindos de órgão público: a licença do painel de origem não é declarada; a GPL-3.0 vale para o que criamos (código, conversões, estimativas).

## Privacidade
Só agregados. Células pequenas (por exemplo 1 minuta num dia) existem, mas já são visíveis no painel público de origem; não identificam pessoas, e o início de 2025 foi um piloto em um único tribunal. O modelo do painel contém nomes de usuários e números de processo; esses campos **nunca** são extraídos. Texto de minutas não está disponível e não é publicado.

## Como interpretar
`minutas` = processos distintos (contagem distinta de `id_processo`), não somam entre períodos. `requisicoes` = linhas da tabela de consumo do painel (contagem de linhas; confirmamos que o total não depende da coluna contada). É uma linha por registro de uso do modelo; a razão com as minutas era 2,0 no início e hoje é cerca de 2,4.

## MCP
```json
{"mcpServers":{"galileu-aberto":{"command":"python3","args":["/caminho/mcp/server.py"]}}}
```

## Licença
GPL-3.0 para código e dados (arquivo `LICENSE`).
