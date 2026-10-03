// bancada/base_bm25.js — linha de base: busca por palavra-chave (BM25) sobre todos os registros, notas já desnormalizadas
// com a razão social do ERP (linha de base justa, não espantalho). Mesmo código do benchmark.js.
const N = require('../nucleo');
const semAcento = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const termos = t => semAcento(t).toLowerCase().split(/[^a-z0-9@.]+/).filter(x => x.length > 1).map(x => x.length > 4 && x.endsWith('s') ? x.slice(0, -1) : x);
module.exports = function montar(arq) {
  const linhas = t => t.split('\n'); const docs = [];
  const crmL = linhas(arq.crm), erpL = linhas(arq.erp_clientes), nfL = linhas(arq.erp_notas);
  const razaoPorCod = new Map(); erpL.slice(1).forEach(l => { const c = N.csv(erpL[0] + '\n' + l + '\n')[0]; if (c) razaoPorCod.set(c.cod_erp, c.razao_social); });
  N.csv(arq.crm).forEach(x => docs.push({ ref: 'crm:' + x.id_crm, texto: 'CRM ' + crmL[x._linha - 1] }));
  N.csv(arq.erp_clientes).forEach(x => docs.push({ ref: 'erp:' + x.cod_erp, texto: 'ERP cliente ' + erpL[x._linha - 1] }));
  N.csv(arq.erp_notas).forEach(x => docs.push({ ref: 'nf:' + x.nf, texto: `Nota fiscal ${x.nf} cliente ${razaoPorCod.get(x.cod_erp) || ''} (cod ${x.cod_erp}) emissão ${x.emissao} valor R$ ${x.valor} situação ${x.situacao}` }));
  arq.contratos.forEach(c => { const num = c.arquivo.replace('.txt', ''); docs.push({ ref: 'ct:' + num, texto: c.texto, extra: c.texto.includes('ADITIVO') ? ['ct:' + num + '#ad1'] : [] }); });
  arq.emails.split('\n').filter(Boolean).forEach(l => { const x = JSON.parse(l); docs.push({ ref: 'em:' + x.id, texto: 'E-mail ' + l }); });
  arq.chamados.split('\n').filter(Boolean).forEach(l => { const x = JSON.parse(l); docs.push({ ref: 'ch:' + x.id, texto: 'Chamado ' + l }); });
  const tf = docs.map(d => { const m = new Map(); termos(d.texto).forEach(t => m.set(t, (m.get(t) || 0) + 1)); d.len = [...m.values()].reduce((a, b) => a + b, 0); return m; });
  const df = new Map(); tf.forEach(m => m.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length, Nd = docs.length;
  function bm25(q, k) {
    const qt = [...new Set(termos(q))]; const sc = docs.map((d, i) => { let s = 0; for (const t of qt) { const f = tf[i].get(t); if (!f) continue; const idf = Math.log(1 + (Nd - df.get(t) + 0.5) / (df.get(t) + 0.5)); s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.len / avg)); } return [s, i]; });
    return sc.filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(x => docs[x[1]]);
  }
  return { docs, bm25 };
};
