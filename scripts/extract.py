#!/usr/bin/env python3
"""Extrai AGREGADOS do painel público Galileu (Power BI). Nunca extrai nr_processo, nome ou id_usuario."""
import json, sys, urllib.request, gzip

KEY = "25955862-b570-48b5-a253-5f9f561930ea"
API = "https://wabi-brazil-south-b-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true"
MODEL_ID = 6337923

def col(src, ent, prop): return {"Column": {"Expression": {"SourceRef": {"Source": src}}, "Property": prop}}
def meas(src, prop): return {"Measure": {"Expression": {"SourceRef": {"Source": src}}, "Property": prop}}

def query(selects, names, limit=30000, tribunal=None):
    sel = [dict(s, Name=n) for s, n in zip(selects, names)]
    where = [{"Condition": {"In": {"Expressions": [col("d", "", "Ano")], "Values": [[{"Literal": {"Value": "2025L"}}], [{"Literal": {"Value": "2026L"}}]]}}}]
    if tribunal: where.append({"Condition": {"In": {"Expressions": [col("t", "", "tribunal_formatado")], "Values": [[{"Literal": {"Value": "'%s'" % tribunal}}]]}}})
    return {"version": "1.0.0", "queries": [{"Query": {"Commands": [{"SemanticQueryDataShapeCommand": {
        "Query": {"Version": 2,
            "From": [{"Name": "d", "Entity": "dm_calendario", "Type": 0},
                     {"Name": "p", "Entity": "galileu_processo", "Type": 0},
                     {"Name": "t", "Entity": "galileu_tribunal", "Type": 0},
                     {"Name": "c", "Entity": "galileu_consumo", "Type": 0},
                     {"Name": "m", "Entity": "medidas", "Type": 0}],
            "Select": sel,
            "Where": where},
        "Binding": {"Primary": {"Groupings": [{"Projections": list(range(len(sel)))}]},
                    "DataReduction": {"DataVolume": 4, "Primary": {"Window": {"Count": limit}}}, "Version": 1}}}]},
        "QueryId": "", "ApplicationContext": {"DatasetId": "f7edf664-3294-432a-a5b3-d30bec3d57e2", "Sources": [{"ReportId": "2cf6178a-adf7-4761-a32c-68a459fbfee5", "VisualId": "428613bed6037cd9006d"}]}}],
        "cancelQueries": [], "modelId": MODEL_ID}

def run(q):
    req = urllib.request.Request(API, json.dumps(q).encode(), {"Content-Type": "application/json", "X-PowerBI-ResourceKey": KEY, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=100) as r:
        b = r.read()
        if r.headers.get("Content-Encoding") == "gzip": b = gzip.decompress(b)
    return json.loads(b)

if __name__ == "__main__":
    print("Use fetch_all.py, fetch_daily.py e fetch_extra.py; depois build.py.")
