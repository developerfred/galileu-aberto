#!/usr/bin/env python3
"""Servidor MCP (stdio, sem dependências) para os dados agregados do Galileu Aberto. GPL-3.0."""
import json, os, sys

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "data")
def load(n): return json.load(open(os.path.join(DATA, n + ".json"), encoding="utf-8"))

def t_resumo(a): return load("resumo")
def t_tribunais(a):
    rows = load("totais_tribunal")
    return [r for r in rows if not a.get("tribunal") or r["tribunal"] == a["tribunal"].upper()]
def t_serie(a):
    rows = [r for r in load("minutas_diarias") if (not a.get("tribunal") or r["tribunal"] == a["tribunal"].upper())
            and (not a.get("inicio") or r["data"] >= a["inicio"]) and (not a.get("fim") or r["data"] <= a["fim"])]
    return rows[:2000]
def t_modelos(a): return load("totais_modelo")
def t_tokens(a):
    return [r for r in load("tokens_mensais_tribunal_modelo") if (not a.get("modelo") or r["modelo"] == a["modelo"])
            and (not a.get("tribunal") or r["tribunal"] == a["tribunal"].upper())][:2000]

def t_custos(a):
    n = {"modelo": "custos_modelo", "tribunal": "custos_tribunal", "mensal": "custos_mensais_modelo"}.get(a.get("por", "modelo"))
    if not n: raise ValueError("por")
    return load(n)

S = lambda props: {"type": "object", "properties": props}
TOOLS = {
 "resumo": ("Totais gerais: minutas distintas, requisições, tokens e data da coleta.", S({}), t_resumo),
 "tribunais": ("Minutas e tokens por tribunal (TRT01..TRT24). Opcional: tribunal.", S({"tribunal": {"type": "string"}}), t_tribunais),
 "serie_diaria": ("Minutas por dia e tribunal. Filtros: tribunal, inicio e fim (AAAA-MM-DD). Minutas não somam entre dias.", S({"tribunal": {"type": "string"}, "inicio": {"type": "string"}, "fim": {"type": "string"}}), t_serie),
 "modelos": ("Requisições e tokens por modelo de IA.", S({}), t_modelos),
 "custos": ("Custo ESTIMADO em USD e BRL (tokens × preço de tabela × PTAX). por: modelo, tribunal ou mensal. O painel original mostra custo 0 para vários modelos.", S({"por": {"type": "string", "enum": ["modelo", "tribunal", "mensal"]}}), t_custos),
 "tokens_mensais": ("Tokens por mês, tribunal e modelo. Filtros: modelo, tribunal.", S({"modelo": {"type": "string"}, "tribunal": {"type": "string"}}), t_tokens),
}

def reply(i, result=None, error=None):
    m = {"jsonrpc": "2.0", "id": i}
    m.update({"error": error} if error else {"result": result})
    sys.stdout.write(json.dumps(m, ensure_ascii=False) + "\n"); sys.stdout.flush()

for line in sys.stdin:
    try: q = json.loads(line)
    except ValueError:
        reply(None, error={"code": -32700, "message": "JSON inválido"}); continue
    if not isinstance(q, dict): reply(None, error={"code": -32600, "message": "requisição inválida"}); continue
    m, i, p = q.get("method"), q.get("id"), q.get("params") or {}
    try:
        if m == "initialize":
            reply(i, {"protocolVersion": p.get("protocolVersion", "2025-03-26"), "capabilities": {"tools": {}}, "serverInfo": {"name": "galileu-aberto", "version": "0.1.0"}})
        elif m == "ping": reply(i, {})
        elif m == "tools/list":
            reply(i, {"tools": [{"name": k, "description": d, "inputSchema": s} for k, (d, s, _) in TOOLS.items()]})
        elif m == "tools/call":
            n = p.get("name")
            if n not in TOOLS: reply(i, error={"code": -32602, "message": "ferramenta desconhecida"}); continue
            try: out = TOOLS[n][2](p.get("arguments") or {})
            except Exception: reply(i, {"isError": True, "content": [{"type": "text", "text": "argumentos inválidos"}]}); continue
            reply(i, {"content": [{"type": "text", "text": json.dumps(out, ensure_ascii=False)}]})
        elif i is not None: reply(i, error={"code": -32601, "message": "método não suportado"})
    except Exception:
        if i is not None: reply(i, error={"code": -32603, "message": "erro interno"})
