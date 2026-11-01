// Cena 3D: barras (linhas × meses). Módulo carregado só quando a aba 3D é aberta.
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const brl = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("foco");
const MEDIDAS = {
  minutas: { nome: "minutas (soma diária)", uni: "minutas", aviso: "Minutas aqui são somas diárias: um processo pode contar em mais de um dia." },
  tokens: { nome: "tokens (entrada + saída)", uni: "tokens" },
  custo: { nome: "custo estimado (R$, preço de lista)", uni: "R$" },
  req: { nome: "requisições", uni: "requisições" },
};
const GUIA = "Toque numa barra, ou foque o gráfico e use as setas.";
const LIMITE_VIS = { tribunal: "Eixo da frente: tribunais. Eixo da direita: meses.", modelo: "Eixo da frente: modelos de IA. Eixo da direita: meses." };
const SX = 1.5, SZ = 1.5, HMAX = 12;

let G, M = {}, state = { visao: "tribunal", medida: "minutas", escala: "raiz" };
let T = null, sel = null, growGen = 0, spinId = 0, initP = null, meta = [];
const dummy = new THREE.Object3D(), tmpColor = new THREE.Color();

async function prepare() {
  G = window.GD;
  const ctm = await fetch("data/custos_mensais_tribunal_modelo.json").then((r) => r.json());
  const meses = [...new Set(G.cmm.map((r) => r.ano_mes))].sort();
  const tribs = G.trib.map((r) => r.tribunal).sort();
  const modelos = G.cm.slice().sort((a, b) => b.brl_estimado - a.brl_estimado).map((r) => r.modelo);
  const mat = (rows) => rows.map(() => meses.map(() => 0));
  const add = (m, rows, ri, ci, v) => { const i = rows.indexOf(ri), j = meses.indexOf(ci); if (i >= 0 && j >= 0) m[i][j] += v; };
  const Tm = { rows: tribs, minutas: mat(tribs), tokens: mat(tribs), custo: mat(tribs) };
  G.diarias.forEach((r) => add(Tm.minutas, tribs, r.tribunal, r.data.slice(0, 7), r.minutas));
  G.tm.forEach((r) => add(Tm.tokens, tribs, r.tribunal, r.ano_mes, r.tokens_entrada + r.tokens_saida));
  ctm.forEach((r) => add(Tm.custo, tribs, r.tribunal, r.ano_mes, r.brl_estimado));
  const Mm = { rows: modelos, tokens: mat(modelos), custo: mat(modelos), req: mat(modelos) };
  G.reqm.forEach((r) => { add(Mm.tokens, modelos, r.modelo, r.ano_mes, r.tokens_entrada + r.tokens_saida); add(Mm.req, modelos, r.modelo, r.ano_mes, r.requisicoes); });
  G.cmm.forEach((r) => add(Mm.custo, modelos, r.modelo, r.ano_mes, r.brl_estimado));
  M = { tribunal: Tm, modelo: Mm, meses };
}

function label(text, color) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 112;
  const x = c.getContext("2d"); x.font = "700 64px system-ui, sans-serif"; x.fillStyle = color; x.textBaseline = "middle"; x.textAlign = "center";
  x.fillText(text, 256, 56, 500);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(3.4, 3.4 * 112 / 512, 1); return sp;
}
const nomeCurto = (r) => r.replace("gemini-", "").replace("-preview", " pv").slice(0, 18);
const scaleV = (v, max) => (state.escala === "raiz" ? Math.sqrt(v / max) : v / max);
const colorFor = (t, out) => out.setHSL(0.62 - 0.62 * t, 0.72, 0.42 + 0.1 * t);
const valorTxt = (v) => (state.medida === "custo" ? brl(v) : fmt(v) + " " + MEDIDAS[state.medida].uni);

function build() {
  const host = $("#d3-host");
  const renderer = new THREE.WebGLRenderer({ antialias: !matchMedia("(pointer: coarse)").matches, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
  host.appendChild(renderer.domElement);
  const cv = renderer.domElement;
  cv.setAttribute("tabindex", "0"); cv.setAttribute("role", "application");
  cv.setAttribute("aria-roledescription", "gráfico de barras 3D");
  cv.setAttribute("aria-label", "Gráfico de barras 3D. Setas percorrem as barras, Home e End vão ao início e ao fim, Esc limpa, Tab sai do gráfico. Os valores também estão na tabela abaixo.");
  cv.setAttribute("aria-describedby", "d3-ajuda");
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  const controls = new OrbitControls(camera, cv);
  cv.style.touchAction = "pan-y"; // um dedo na vertical rola a página; na horizontal gira a cena
  controls.maxPolarAngle = Math.PI * 0.48; controls.minDistance = 8; controls.maxDistance = 100;
  controls.addEventListener("change", draw);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.15));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(10, 20, 8); scene.add(dl);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff })); outline.visible = false;
  T = { renderer, scene, camera, controls, geo, mat, outline, group: new THREE.Group(), inst: null, ray: new THREE.Raycaster(), mouse: new THREE.Vector2(), picking: false };
  scene.add(T.group, outline);
  new ResizeObserver(resize).observe(host);
  cv.addEventListener("pointermove", (e) => { if (e.buttons || T.picking) return; T.picking = true; requestAnimationFrame(() => { T.picking = false; hover(e); }); });
  cv.addEventListener("pointerleave", () => ($("#d3-tip").hidden = true));
  cv.addEventListener("click", (e) => { const id = pick(e); if (id != null) select(meta[id].i, meta[id].j, e); });
  cv.addEventListener("keydown", keys);
  cv.addEventListener("webglcontextlost", (e) => e.preventDefault());
  cv.addEventListener("webglcontextrestored", fill);
  resetCamera(); fill();
}

function fill() {
  const V = M[state.visao], data = V[state.medida], meses = M.meses, ink = css("--ink"), mut = css("--mut");
  growGen++;
  const g = T.group;
  g.children.forEach((c) => { if (c.isSprite) { c.material.map?.dispose(); c.material.dispose(); } else if (c.isGridHelper) { c.geometry.dispose(); c.material.dispose(); } });
  g.clear(); T.inst = null; meta = []; sel = null; T.outline.visible = false;
  $("#d3-info").textContent = GUIA;
  const flat = data.flat(), max = Math.max(...flat, 0);
  const nR = V.rows.length, nC = meses.length, W = nR * SX, D = nC * SZ;
  T.dims = { W, D };
  const aviso = $("#d3-aviso"); aviso.hidden = !MEDIDAS[state.medida].aviso; aviso.textContent = MEDIDAS[state.medida].aviso || "";
  if (!max) { $("#d3-desc").textContent = "Sem dados para exibir."; $("#d3-legenda").textContent = ""; $("#d3-alt").replaceChildren(); T.renderer.render(T.scene, T.camera); return; }

  const grid = new THREE.GridHelper(Math.max(W, D) + 2, Math.max(nR, nC) + 1, 0x8892a3, 0x8892a3);
  grid.material.opacity = 0.25; grid.material.transparent = true; g.add(grid);
  const cells = [];
  for (let i = 0; i < nR; i++) for (let j = 0; j < nC; j++) if (data[i][j] > 0) { const t = scaleV(data[i][j], max); cells.push({ i, j, v: data[i][j], t, h: Math.max(t * HMAX, 0.05) }); }
  const inst = new THREE.InstancedMesh(T.geo, T.mat, cells.length);
  cells.forEach((c, k) => { colorFor(c.t, tmpColor); inst.setColorAt(k, tmpColor); c.x = c.i * SX - W / 2 + SX / 2; c.z = c.j * SZ - D / 2 + SZ / 2; meta[k] = c; });
  inst.instanceColor.needsUpdate = true; T.inst = inst; g.add(inst);

  V.rows.forEach((r, i) => { const s = label(nomeCurto(r), mut); s.position.set(i * SX - W / 2 + SX / 2, 0.5, D / 2 + 1.6 + (i % 2) * 1.2); g.add(s); });
  meses.forEach((m, j) => { if (j % 2) return; const s = label(m, mut); s.position.set(W / 2 + 2.6, 0.5, j * SZ - D / 2 + SZ / 2); g.add(s); });

  const setMatrices = (k) => cells.forEach((c, n) => { const h = Math.max(c.h * k, 0.01); dummy.position.set(c.x, h / 2, c.z); dummy.scale.set(1.05, h, 1.05); dummy.updateMatrix(); inst.setMatrixAt(n, dummy.matrix); });
  if (reduced()) { setMatrices(1); inst.instanceMatrix.needsUpdate = true; draw(); } else grow(inst, setMatrices);

  const fp = (v) => (state.medida === "custo" ? brl(v) : fmt(v));
  $("#d3-legenda").textContent = `Cor e altura: azul = baixo, vermelho = alto. Maior barra: ${(fp(max) + " " + (state.medida === "custo" ? "" : MEDIDAS[state.medida].uni)).trim()}. ` +
    (state.escala === "raiz" ? "Altura compacta: a raiz quadrada mostra as barras pequenas, mas distorce a comparação visual." : "Altura real: proporcional ao valor.");
  describe(); table();
}

function grow(inst, setMatrices) {
  const my = ++growGen, t0 = performance.now(), D = 600;
  const step = (now) => {
    if (my !== growGen) return;
    const k = Math.min((now - t0) / D, 1), e = 1 - (1 - k) ** 3;
    setMatrices(e); inst.instanceMatrix.needsUpdate = true; draw();
    if (k < 1) requestAnimationFrame(step);
  };
  setMatrices(0); inst.instanceMatrix.needsUpdate = true; requestAnimationFrame(step);
}

function draw() { if (T) T.renderer.render(T.scene, T.camera); }
function resize() {
  const host = $("#d3-host"), w = host.clientWidth, h = host.clientHeight; if (!w || !h || !T) return;
  T.renderer.setSize(w, h, false); T.camera.aspect = w / h; T.camera.updateProjectionMatrix(); fit(); draw();
}
function fit() { // afasta a câmera em telas estreitas para não cortar as laterais
  const a = T.camera.aspect, k = a >= 1.3 ? 1 : Math.min(1.3 / a, 2.4);
  if (T.fitK === k) return; T.fitK = k; resetCamera();
}
function resetCamera() {
  const k = T.fitK || 1, { camera, controls } = T;
  controls.target.set(0, 2, 0); camera.position.set(18 * k, 20 * k, 40 * k); controls.update(); draw();
}
function pick(e) {
  const r = T.renderer.domElement.getBoundingClientRect();
  T.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  T.ray.setFromCamera(T.mouse, T.camera);
  return T.inst ? T.ray.intersectObject(T.inst, false)[0]?.instanceId : null;
}
function textFor(i, j) { const V = M[state.visao]; return `${V.rows[i]} · ${M.meses[j]}: ${valorTxt(V[state.medida][i][j])}`; }
function hover(e) {
  const id = pick(e), tip = $("#d3-tip");
  if (id == null) { tip.hidden = true; return; }
  const r = $("#d3-host").getBoundingClientRect();
  tip.hidden = false; tip.textContent = textFor(meta[id].i, meta[id].j);
  tip.style.left = Math.max(0, Math.min(e.clientX - r.left + 12, r.width - 220)) + "px"; tip.style.top = e.clientY - r.top + 12 + "px";
}
function select(i, j) {
  sel = { i, j }; const k = meta.findIndex((m) => m.i === i && m.j === j); if (k < 0) return;
  const c = meta[k];
  T.outline.visible = true; T.outline.scale.set(1.15, c.h + 0.1, 1.15); T.outline.position.set(c.x, c.h / 2, c.z);
  $("#d3-info").textContent = textFor(i, j); draw();
}
function keys(e) {
  if (!meta.length) return;
  if (e.key === "Escape") { sel = null; T.outline.visible = false; $("#d3-info").textContent = GUIA; draw(); return; }
  const order = meta.map((m, k) => k).sort((a, b) => meta[a].i - meta[b].i || meta[a].j - meta[b].j); // linha, depois mês
  const cur = sel ? order.findIndex((k) => meta[k].i === sel.i && meta[k].j === sel.j) : -1;
  let nx;
  if (e.key === "Home") nx = 0; else if (e.key === "End") nx = order.length - 1;
  else if (e.key === "ArrowRight" || e.key === "ArrowDown") nx = cur < 0 ? 0 : Math.min(cur + 1, order.length - 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nx = cur < 0 ? 0 : Math.max(cur - 1, 0);
  else if (e.key === "PageDown" || e.key === "PageUp") { // próxima/anterior linha (tribunal ou modelo), mesmo mês aproximado
    const cj = sel ? sel.j : 0, ci = sel ? sel.i : -1, di = e.key === "PageDown" ? 1 : -1;
    const alvo = order.filter((k) => (di > 0 ? meta[k].i > ci : meta[k].i < ci));
    if (!alvo.length) return; const prox = di > 0 ? meta[alvo[0]].i : meta[alvo[alvo.length - 1]].i;
    nx = order.indexOf(order.filter((k) => meta[k].i === prox).sort((a, b) => Math.abs(meta[a].j - cj) - Math.abs(meta[b].j - cj))[0]);
  } else return;
  e.preventDefault(); const m = meta[order[nx]]; select(m.i, m.j);
}
function describe() {
  const V = M[state.visao], data = V[state.medida];
  const tot = data.map((row, i) => [V.rows[i], row.reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1]);
  $("#d3-desc").textContent = `${V.rows.length} ${state.visao === "tribunal" ? "tribunais" : "modelos"} por ${M.meses.length} meses, medida: ${MEDIDAS[state.medida].nome}. ` +
    `Maiores totais: ${tot.slice(0, 3).map((t) => `${t[0]} (${state.medida === "custo" ? brl(t[1]) : fmt(t[1])})`).join(", ")}. ${LIMITE_VIS[state.visao]}`;
}
function table() { // matriz completa, ordem do gráfico (alfabética para tribunais; por custo para modelos)
  const V = M[state.visao], data = V[state.medida], el = (t, txt, a) => { const n = document.createElement(t); if (txt != null) n.textContent = txt; if (a) Object.entries(a).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
  const tb = el("table"), cap = el("caption", `${MEDIDAS[state.medida].nome} por ${state.visao === "tribunal" ? "tribunal" : "modelo"} e mês, na mesma ordem do gráfico.`);
  tb.append(cap); const hr = el("tr"); hr.append(el("th", state.visao === "tribunal" ? "Tribunal" : "Modelo", { scope: "col" }), el("th", "Total", { scope: "col" }));
  M.meses.forEach((m) => hr.append(el("th", m, { scope: "col" }))); tb.append(hr);
  V.rows.forEach((r, i) => { const tr = el("tr"); tr.append(el("th", r, { scope: "row" }), el("td", state.medida === "custo" ? brl(data[i].reduce((a, b) => a + b, 0)) : fmt(data[i].reduce((a, b) => a + b, 0)))); data[i].forEach((v) => tr.append(el("td", v ? (state.medida === "custo" ? brl(v) : fmt(v)) : "–"))); tb.append(tr); });
  const wrap = el("div", null, { style: "overflow:auto;max-height:420px" }); wrap.append(tb);
  const det = el("details", null, { class: "alt" }); det.append(el("summary", "Ver todos os valores em tabela"), wrap);
  $("#d3-alt").replaceChildren(det);
}
function syncSpinButton() {
  const b = $("#d3-spin"), off = reduced();
  b.disabled = off; b.textContent = off ? "Giro desativado (menos movimento)" : "Girar sozinho";
  if (off) stopSpin();
}
function stopSpin() { spinId++; if (T) T.controls.autoRotate = false; $("#d3-spin").setAttribute("aria-pressed", "false"); }
function toggleSpin() {
  if ($("#d3-spin").getAttribute("aria-pressed") === "true" || reduced()) { stopSpin(); return; }
  const my = ++spinId; $("#d3-spin").setAttribute("aria-pressed", "true"); T.controls.autoRotate = true; T.controls.autoRotateSpeed = 0.8;
  const tick = () => { if (my !== spinId) return; if (reduced() || $("#d3").hidden) { stopSpin(); return; } T.controls.update(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function syncMedidas() {
  const ok = { tribunal: ["minutas", "tokens", "custo"], modelo: ["req", "tokens", "custo"] }[state.visao];
  const s = $("#d3-medida"); s.replaceChildren(...ok.map((k) => { const o = document.createElement("option"); o.value = k; o.textContent = MEDIDAS[k].nome; return o; }));
  if (!ok.includes(state.medida)) state.medida = ok[0]; s.value = state.medida;
}
function falha(msg) {
  $("#d3-host").hidden = true; document.querySelectorAll("#d3 .d3ctl").forEach((n) => (n.hidden = true));
  const m = $("#d3-msg"); m.hidden = false; m.textContent = msg;
}

export function init() {
  if (initP) { initP.then(() => T && resize()); return initP; }
  initP = (async () => {
    try { await prepare(); syncMedidas(); build(); } catch (e) { falha("Seu navegador não conseguiu iniciar o 3D. As outras abas mostram os mesmos dados em gráficos e tabelas."); initP = null; return; }
    $("#d3-visao").onchange = (e) => { state.visao = e.target.value; syncMedidas(); fill(); };
    $("#d3-medida").onchange = (e) => { state.medida = e.target.value; fill(); };
    $("#d3-escala").onchange = (e) => { state.escala = e.target.value; fill(); };
    $("#d3-reset").onclick = resetCamera;
    $("#d3-spin").onclick = toggleSpin;
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", fill);
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", syncSpinButton);
    new MutationObserver(fill).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("foco-change", syncSpinButton);
    syncSpinButton(); resize();
  })();
  return initP;
}
