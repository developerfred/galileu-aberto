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

const tabs = [...document.querySelectorAll("nav [role=tab]")];
const TITLE = document.title;
async function show(t, focus) {
  tabs.forEach((b) => { const on = b.dataset.t === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); if (on) b.scrollIntoView({ inline: "center", block: "nearest" }); });
  document.querySelectorAll("main section").forEach((s) => (s.hidden = s.id !== t));
  history.replaceState(null, "", "#" + t);
  document.title = (tabs.find((b) => b.dataset.t === t)?.textContent || "") + " · " + TITLE;
  Object.values(charts).forEach((c) => c.resize());
  if (t === "d3") import("./viz3d.js").then((m) => (window.GD ? m.init() : window.addEventListener("gd-ready", () => m.init(), { once: true }))).catch(() => { const m = $("#d3-msg"); m.hidden = false; m.textContent = "Não foi possível carregar o 3D. Use as outras abas."; });
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
const fromHash = () => { const t = location.hash.slice(1); show(tabs.some((b) => b.dataset.t === t) ? t : "geral"); };
window.addEventListener("hashchange", fromHash);
if (location.hash.length > 1) fromHash();
