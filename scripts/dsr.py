"""Decodifica o formato DSR (compactado) das respostas querydata do Power BI."""
import datetime as dt

def decode(resp):
    data = resp["results"][0]["result"]["data"]
    names = [s["Name"] for s in data["descriptor"]["Select"]]
    ds = data["dsr"]["DS"][0]
    dicts = ds.get("ValueDicts", {})
    rows, prev, schema = [], None, None
    for row in ds["PH"][0]["DM0"]:
        if "S" in row: schema = row["S"]
        n = len(schema)
        rmask, nmask = row.get("R", 0), row.get("Ø", 0)
        c = iter(row.get("C", []))
        cur = []
        for i in range(n):
            if nmask >> i & 1: cur.append(None)
            elif rmask >> i & 1: cur.append(prev[i])
            else:
                v = next(c)
                dn = schema[i].get("DN")
                cur.append(dicts[dn][v] if dn else v)
        rows.append(cur); prev = cur
    return names, schema, rows

def to_date(ms): return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).date().isoformat()
