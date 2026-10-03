// desenho_triagem.js — matriz ortogonal L27 (3^13) gerada sobre GF(3)^3, cruzada com L8 (2^7) para o ruído
const fs = require('fs');
const base = (i, p, m) => { const v = []; for (let k = m - 1; k >= 0; k--) { v[k] = i % p; i = Math.floor(i / p); } return v; };
function oaGF(p, m) {
  const cols = []; for (let i = 1; i < p ** m; i++) { const v = base(i, p, m); if (v.find(x => x !== 0) === 1) cols.push(v); }
  const rows = []; for (let r = 0; r < p ** m; r++) { const a = base(r, p, m); rows.push(cols.map(v => v.reduce((s, vi, k) => s + vi * a[k], 0) % p)); }
  return { cols, rows };
}
const L27 = oaGF(3, 3), L8 = oaGF(2, 3);
// prova de ortogonalidade: cada par de colunas tem cada par de níveis exatamente N/p² vezes
for (const [M, p] of [[L27, 3], [L8, 2]]) for (let a = 0; a < M.cols.length; a++) for (let b = a + 1; b < M.cols.length; b++) {
  const c = {}; M.rows.forEach(r => { const k = r[a] + ',' + r[b]; c[k] = (c[k] || 0) + 1; });
  if (Object.keys(c).length !== p * p || Object.values(c).some(x => x !== M.rows.length / (p * p))) throw new Error('não ortogonal');
}
const col = (M, v) => M.cols.findIndex(c => c.join() === v.join());
const FATORES = [ // [nome, coluna GF(3), níveis]
  ['limiarMencaoNome', [1, 0, 0], [0.64, 0.72, 0.80]],
  ['margem', [0, 1, 0], [0.04, 0.08, 0.12]],
  ['sim', [0, 0, 1], ['max', 'jw', 'tsort']],
  ['removeRuido', [1, 0, 1], [true, false, true]],          // nível fictício: 3º = 1º
  ['regras', [1, 0, 2], ['ll', 'dl', 'ld']],               // (regraIncompleto, aprendeEmail): ligado/desligado combinados
  ['guardaFone', [0, 1, 1], [0.25, 0.35, 0.45]],
  ['guardaDominio', [0, 1, 2], [0.45, 0.55, 0.65]],
  ['guardaEnd', [1, 1, 1], [0.40, 0.50, 0.60]],
  ['quaseIdentico', [1, 1, 2], [0.80, 0.86, 0.92]],
  ['grupo', [1, 2, 1], ['atual', 'exclusiva', 'pendente']],
  ['limiarContato', [1, 2, 2], [0.50, 0.60, 0.70]],
];
const VAZIAS = [[1, 1, 0], [1, 2, 0]]; // interação limiarMencaoNome × margem
const RUIDO = [['typo', [1, 0, 0], [0.5, 1.5]], ['dup', [0, 1, 0], [0.5, 1.5]], ['generico', [0, 0, 1], [0.5, 1.5]], ['grupos', [1, 1, 1], [0.5, 2]], ['homonimos', [1, 1, 0], [0.5, 1.5]]];
const usadas = FATORES.map(f => col(L27, f[1])).concat(VAZIAS.map(v => col(L27, v)));
if (new Set(usadas).size !== 13) throw new Error('colunas repetidas');
const jobs = [];
const params = linha => { const p = {}; FATORES.forEach(([n, v, niv]) => { const x = niv[linha[col(L27, v)]]; if (n === 'regras') { p.regraIncompleto = x[0] === 'l'; p.aprendeEmail = x[1] === 'l'; } else p[n] = x; }); return p; };
L8.rows.forEach((lo, o) => {
  const ruido = {}; RUIDO.forEach(([n, v, niv]) => ruido[n] = niv[lo[col(L8, v)]]);
  for (let k = 0; k < 2; k++) {
    const semente = 1001 + o * 2 + k;
    L27.rows.forEach((li, i) => jobs.push({ id: `t${i}_o${o}_k${k}`, meta: { interna: i, externa: o, rep: k, semente, niveis: li, ruido }, params: params(li), semente, ruido }));
    jobs.push({ id: `base_o${o}_k${k}`, meta: { interna: 'base', externa: o, rep: k, semente, ruido }, params: {}, semente, ruido });
  }
});
fs.writeFileSync('triagem_jobs.json', JSON.stringify(jobs));
fs.writeFileSync('triagem_desenho.json', JSON.stringify({ L27: L27.rows, L8: L8.rows, cols27: L27.cols, cols8: L8.cols, FATORES, VAZIAS, RUIDO }, null, 0));
console.log('jobs', jobs.length, 'L27 ortogonal, L8 ortogonal');
