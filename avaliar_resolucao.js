// avaliar_resolucao.js — compara a resolução do núcleo com o gabarito (que o núcleo nunca viu)
const N = require('./nucleo'), carregar = require('./carregar');
const g = require('./gabarito/gabarito.json');
const t0 = Date.now(); const I = N.construir(carregar()); const ms = Date.now() - t0;
const verdade = new Map(); g.entidades.forEach(e => e.registros.forEach(r => verdade.set(r, e.id)));
const refs = [...verdade.keys()];
// precisão/revocação por pares, sobre todos os registros que a camada ligou a alguma entidade
const pred = new Map(refs.map(r => [r, I.entidadeDe(r)]));
const porPred = new Map(), porVerd = new Map();
refs.forEach(r => { const p = pred.get(r); if (p) { if (!porPred.has(p)) porPred.set(p, []); porPred.get(p).push(r); } const v = verdade.get(r); if (!porVerd.has(v)) porVerd.set(v, []); porVerd.get(v).push(r); });
const pares = n => n * (n - 1) / 2;
let vp = 0, pp = 0, pv = 0;
porPred.forEach(l => { pp += pares(l.length); const c = new Map(); l.forEach(r => { const v = verdade.get(r); c.set(v, (c.get(v) || 0) + 1); }); c.forEach(k => vp += pares(k)); });
porVerd.forEach(l => pv += pares(l.length));
const prec = vp / pp, rev = vp / pv, f1 = 2 * prec * rev / (prec + rev);
// entidades: quantas previstas casam exatamente com uma verdadeira
let fusoesErradas = [], divisoes = [];
porPred.forEach((l, p) => { const vs = new Set(l.map(r => verdade.get(r))); if (vs.size > 1) fusoesErradas.push({ p, verdadeiras: [...vs] }); });
porVerd.forEach((l, v) => { const ps = new Set(l.map(r => pred.get(r)).filter(Boolean)); if (ps.size > 1) divisoes.push({ v, previstas: [...ps], refs: l.filter(r => !r.startsWith('nf:')).map(r => r + '→' + pred.get(r)) }); });
// menções
const men = refs.filter(r => r.startsWith('em:') || r.startsWith('ch:'));
let ok = 0, errada = 0, solta = 0; const errados = [];
men.forEach(r => { const p = pred.get(r); if (!p) { solta++; return; } const pv2 = (porPred.get(p) || []).filter(x => !x.startsWith('em:') && !x.startsWith('ch:')).map(x => verdade.get(x)); const maj = pv2.sort((a, b) => pv2.filter(x => x === b).length - pv2.filter(x => x === a).length)[0]; if (maj === verdade.get(r)) ok++; else { errada++; errados.push(r); } });
const est = I.estatisticas();
const rel = { tempo_ms: ms, pares: { precisao: +prec.toFixed(4), revocacao: +rev.toFixed(4), f1: +f1.toFixed(4) }, entidades_verdadeiras: g.entidades.length, entidades_previstas: porPred.size,
  fusoes_erradas: fusoesErradas.length, entidades_divididas: divisoes.length, mencoes: { total: men.length, certas: ok, erradas: errada, nao_ligadas_ambiguas: solta }, estatisticas: est };
console.log(JSON.stringify(rel, null, 1));
if (process.argv[2] === '-v') { console.log('FUSÕES', JSON.stringify(fusoesErradas.slice(0, 10))); console.log('DIVISÕES', JSON.stringify(divisoes.slice(0, 15), null, 0)); console.log('MENÇÕES ERRADAS', errados.slice(0, 10).map(r => r + ' ' + JSON.stringify(I.interno.porRef.get(r).nomeOrig))); console.log('AMBÍGUOS', JSON.stringify(I.ambiguos().slice(0, 8))); }
module.exports = rel;
