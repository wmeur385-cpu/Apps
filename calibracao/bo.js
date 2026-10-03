// bo.js — otimização bayesiana restrita, sem bibliotecas.
//   GP Matérn 5/2 com relevância por dimensão (ARD), ruído heteroscedástico fixo por ponto (erro-padrão da média nas 20 sementes),
//   hiperparâmetros por máxima verossimilhança marginal (Nelder-Mead com vários inícios, em escala log, comprimentos limitados).
//   Aquisição: EI calculado sobre a melhor MÉDIA POSTERIOR viável (não o melhor observado, que premia semente sortuda)
//   × probabilidade de cumprir as restrições (um GP por restrição).
//   uso: node bo.js <braço> <semente_do_otimizador> <saida.json> [aleatoria]
'use strict';
const fs = require('fs'); const { avaliar, ruidoDaSemente, mulberry } = require('./exp_lib');
const [braco, sOpt, saida, modo] = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(__dirname + '/rsm_desenho.json', 'utf8')); const F = D.F, d = F.length;
const SEM = Array.from({ length: 20 }, (_, i) => 1001 + i);
const RND = mulberry(+sOpt * 104729 + 3);
const cfg = u => { const p = { grupo: braco }; F.forEach(([n, a, b], i) => p[n] = +(a + u[i] * (b - a)).toFixed(4)); return p; };

// ---------- álgebra mínima ----------
function chol(K) { const n = K.length, L = K.map(() => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = K[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 0) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j]; } return L; }
const fsub = (L, b) => { const n = b.length, x = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x[i] = s / L[i][i]; } return x; };
const bsub = (L, b) => { const n = b.length, x = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; } return x; };
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2)), phi = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
function nelderMead(f, x0, passo, iter) {
  const n = x0.length; let S = [x0.slice()]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += passo; S.push(x); }
  let V = S.map(f);
  for (let it = 0; it < iter; it++) {
    const o = V.map((v, i) => i).sort((a, b) => V[a] - V[b]); S = o.map(i => S[i]); V = o.map(i => V[i]);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
    const pt = (a) => c.map((ci, j) => ci + a * (S[n][j] - ci));
    const xr = pt(-1), vr = f(xr);
    if (vr < V[0]) { const xe = pt(-2), ve = f(xe); if (ve < vr) { S[n] = xe; V[n] = ve; } else { S[n] = xr; V[n] = vr; } }
    else if (vr < V[n - 1]) { S[n] = xr; V[n] = vr; }
    else { const xc = pt(0.5), vc = f(xc); if (vc < V[n]) { S[n] = xc; V[n] = vc; } else { for (let i = 1; i <= n; i++) { S[i] = S[i].map((x, j) => S[0][j] + 0.5 * (x - S[0][j])); V[i] = f(S[i]); } } }
  }
  const i = V.indexOf(Math.min(...V)); return { x: S[i], v: V[i] };
}
// ---------- GP ----------
function k52(a, b, ell, sf2) { let r2 = 0; for (let i = 0; i < a.length; i++) { const t = (a[i] - b[i]) / ell[i]; r2 += t * t; } const r = Math.sqrt(5 * r2); return sf2 * (1 + r + r * r / 3) * Math.exp(-r); }
function gp(X, y, ruido) { // y e ruído na escala original; padroniza internamente
  const n = y.length, mu = y.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(y.reduce((a, b) => a + (b - mu) ** 2, 0) / n) || 1;
  const z = y.map(v => (v - mu) / sd), nz = ruido.map(v => v / (sd * sd) + 1e-6);
  const montar = (ell, sf2) => { const K = X.map((a, i) => X.map((b, j) => k52(a, b, ell, sf2) + (i === j ? nz[i] : 0))); const L = chol(K); if (!L) return null; const al = bsub(L, fsub(L, z)); return { L, al }; };
  const nlml = th => { const ell = th.slice(0, d).map(t => Math.exp(Math.min(Math.max(t, Math.log(0.05)), Math.log(2)))), sf2 = Math.exp(Math.min(Math.max(th[d], Math.log(0.05)), Math.log(20)));
    const m = montar(ell, sf2); if (!m) return 1e9; let s = 0; for (let i = 0; i < n; i++) s += Math.log(m.L[i][i]);
    const pen = th.slice(0, d).reduce((a, t) => a + Math.max(0, Math.log(0.05) - t) + Math.max(0, t - Math.log(2)), 0) * 100;
    return 0.5 * z.reduce((a, v, i) => a + v * m.al[i], 0) + s + pen; };
  let best = null; for (let r = 0; r < 10; r++) { const x0 = Array.from({ length: d }, () => Math.log(0.1 + 1.4 * RND())).concat([Math.log(0.3 + 2 * RND())]); const o = nelderMead(nlml, x0, 0.5, 200); if (!best || o.v < best.v) best = o; }
  const ell = best.x.slice(0, d).map(t => Math.exp(Math.min(Math.max(t, Math.log(0.05)), Math.log(2)))), sf2 = Math.exp(Math.min(Math.max(best.x[d], Math.log(0.05)), Math.log(20)));
  const { L, al } = montar(ell, sf2);
  const prever = x => { const ks = X.map(a => k52(a, x, ell, sf2)); const m = ks.reduce((a, k, i) => a + k * al[i], 0); const v = fsub(L, ks); const s2 = Math.max(sf2 - v.reduce((a, b) => a + b * b, 0), 1e-12); return { m: mu + sd * m, s: sd * Math.sqrt(s2) }; };
  return { prever, ell, sf2, nlml: best.v };
}
// ---------- avaliação de um ponto (média e erro-padrão nas 20 sementes comuns) ----------
const cache = new Map();
function medir(u) {
  const p = cfg(u), k = JSON.stringify(p); if (cache.has(k)) return cache.get(k);
  const r = SEM.map(s => avaliar(p, s, ruidoDaSemente(s)));
  const est = c => { const v = r.map(x => x[c]); const m = v.reduce((a, b) => a + b, 0) / v.length; const se2 = v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1) / v.length; return [m, se2]; };
  const o = { u, params: p, y1: est('y1'), pend: est('pendentes'), f1: est('f1') }; cache.set(k, o); return o;
}
// ---------- dados do composto central (aquecimento) ----------
const linhas = fs.readFileSync(__dirname + '/rsm.jsonl', 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const porPonto = new Map(); linhas.filter(l => l.braco === braco && l.ponto < 25).forEach(l => { if (!porPonto.has(l.ponto)) porPonto.set(l.ponto, []); porPonto.get(l.ponto).push(l); });
const resumo = (ls, c) => { const v = ls.map(x => x[c]); const m = v.reduce((a, b) => a + b, 0) / v.length; return [m, v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1) / v.length]; };
const ccd = [...porPonto.entries()].map(([pi, ls]) => ({ u: ls[0].x.map(x => (x + 1) / 2), params: cfg(ls[0].x.map(x => (x + 1) / 2)), y1: resumo(ls, 'y1'), pend: resumo(ls, 'pendentes'), f1: resumo(ls, 'f1') }));
ccd.forEach(o => cache.set(JSON.stringify(o.params), o));
// limites das restrições (pré-registrados): relativos ao padrão nas mesmas sementes = centro do braço 'atual'
const base = linhas.filter(l => l.braco === 'atual' && l.ponto === 24);
const LIM_PEND = 1.10 * base.reduce((a, l) => a + l.pendentes, 0) / base.length, LIM_F1 = base.reduce((a, l) => a + l.f1, 0) / base.length - 0.002;

const hist = []; let obs;
if (modo === 'aleatoria') {
  obs = [];
  for (let it = 0; it < 40; it++) { const o = medir(Array.from({ length: d }, () => RND())); obs.push(o);
    const viaveis = obs.filter(x => x.pend[0] <= LIM_PEND && x.f1[0] >= LIM_F1); const b = viaveis.sort((a, c) => a.y1[0] - c.y1[0])[0];
    hist.push({ n: obs.length, melhor: b ? b.y1[0] : null, escolhido: b ? b.params : null }); }
} else {
  // aquecimento: 10 dos 25 pontos do composto central, sorteados pela semente do otimizador
  obs = ccd.slice().sort(() => RND() - 0.5).slice(0, 10);
  let G;
  for (let it = 0; it < 30; it++) {
    // refaz os três GPs (objetivo e duas restrições) a cada iteração, com hiperparâmetros reestimados: n ≤ 40, custa menos de 1 s
    const X = obs.map(o => o.u); G = { y: gp(X, obs.map(o => o.y1[0]), obs.map(o => o.y1[1])), p: gp(X, obs.map(o => o.pend[0]), obs.map(o => o.pend[1])), f: gp(X, obs.map(o => o.f1[0]), obs.map(o => o.f1[1])) };
    const pv = u => { const p = G.p.prever(u), f = G.f.prever(u); return Phi((LIM_PEND - p.m) / p.s) * Phi((f.m - LIM_F1) / f.s); };
    const viaveis = obs.map(o => ({ o, m: G.y.prever(o.u).m, pv: pv(o.u) })).filter(x => x.pv >= 0.5);
    const melhor = viaveis.length ? Math.min(...viaveis.map(x => x.m)) : null;
    const aq = u => { if (u.some(x => x < 0 || x > 1)) return 0; const y = G.y.prever(u); const p = pv(u); if (melhor === null) return p;
      const z = (melhor - y.m) / y.s; return ((melhor - y.m) * Phi(z) + y.s * phi(z)) * p; };
    const cands = Array.from({ length: 2000 }, () => Array.from({ length: d }, () => RND())).map(u => [aq(u), u]).sort((a, b) => b[0] - a[0]).slice(0, 5);
    let prox = cands[0][1], vprox = cands[0][0];
    for (const [, u0] of cands) { const o = nelderMead(u => -aq(u.map(x => Math.min(1, Math.max(0, x)))), u0, 0.08, 60); if (-o.v > vprox) { vprox = -o.v; prox = o.x.map(x => Math.min(1, Math.max(0, x))); } }
    const novo = medir(prox); obs.push(novo);
    const ranking = obs.map(o => ({ o, m: G.y.prever(o.u).m, pv: pv(o.u) })).filter(x => x.pv >= 0.5).sort((a, b) => a.m - b.m);
    hist.push({ n: obs.length, ei: vprox, melhor_posterior: ranking[0] ? ranking[0].m : null, escolhido: ranking[0] ? ranking[0].o.params : null, ell: G.y.ell.map(x => +x.toFixed(3)) });
    process.stdout.write(`\r${braco} otimizador ${sOpt}: ${it + 1}/30, EI ${vprox.toExponential(2)}`);
  }
}
fs.writeFileSync(saida, JSON.stringify({ braco, semente_otimizador: +sOpt, modo: modo || 'bo', LIM_PEND, LIM_F1, hist, obs: obs.map(o => ({ params: o.params, y1: o.y1, pend: o.pend, f1: o.f1 })) }));
console.log('\nfeito', saida);
