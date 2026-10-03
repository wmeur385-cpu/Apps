// exp_lib.js — uma avaliação = gerar base (semente, ruído) em memória → construir a camada com os parâmetros → conferir com o gabarito.
'use strict';
const { gerar } = require('../gerar_dados');
const N = require('../nucleo'), A = require('../avaliacao');

function mulberry(seed) { let s = seed >>> 0; return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// multiplicadores de bagunça sorteados de forma determinística pela semente (pré-registrado)
function ruidoDaSemente(semente, faixa) {
  const r = mulberry(semente * 7919 + 17); const u = (a, b) => a + (b - a) * r();
  if (faixa === 'estresse') return { typo: u(2, 3), dup: u(2, 3), generico: u(2, 3), grupos: u(3, 4), homonimos: u(2, 3) };
  return { typo: u(0.5, 1.5), dup: u(0.5, 1.5), generico: u(0.5, 1.5), grupos: u(0.5, 2), homonimos: u(0.5, 1.5) };
}
function metricas(I, gab) {
  const r = A.avaliar(I, gab);
  // entidades reconstruídas exatas: todos os cadastros da entidade verdadeira numa só entidade prevista, sem cadastro alheio
  const verd = new Map(); gab.entidades.forEach(e => e.registros.filter(x => /^(crm|erp|ct):/.test(x) && !x.includes('#')).forEach(x => verd.set(x, e.id)));
  const porPred = new Map(); verd.forEach((v, ref) => { const p = I.entidadeDe(ref); if (!porPred.has(p)) porPred.set(p, new Set()); porPred.get(p).add(v); });
  let exatas = 0; gab.entidades.forEach(e => { const refs = e.registros.filter(x => /^(crm|erp|ct):/.test(x) && !x.includes('#')); const ps = new Set(refs.map(x => I.entidadeDe(x))); if (ps.size === 1 && porPred.get([...ps][0]).size === 1) exatas++; });
  return { y1: r.mencoes.erradas + r.cadastros_errados, mencoes_erradas: r.mencoes.erradas, cadastros_errados: r.cadastros_errados, pendentes: r.mencoes.ambiguas_nao_ligadas,
    mencoes: r.mencoes.total, f1: r.pares.f1, precisao: r.pares.precisao, revocacao: r.pares.revocacao, exatas, entidades: gab.entidades.length };
}
function avaliar(params, semente, ruido) {
  const t = Date.now(); const { arq, gab } = gerar(semente, ruido);
  const I = N.construir(arq, params); const m = metricas(I, gab); m.ms = Date.now() - t; return m;
}

// ---- benchmark só do lado da camada (fases 4 e 5): mesmas regras do benchmark.js ----
let enc = null;
function benchCamada(params, semente, ruido) {
  if (!enc) enc = require('js-tiktoken').getEncoding('cl100k_base');
  const { arq, gab } = gerar(semente, ruido); const I = N.construir(arq, params); const dono = A.avaliar(I, gab).donoPrev;
  const nomesVerd = gab.entidades.map(e => [N.normNome(e.fantasia), N.normNome(e.razao)]);
  const ambigua = v => { const tk = N.normNome(v).split(' '); return nomesVerd.filter(ns => ns.some(n => { const s2 = new Set(n.split(' ')); return tk.every(t => s2.has(t)); })).length > 1; };
  const out = [];
  for (const e of gab.entidades) {
    const v = e.variantes_pergunta[0]; const Q = [];
    if (e.muda) { const ult = e.ev_end_atual.slice().sort((a, b) => b.data.localeCompare(a.data))[0]; Q.push({ tipo: 'end', ouro: [ult.ref], resposta: (N.parseEnd(e.endereco_atual) || {}).chave }); }
    if (e.notas_atrasadas.length) Q.push({ tipo: 'atraso', ouro: e.notas_atrasadas.map(x => x.ref), resposta: Math.round(e.notas_atrasadas.reduce((a, x) => a + x.valor, 0) * 100) / 100 });
    if (e.chamados.length) Q.push({ tipo: 'chamados', ouro: e.chamados, resposta: e.chamados.length });
    if (e.contrato) Q.push({ tipo: 'contrato', ouro: ['ct:' + e.contrato, ...e.registros.filter(r => r.startsWith('nf:'))], resposta: e.diverge_valor });
    for (const q of Q) {
      const cands = I.buscar(v, 3); const id = cands[0] && cands[0].id; const empate = !!(cands[0] && cands[0].empate); let saida = null, resp = null;
      if (id) { const d = I.dossie(id);
        if (q.tipo === 'end') { saida = { endereco: d.endereco, mencoes_pendentes: d.mencoes_pendentes.filter(m => m.endereco) }; resp = d.endereco.atual && d.endereco.atual.endereco; }
        else if (q.tipo === 'atraso') { saida = { financeiro: { codigos_erp: d.financeiro.codigos_erp, atrasadas: d.financeiro.atrasadas, total_atrasado: d.financeiro.total_atrasado } }; resp = d.financeiro.total_atrasado; }
        else if (q.tipo === 'chamados') { const c = I.referencias(id, 'chamado'); saida = { chamados: c }; resp = c.filter(x => !x.pendente).length; }
        else { saida = { financeiro: d.financeiro, notas: I.referencias(id, 'nf') }; resp = d.financeiro.desvio_contrato !== null && Math.abs(d.financeiro.desvio_contrato) > 4; } }
      const ctx = JSON.stringify({ buscar_entidade: cands, ...(saida || {}) });
      const certa = !!id && dono.get(id) === e.id;
      out.push({ amb: ambigua(v), completa: certa && q.ouro.every(r => ctx.includes('"' + r + '"')), tokens: enc.encode(ctx).length, certa,
        empate, resposta_certa: certa && (typeof q.resposta === 'number' ? Math.abs(resp - q.resposta) < 0.011 : resp === q.resposta) });
    }
  }
  const cl = out.filter(o => !o.amb), am = out.filter(o => o.amb); const med = a => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  return { n: cl.length, evidencia: cl.filter(o => o.completa).length / cl.length, tokens: med(cl.map(o => o.tokens)), resposta: cl.filter(o => o.resposta_certa).length / cl.length,
    amb_n: am.length, amb_errou_sem_aviso: am.filter(o => !o.certa && !o.empate).length };
}
module.exports = { avaliar, benchCamada, ruidoDaSemente, mulberry };
