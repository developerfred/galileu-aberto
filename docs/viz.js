// Gráficos e textos de dados. Depende de helpers do app.js (esc, $, fmt, short, load, draw, PAL, charts).
const D = {};
let moeda = "brl";
const brl = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: n < 100 ? 2 : 0 });
const usd = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 });
const money = (n) => (moeda === "brl" ? brl(n) : usd(n));
const val = (r) => (moeda === "brl" ? r.brl_estimado : r.usd_estimado);
const num1 = (n, d = 1) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });

function alt(id, headers, rows, label = "Ver os números em tabela") {
  const el = $("#" + id); if (!el) return;
  el.innerHTML = `<details class="alt"><summary>${esc(label)}</summary><div style="overflow:auto"><table><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div></details>`;
}
const frase = (id, t) => { const el = $("#" + id); if (el) el.textContent = t; };

function topN(items, valueOf, n = 5) {
  const sorted = items.slice().sort((a, b) => valueOf(b) - valueOf(a));
  return { top: sorted.slice(0, n), outros: sorted.slice(n) };
}
const CINZA = "#8892a3";

function pearson(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
}

function renderGeral() {
  const { resumo, diarias, jur, trib } = D;
  const byDay = {}, byMonth = {};
  diarias.forEach((r) => { byDay[r.data] = (byDay[r.data] || 0) + r.minutas; const m = r.data.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + r.minutas; });
  const days = Object.keys(byDay).sort(), months = Object.keys(byMonth).sort();
  const ts = trib.slice().sort((a, b) => b.minutas - a.minutas);
  const pico = months.reduce((a, b) => (byMonth[a] >= byMonth[b] ? a : b));

  $("#tldr-list").innerHTML = [
    `A IA gerou minutas (rascunhos que o juiz revisa) para <b>${fmt(resumo.minutas_distintas)} processos</b> desde janeiro de 2025.`,
    `O uso cresce rápido: o mês mais movimentado até agora foi <b>${esc(pico)}</b>.`,
    `Maior usuário: <b>${esc(ts[0].tribunal)}</b>, com ${fmt(ts[0].minutas)} minutas.`,
    `Custo estimado a preço de lista: <b>${brl(resumo.custo_brl_estimado)}</b>, ou <b>${brl(resumo.custo_brl_estimado / resumo.minutas_distintas)} por processo com minuta</b>.`,
  ].map((t) => `<li>${t}</li>`).join("");

  const kp = [[fmt(resumo.minutas_distintas), "minutas (processos distintos)"], [fmt(resumo.requisicoes), "requisições aos modelos"],
    [short(resumo.tokens_entrada), "tokens de entrada"], [short(resumo.tokens_saida), "tokens de saída"]];
  $("#kpis").innerHTML = kp.map(([v, l]) => `<div class="card kpi"><b>${v}</b><span>${l}</span></div>`).join("");

  draw("c-mes", { type: "bar", data: { labels: months, datasets: [{ label: "Minutas (soma diária)", data: months.map((m) => byMonth[m]), backgroundColor: PAL[0] }] }, options: { plugins: { legend: { display: false } } } });
  alt("alt-mes", ["Mês", "Minutas (soma diária)"], months.map((m) => [m, fmt(byMonth[m])]));
  draw("c-jur", { type: "doughnut", data: { labels: jur.map((r) => r.jurisdicao), datasets: [{ data: jur.map((r) => r.minutas), backgroundColor: PAL }] } });
  alt("alt-jur", ["Jurisdição", "Minutas"], jur.map((r) => [r.jurisdicao, fmt(r.minutas)]));
  draw("c-dia", { type: "line", data: { labels: days, datasets: [{ label: "Minutas", data: days.map((d) => byDay[d]), borderColor: PAL[0], pointRadius: 0, borderWidth: 1.5 }] }, options: { plugins: { legend: { display: false } }, interaction: { intersect: false, mode: "index" } } });
  alt("alt-dia", ["Dia", "Minutas"], days.slice(-60).map((d) => [d, fmt(byDay[d])]), "Ver os últimos 60 dias em tabela");
  frase("s-mes", "O uso cresce rápido. Os dias somados passam do total oficial: veja “Como ler”.");
  frase("s-jur", "O 1º Grau é a maior fatia; o resto é 2º Grau e admissibilidade de recurso de revista (RR).");
}

function renderTribunais() {
  const { diarias, trib } = D;
  const ts = trib.slice().sort((a, b) => b.minutas - a.minutas);
  const bars = () => draw("c-trib", { type: "bar", data: { labels: ts.map((r) => r.tribunal), datasets: [{ label: "Minutas", data: ts.map((r) => r.minutas), backgroundColor: PAL[1] }] }, options: { plugins: { legend: { display: false } } } });
  const sel = $("#sel-trib");
  if (!sel.options.length) {
    sel.innerHTML = `<option value="">Todos (barras)</option>` + ts.map((r) => `<option value="${esc(r.tribunal)}">${esc(r.tribunal)}</option>`).join("");
    sel.addEventListener("change", renderTribunais);
  }
  const t = sel.value;
  if (!t) { bars(); alt("alt-trib", ["Tribunal", "Minutas"], ts.map((r) => [r.tribunal, fmt(r.minutas)])); }
  else {
    const rows = diarias.filter((r) => r.tribunal === t).sort((a, b) => a.data.localeCompare(b.data));
    draw("c-trib", { type: "line", data: { labels: rows.map((r) => r.data), datasets: [{ label: t, data: rows.map((r) => r.minutas), borderColor: PAL[1], pointRadius: 0, borderWidth: 1.5 }] }, options: { interaction: { intersect: false, mode: "index" } } });
    alt("alt-trib", ["Dia", "Minutas"], rows.slice(-60).map((r) => [r.data, fmt(r.minutas)]), "Ver os últimos 60 dias em tabela");
  }
  $("#t-trib").innerHTML = `<tr><th>Tribunal</th><th>Minutas</th><th>Tokens entrada</th><th>Tokens saída</th></tr>` +
    ts.map((r) => `<tr><td>${esc(r.tribunal)}</td><td>${fmt(r.minutas)}</td><td>${short(r.tokens_entrada)}</td><td>${short(r.tokens_saida)}</td></tr>`).join("");
}

function renderModelos() {
  const { modelos, reqm } = D;
  const ms = modelos.slice().sort((a, b) => b.requisicoes - a.requisicoes);
  draw("c-mod", { type: "bar", data: { labels: ms.map((r) => r.modelo), datasets: [{ label: "Requisições", data: ms.map((r) => r.requisicoes), backgroundColor: PAL[2] }] }, options: { indexAxis: "y", plugins: { legend: { display: false } } } });
  alt("alt-mod", ["Modelo", "Requisições"], ms.map((r) => [r.modelo, fmt(r.requisicoes)]));
  const mm = [...new Set(reqm.map((r) => r.ano_mes))].sort(), names = [...new Set(reqm.map((r) => r.modelo))];
  const g = (m, n) => { const r = reqm.find((x) => x.ano_mes === m && x.modelo === n); return r ? +(r.tokens_entrada / 1e9).toFixed(2) : 0; };
  const tk = topN(ms, (r) => r.tokens_entrada, 5), tkNames = tk.top.map((r) => r.modelo), outNames = tk.outros.map((r) => r.modelo);
  const tkSets = tkNames.map((n, i) => ({ label: n, backgroundColor: PAL[i], data: mm.map((m) => g(m, n)) }));
  if (outNames.length) tkSets.push({ label: "Outros modelos", backgroundColor: CINZA, data: mm.map((m) => +outNames.reduce((a, n) => a + g(m, n), 0).toFixed(2)) });
  draw("c-tok", { type: "bar", data: { labels: mm, datasets: tkSets }, options: { scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "bilhões de tokens" } } }, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } } } } });
  alt("alt-tok", ["Mês", ...names], mm.map((m) => [m, ...names.map((n) => g(m, n))]), "Ver tokens de entrada (bilhões) em tabela");
  $("#t-mod").innerHTML = `<tr><th>Modelo</th><th>Requisições</th><th>Tokens entrada</th><th>Tokens saída</th><th>Tokens saída/req.</th></tr>` +
    ms.map((r) => `<tr><td>${esc(r.modelo)}</td><td>${fmt(r.requisicoes)}</td><td>${short(r.tokens_entrada)}</td><td>${short(r.tokens_saida)}</td><td>${fmt(Math.round(r.tokens_saida / r.requisicoes))}</td></tr>`).join("");
  frase("s-mod", "Os modelos mais novos concentram quase todo o uso.");
}

function renderCusto() {
  const { resumo, cm, cmm, ct, precos } = D;
  const total = cm.reduce((a, r) => a + val(r), 0);
  const porMin = total / resumo.minutas_distintas;
  const porMilReq = total / (resumo.requisicoes / 1000);
  $("#kpis-custo").innerHTML = [[money(total), "custo estimado a preço de lista"], [money(porMin), "por processo com minuta"], [money(porMilReq), "por mil requisições"],
    [usd(resumo.custo_usd_painel), "é o que o painel oficial mostra: ele não calcula os modelos novos"]]
    .map(([v, l]) => `<div class="card kpi"><b>${v}</b><span>${l}</span></div>`).join("");
  $("#m-brl").setAttribute("aria-pressed", moeda === "brl"); $("#m-usd").setAttribute("aria-pressed", moeda === "usd");
  $("#m-brl").className = "btn" + (moeda === "brl" ? "" : " sec"); $("#m-usd").className = "btn" + (moeda === "usd" ? "" : " sec");

  const ms = cm.slice().sort((a, b) => val(b) - val(a));
  draw("c-custo-mod", { type: "bar", data: { labels: ms.map((r) => r.modelo), datasets: [{ label: "Custo estimado", data: ms.map(val), backgroundColor: PAL[0] }] }, options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => money(c.parsed.x) } } } } });
  alt("alt-custo-mod", ["Modelo", "Custo estimado", "Por requisição", "Requisições", "Tokens entrada", "Tokens saída"], ms.map((r) => [r.modelo, money(val(r)), money(val(r) / r.requisicoes), fmt(r.requisicoes), short(r.tokens_entrada), short(r.tokens_saida)]));
  const top = ms[0];
  frase("s-custo-mod", `${top.modelo} é o que mais pesa: ${money(val(top))}, ${num1((val(top) / total) * 100, 0)}% do total. Por requisição, o ranking muda: veja a tabela.`);

  const meses = [...new Set(cmm.map((r) => r.ano_mes))].sort(), nomes = [...new Set(cmm.map((r) => r.modelo))];
  const gv = (m, n) => cmm.filter((r) => r.ano_mes === m && r.modelo === n).reduce((a, r) => a + val(r), 0);
  const cp = topN(cm, val, 5), cpN = cp.top.map((r) => r.modelo), cpO = cp.outros.map((r) => r.modelo);
  const cSets = cpN.map((n, i) => ({ label: n, backgroundColor: PAL[i], data: meses.map((m) => gv(m, n)) }));
  if (cpO.length) cSets.push({ label: "Outros modelos", backgroundColor: CINZA, data: meses.map((m) => cpO.reduce((a, n) => a + gv(m, n), 0)) });
  draw("c-custo-mes", { type: "bar", data: { labels: meses, datasets: cSets }, options: { scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` } } } } });
  alt("alt-custo-mes", ["Mês", "Custo total", "Cotação PTAX média"], meses.map((m) => [m, money(nomes.reduce((a, n) => a + gv(m, n), 0)), num1((D.ptax.find((p) => p.ano_mes === m) || {}).ptax_venda_media || 0, 4)]));

  const io = ms.slice(0, 7), prec = (m) => precos[m.modelo];
  draw("c-custo-io", { type: "bar", data: { labels: io.map((r) => r.modelo), datasets: [
    { label: "Entrada", backgroundColor: PAL[1], data: io.map((r) => (r.tokens_entrada * prec(r).e / 1e6) * (moeda === "brl" ? r.brl_estimado / (r.usd_estimado || 1) : 1)) },
    { label: "Saída", backgroundColor: PAL[3], data: io.map((r) => (r.tokens_saida * prec(r).s / 1e6) * (moeda === "brl" ? r.brl_estimado / (r.usd_estimado || 1) : 1)) }] },
    options: { scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` } } } } });
  alt("alt-custo-io", ["Modelo", "Preço entrada (US$/mi)", "Preço saída (US$/mi)", "Tokens entrada", "Tokens saída"], io.map((r) => [r.modelo, prec(r).e, prec(r).s, short(r.tokens_entrada), short(r.tokens_saida)]));

  const tt = ct.slice().sort((a, b) => val(b) - val(a));
  $("#t-custo-trib").innerHTML = `<tr><th>Tribunal</th><th>Custo estimado</th><th>Minutas</th><th>Por processo com minuta</th></tr>` +
    tt.map((r) => `<tr><td>${esc(r.tribunal)}</td><td>${money(val(r))}</td><td>${fmt(r.minutas)}</td><td>${money(val(r) / r.minutas)}</td></tr>`).join("");
  $("#t-precos").innerHTML = `<tr><th>Modelo</th><th>Entrada</th><th>Saída</th><th>Fonte do preço</th></tr>` +
    cm.map((r) => `<tr><td>${esc(r.modelo)}</td><td>${num1(r.preco_entrada_usd_milhao, 4)}</td><td>${num1(r.preco_saida_usd_milhao, 4)}</td><td style="text-align:left">${esc(r.preco_fonte)}</td></tr>`).join("");
  renderAgua();
}

function renderAgua() {
  const { resumo, cmm } = D;
  const ml = Math.max(0, parseFloat($("#ml").value) || 0) * parseFloat($("#mult").value);
  const litros = (resumo.requisicoes * ml) / 1000, porMinuta = (litros * 1000) / resumo.minutas_distintas;
  const pessoa = litros / 150; // ~150 L/dia: média aproximada de uso doméstico por brasileiro (SNIS)
  $("#kpis-agua").innerHTML = [[`${num1(litros, litros < 100 ? 1 : 0)} L`, "água estimada no total"], [`${num1(porMinuta, 1)} mL`, "por minuta"],
    [`${num1(pessoa, 1)} dias`, "de uso doméstico de uma pessoa (≈150 L/dia)"], [`${num1((litros * 1000) / 500, 0)}`, "garrafinhas de 500 mL"]]
    .map(([v, l]) => `<div class="card kpi"><b>${v}</b><span>${l}</span></div>`).join("");
  $("#agua-res").textContent = `Em todo o período: cerca de ${num1(litros, litros < 100 ? 1 : 0)} litros, ${num1(pessoa, 1)} dias de uso doméstico de uma pessoa.`;
  const meses = [...new Set(cmm.map((r) => r.ano_mes))].sort();
  const pts = meses.map((m) => { const rs = cmm.filter((r) => r.ano_mes === m); return { x: rs.reduce((a, r) => a + val(r), 0), y: (rs.reduce((a, r) => a + r.requisicoes, 0) * ml) / 1000, m }; });
  draw("c-agua", { type: "scatter", data: { datasets: [{ label: "Meses", data: pts, backgroundColor: PAL[0], pointRadius: 5 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw.m}: ${money(c.raw.x)} · ${num1(c.raw.y, 1)} L` } } }, scales: { x: { title: { display: true, text: `Custo do mês (${moeda === "brl" ? "R$" : "US$"})` } }, y: { title: { display: true, text: "Água estimada (litros)" } } } } });
  alt("alt-agua", ["Mês", "Custo", "Água (L)"], pts.map((p) => [p.m, money(p.x), num1(p.y, 2)]));
  $("#corr").textContent = `correlação r = ${num1(pearson(pts.map((p) => p.x), pts.map((p) => p.y)), 2)}`;
}

function renderAll() {
  renderGeral(); renderTribunais(); renderModelos(); renderCusto();
  const names2 = ["resumo", "minutas_diarias", "minutas_mensais_grau", "tokens_mensais_tribunal_modelo", "requisicoes_mensais_modelo", "totais_tribunal", "totais_jurisdicao", "totais_modelo",
    "custos_mensais_modelo", "custos_mensais_tribunal_modelo", "custos_tribunal", "custos_modelo", "ptax_mensal"];
  $("#files").innerHTML = names2.map((n) => `<li><code>${n}</code> — <a href="data/${n}.json">JSON</a>${n === "resumo" ? "" : ` · <a href="data/${n}.csv">CSV</a>`}</li>`).join("");
  document.querySelectorAll(".origin").forEach((e) => (e.textContent = location.origin.startsWith("http") ? location.origin + location.pathname.replace(/\/[^/]*$/, "") : e.textContent));
}

async function initViz() {
  const [resumo, diarias, jur, trib, modelos, reqm, cmm, cm, ct, ptax] = await Promise.all(
    ["resumo", "minutas_diarias", "totais_jurisdicao", "totais_tribunal", "totais_modelo", "requisicoes_mensais_modelo", "custos_mensais_modelo", "custos_modelo", "custos_tribunal", "ptax_mensal"].map(load));
  const tm = await load("tokens_mensais_tribunal_modelo");
  Object.assign(D, { resumo, diarias, jur, trib, modelos, reqm, cmm, cm, ct, ptax, tm });
  D.precos = Object.fromEntries(cm.map((r) => [r.modelo, { e: r.preco_entrada_usd_milhao, s: r.preco_saida_usd_milhao }]));
  D.trib = trib.map((r) => Object.assign({}, r, { tokens_entrada: r.tokens_entrada, tokens_saida: r.tokens_saida }));
  window.GD = D; window.dispatchEvent(new Event("gd-ready"));
  $("#when").textContent = resumo.coletado_em.replace("T", " ").replace("Z", " UTC");
  renderAll();
  $("#m-brl").onclick = () => { moeda = "brl"; renderCusto(); };
  $("#m-usd").onclick = () => { moeda = "usd"; renderCusto(); };
  $("#ml").addEventListener("input", renderAgua); $("#ml-reset").onclick = () => { $("#ml").value = "0.26"; $("#mult").value = "1"; renderAgua(); }; $("#mult").addEventListener("change", renderAgua);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
  $("#foco").onclick = (e) => { const on = document.body.classList.toggle("foco"); e.currentTarget.setAttribute("aria-pressed", on); try { localStorage.setItem("foco", on ? "1" : ""); } catch {} window.dispatchEvent(new Event("foco-change")); Object.values(charts).forEach((c) => c.resize()); };
  try { if (localStorage.getItem("foco")) { document.body.classList.add("foco"); $("#foco").setAttribute("aria-pressed", "true"); } } catch {}
}
initViz().catch((e) => {
  const c = document.createElement("div"); c.className = "card"; c.setAttribute("role", "alert");
  c.textContent = window.Chart ? `Não foi possível carregar os dados (${e.message}). Abra por um servidor HTTP.` : "Não foi possível carregar a biblioteca de gráficos.";
  $("#kpis").replaceChildren(c);
});
