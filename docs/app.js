const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n).toLocaleString("pt-BR");
const short = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + " bi" : n >= 1e6 ? (n / 1e6).toFixed(1) + " mi" : n >= 1e3 ? (n / 1e3).toFixed(1) + " mil" : String(n)).replace(".", ",");
const load = (n) => fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); });
const PAL = ["#2563eb", "#0d9488", "#b45309", "#e11d48", "#7c3aed", "#16a34a", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569", "#a16207", "#4f46e5"];
const charts = {};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function draw(id, cfg) {
  if (charts[id]) charts[id].destroy();
  Chart.defaults.color = css("--mut");
  Chart.defaults.borderColor = css("--line");
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false }, cfg.options);
  charts[id] = new Chart($("#" + id), cfg);
}

const tabs = [...document.querySelectorAll("nav button")];
function show(t, focus) {
  tabs.forEach((b) => { const on = b.dataset.t === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); if (on) b.scrollIntoView({ inline: "center", block: "nearest" }); });
  document.querySelectorAll("main section").forEach((s) => (s.hidden = s.id !== t));
  history.replaceState(null, "", "#" + t);
  Object.values(charts).forEach((c) => c.resize());
}
tabs.forEach((b, i) => {
  b.addEventListener("click", () => show(b.dataset.t));
  b.addEventListener("keydown", (e) => {
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    show(tabs[(k + tabs.length) % tabs.length].dataset.t, true);
  });
});

async function init() {
  const [resumo, diarias, jur, trib, modelos, reqm, tok] = await Promise.all(
    ["resumo", "minutas_diarias", "totais_jurisdicao", "totais_tribunal", "totais_modelo", "requisicoes_mensais_modelo", "tokens_mensais_tribunal_modelo"].map(load));
  $("#when").textContent = resumo.coletado_em.replace("T", " ").replace("Z", " UTC");
  const kp = [[resumo.minutas_distintas, "minutas (processos distintos)"], [resumo.requisicoes, "requisições aos modelos"],
    [short(resumo.tokens_entrada), "tokens de entrada"], [short(resumo.tokens_saida), "tokens de saída"]];
  $("#kpis").innerHTML = kp.map(([v, l]) => `<div class="card kpi"><b>${typeof v === "number" ? fmt(v) : v}</b><span>${l}</span></div>`).join("");

  const byDay = {}, byMonth = {};
  diarias.forEach((r) => { byDay[r.data] = (byDay[r.data] || 0) + r.minutas; const m = r.data.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + r.minutas; });
  const days = Object.keys(byDay).sort(), months = Object.keys(byMonth).sort();
  draw("c-mes", { type: "bar", data: { labels: months, datasets: [{ label: "Minutas (soma diária)", data: months.map((m) => byMonth[m]), backgroundColor: PAL[0] }] }, options: { plugins: { legend: { display: false } } } });
  draw("c-jur", { type: "doughnut", data: { labels: jur.map((r) => r.jurisdicao), datasets: [{ data: jur.map((r) => r.minutas), backgroundColor: PAL }] } });
  draw("c-dia", { type: "line", data: { labels: days, datasets: [{ label: "Minutas", data: days.map((d) => byDay[d]), borderColor: PAL[0], pointRadius: 0, borderWidth: 1.5, fill: false }] }, options: { plugins: { legend: { display: false } }, interaction: { intersect: false, mode: "index" } } });

  const ts = trib.slice().sort((a, b) => b.minutas - a.minutas);
  draw("c-trib", { type: "bar", data: { labels: ts.map((r) => r.tribunal), datasets: [{ label: "Minutas", data: ts.map((r) => r.minutas), backgroundColor: PAL[1] }] }, options: { plugins: { legend: { display: false } } } });
  $("#sel-trib").innerHTML = `<option value="">Todos (barras)</option>` + ts.map((r) => `<option value="${esc(r.tribunal)}">${esc(r.tribunal)}</option>`).join("");
  $("#sel-trib").addEventListener("change", (e) => {
    const t = e.target.value;
    if (!t) return draw("c-trib", { type: "bar", data: { labels: ts.map((r) => r.tribunal), datasets: [{ label: "Minutas", data: ts.map((r) => r.minutas), backgroundColor: PAL[1] }] }, options: { plugins: { legend: { display: false } } } });
    const rows = diarias.filter((r) => r.tribunal === t).sort((a, b) => a.data.localeCompare(b.data));
    draw("c-trib", { type: "line", data: { labels: rows.map((r) => r.data), datasets: [{ label: t, data: rows.map((r) => r.minutas), borderColor: PAL[1], pointRadius: 0, borderWidth: 1.5 }] }, options: { interaction: { intersect: false, mode: "index" } } });
  });
  $("#t-trib").innerHTML = `<tr><th>Tribunal</th><th>Minutas</th><th>Tokens entrada</th><th>Tokens saída</th></tr>` +
    ts.map((r) => `<tr><td>${esc(r.tribunal)}</td><td>${fmt(r.minutas)}</td><td>${short(r.tokens_entrada)}</td><td>${short(r.tokens_saida)}</td></tr>`).join("");

  const ms = modelos.slice().sort((a, b) => b.requisicoes - a.requisicoes);
  draw("c-mod", { type: "bar", data: { labels: ms.map((r) => r.modelo), datasets: [{ label: "Requisições", data: ms.map((r) => r.requisicoes), backgroundColor: PAL[2] }] }, options: { indexAxis: "y", plugins: { legend: { display: false } } } });
  const mm = [...new Set(reqm.map((r) => r.ano_mes))].sort();
  const names = [...new Set(reqm.map((r) => r.modelo))];
  draw("c-tok", { type: "bar", data: { labels: mm, datasets: names.map((n, i) => ({ label: n, backgroundColor: PAL[i % PAL.length], data: mm.map((m) => { const r = reqm.find((x) => x.ano_mes === m && x.modelo === n); return r ? +(r.tokens_entrada / 1e9).toFixed(2) : 0; }) })) }, options: { scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "bilhões de tokens" } } }, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } } });
  $("#t-mod").innerHTML = `<tr><th>Modelo</th><th>Requisições</th><th>Tokens entrada</th><th>Tokens saída</th><th>Tokens saída/req.</th></tr>` +
    ms.map((r) => `<tr><td>${esc(r.modelo)}</td><td>${fmt(r.requisicoes)}</td><td>${short(r.tokens_entrada)}</td><td>${short(r.tokens_saida)}</td><td>${fmt(Math.round(r.tokens_saida / r.requisicoes))}</td></tr>`).join("");

  const names2 = ["resumo", "minutas_diarias", "minutas_mensais_grau", "tokens_mensais_tribunal_modelo", "requisicoes_mensais_modelo", "totais_tribunal", "totais_jurisdicao", "totais_modelo"];
  $("#files").innerHTML = names2.map((n) => `<li><code>${n}</code> — <a href="data/${n}.json">JSON</a>${n === "resumo" ? "" : ` · <a href="data/${n}.csv">CSV</a>`}</li>`).join("");
  document.querySelectorAll(".origin").forEach((e) => (e.textContent = location.origin.startsWith("http") ? location.origin + location.pathname.replace(/\/[^/]*$/, "") : e.textContent));
}
init().catch((e) => {
  const c = document.createElement("div"); c.className = "card"; c.setAttribute("role", "alert");
  c.textContent = window.Chart ? `Não foi possível carregar os dados (${e.message}). Abra por um servidor HTTP.` : "Não foi possível carregar a biblioteca de gráficos.";
  $("#kpis").replaceChildren(c);
});

// ---- Chat (a chave fica só em sessionStorage; chamada direta ao Google) ----
const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash"];
$("#model").innerHTML = MODELS.map((m) => `<option>${m}</option>`).join("");
try { $("#key").value = sessionStorage.getItem("gk") || ""; } catch {}
$("#key").addEventListener("input", (e) => { try { sessionStorage.setItem("gk", e.target.value.trim()); } catch {} });
let hist = [], busy = false;
const add = (cls, t) => { const d = document.createElement("div"); d.className = "m " + cls; d.textContent = t; $("#msgs").append(d); $("#msgs").scrollTop = 1e9; return d; };
$("#clear").onclick = () => { hist = []; $("#msgs").innerHTML = ""; };
async function send() {
  if (busy) return;
  const text = $("#in").value.trim(), key = $("#key").value.trim();
  if (!text) return;
  if (!key) { $("#st").textContent = "Informe sua chave de API."; $("#key").focus(); return; }
  $("#in").value = ""; add("u", text); hist.push({ role: "user", parts: [{ text }] });
  const out = add("a", "…"); busy = true; $("#send").disabled = true; $("#st").textContent = "Gerando…";
  try {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 60000);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent($("#model").value)}:generateContent`, {
      method: "POST", signal: ac.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: $("#sys").value }] }, contents: hist }) });
    clearTimeout(to);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error?.message || r.status);
    const a = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
    if (!a) { hist.pop(); out.textContent = "Sem resposta" + (j.promptFeedback?.blockReason ? ` (bloqueado: ${j.promptFeedback.blockReason})` : "") + "."; $("#st").textContent = ""; }
    else { out.textContent = a; hist.push({ role: "model", parts: [{ text: a }] }); $("#st").textContent = ""; }
  } catch (e) { out.textContent = "Erro: " + (e.name === "AbortError" ? "tempo esgotado." : /API key not valid|API_KEY_INVALID/i.test(e.message) ? "chave de API inválida." : /quota|429|exhausted/i.test(e.message) ? "limite de uso da sua chave atingido; tente mais tarde." : /permission|403/i.test(e.message) ? "sem permissão para este modelo com sua chave." : e.message); hist.pop(); $("#st").textContent = ""; }
  busy = false; $("#send").disabled = false;
}
$("#send").onclick = send;
$("#in").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); });
if (location.hash.length > 1 && document.getElementById(location.hash.slice(1))) show(location.hash.slice(1));
