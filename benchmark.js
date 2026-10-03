// benchmark.js — mesmas perguntas, dois jeitos de montar o contexto para o modelo:
//   (A) busca por palavra-chave (BM25, top-20) sobre todos os registros, com as notas já
//       desnormalizadas com a razão social do ERP (linha de base justa, não espantalho);
//   (B) camada de entidades: buscar_entidade + uma ferramenta.
// Mede: a evidência certa chegou inteira? quantos tokens custou? a camada já responde certo sozinha?
const fs = require('fs');
const N = require('./nucleo'), carregar = require('./carregar');
const { getEncoding } = require('js-tiktoken'); const enc = getEncoding('cl100k_base');
const tok = t => enc.encode(t).length;
const g = require('./gabarito/gabarito.json');
const arq = carregar(); const I = N.construir(arq); const P = I.interno.porRef;
const K = +(process.argv[2] || 20);

// ---------- documentos da linha de base ----------
const semAcento = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const termos = t => semAcento(t).toLowerCase().split(/[^a-z0-9@.]+/).filter(x => x.length > 1).map(x => x.length > 4 && x.endsWith('s') ? x.slice(0, -1) : x);
const linhas = (t) => t.split('\n');
const docs = [];
const crmL = linhas(arq.crm), erpL = linhas(arq.erp_clientes), nfL = linhas(arq.erp_notas);
const razaoPorCod = new Map(); erpL.slice(1).forEach(l => { const c = N.csv(erpL[0] + '\n' + l + '\n')[0]; if (c) razaoPorCod.set(c.cod_erp, c.razao_social); });
N.csv(arq.crm).forEach(x => docs.push({ ref: 'crm:' + x.id_crm, texto: 'CRM ' + crmL[x._linha - 1] }));
N.csv(arq.erp_clientes).forEach(x => docs.push({ ref: 'erp:' + x.cod_erp, texto: 'ERP cliente ' + erpL[x._linha - 1] }));
N.csv(arq.erp_notas).forEach(x => docs.push({ ref: 'nf:' + x.nf, texto: `Nota fiscal ${x.nf} cliente ${razaoPorCod.get(x.cod_erp) || ''} (cod ${x.cod_erp}) emissão ${x.emissao} valor R$ ${x.valor} situação ${x.situacao}` }));
arq.contratos.forEach(c => { const num = c.arquivo.replace('.txt', ''); docs.push({ ref: 'ct:' + num, texto: c.texto, extra: c.texto.includes('ADITIVO') ? ['ct:' + num + '#ad1'] : [] }); });
arq.emails.split('\n').filter(Boolean).forEach(l => { const x = JSON.parse(l); docs.push({ ref: 'em:' + x.id, texto: 'E-mail ' + l }); });
arq.chamados.split('\n').filter(Boolean).forEach(l => { const x = JSON.parse(l); docs.push({ ref: 'ch:' + x.id, texto: 'Chamado ' + l }); });
// BM25
const tf = docs.map(d => { const m = new Map(); termos(d.texto).forEach(t => m.set(t, (m.get(t) || 0) + 1)); d.len = [...m.values()].reduce((a, b) => a + b, 0); return m; });
const df = new Map(); tf.forEach(m => m.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length, Nd = docs.length;
function bm25(q, k) {
  const qt = [...new Set(termos(q))]; const sc = docs.map((d, i) => { let s = 0; for (const t of qt) { const f = tf[i].get(t); if (!f) continue; const idf = Math.log(1 + (Nd - df.get(t) + 0.5) / (df.get(t) + 0.5)); s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.len / avg)); } return [s, i]; });
  return sc.filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map(x => docs[x[1]]);
}
// ---------- perguntas ----------
const normEnd = t => (N.parseEnd(t) || {}).chave;
const Q = [];
// pergunta ambígua pela verdade: o nome usado cabe no nome de mais de um cliente real
const nomesVerd = g.entidades.map(e => [e.id, [N.normNome(e.fantasia), N.normNome(e.razao)]]);
const ambigua = (v, id) => { const tk = N.normNome(v).split(' '); return nomesVerd.filter(([i, ns]) => ns.some(n => { const s2 = new Set(n.split(' ')); return tk.every(t => s2.has(t)); })).length > 1; };
for (const e of g.entidades) {
  const v = e.variantes_pergunta[0];
  if (e.muda) { const ult = e.ev_end_atual.slice().sort((a, b) => b.data.localeCompare(a.data))[0]; Q.push({ v, tipo: 'endereço atual (cliente que mudou)', ent: e.id, texto: `Qual é o endereço atual do cliente ${v}?`, ouro: [ult.ref], resposta: normEnd(e.endereco_atual) }); }
  if (e.notas_atrasadas.length) Q.push({ v, tipo: 'total em atraso', ent: e.id, texto: `Quanto o cliente ${v} tem em notas fiscais atrasadas?`, ouro: e.notas_atrasadas.map(x => x.ref), resposta: Math.round(e.notas_atrasadas.reduce((a, x) => a + x.valor, 0) * 100) / 100 });
  if (e.chamados.length) Q.push({ v, tipo: 'chamados do cliente', ent: e.id, texto: `Quantos chamados de suporte o cliente ${v} abriu e quais foram?`, ouro: e.chamados, resposta: e.chamados.length });
  if (e.contrato) Q.push({ v, tipo: 'faturado diverge do contrato?', ent: e.id, texto: `O valor faturado para o cliente ${v} diverge mais de 4% do valor mensal do contrato?`, ouro: ['ct:' + e.contrato, ...e.registros.filter(r => r.startsWith('nf:'))], resposta: e.diverge_valor });
}
// dono verdadeiro de cada entidade prevista
const A = require('./avaliacao').avaliar(I, g); const dono = A.donoPrev;
const out = [], linhasLLM = [];
for (const q of Q) {
  // (A) linha de base
  const ret = bm25(q.texto, K); const refsA = new Set(ret.flatMap(d => [d.ref, ...(d.extra || [])]));
  const ctxA = ret.map(d => `[${d.ref}] ${d.texto}`).join('\n');
  // (B) camada
  const cands = I.buscar(q.v, 3);
  const id = cands[0] && cands[0].id; const empate = !!(cands[0] && cands[0].empate);
  let saida = null, respB = null;
  if (id) {
    const d = I.dossie(id);
    if (q.tipo.startsWith('endereço')) { saida = { endereco: d.endereco, mencoes_pendentes: d.mencoes_pendentes.filter(m => m.endereco) }; respB = d.endereco.atual && d.endereco.atual.endereco; }
    else if (q.tipo === 'total em atraso') { saida = { financeiro: { codigos_erp: d.financeiro.codigos_erp, atrasadas: d.financeiro.atrasadas, total_atrasado: d.financeiro.total_atrasado } }; respB = d.financeiro.total_atrasado; }
    else if (q.tipo === 'chamados do cliente') { const c = I.referencias(id, 'chamado'); saida = { chamados: c }; respB = c.filter(x => !x.pendente).length; }
    else { saida = { financeiro: d.financeiro, notas: I.referencias(id, 'nf') }; respB = d.financeiro.desvio_contrato !== null && Math.abs(d.financeiro.desvio_contrato) > 4; }
  }
  const ctxB = JSON.stringify({ buscar_entidade: cands, ...(saida || {}) });
  const temTudo = (refs, ctx) => q.ouro.every(r => refs ? refs.has(r) : ctx.includes('"' + r + '"'));
  const fr = (refs, ctx) => q.ouro.filter(r => refs ? refs.has(r) : ctx.includes('"' + r + '"')).length / q.ouro.length;
  const entCerta = !!id && dono.get(id) === q.ent;
  const okB = entCerta && (typeof q.resposta === 'number' ? Math.abs(respB - q.resposta) < 0.011 : respB === q.resposta);
  out.push({ tipo: q.tipo, ambigua: ambigua(q.v), A_completa: temTudo(refsA), A_frac: fr(refsA), A_tokens: tok(ctxA), B_completa: entCerta && temTudo(null, ctxB), B_frac: entCerta ? fr(null, ctxB) : 0, B_tokens: tok(ctxB), B_entidade_certa: entCerta, B_empate: empate, B_resposta_certa: okB });
  linhasLLM.push({ tipo: q.tipo, ambigua: out[out.length - 1].ambigua, pergunta: q.texto, resposta_ouro: q.resposta, contexto_A: ctxA, contexto_B: ctxB });
}
// ---------- agregação ----------
const tipos = [...new Set(out.map(o => o.tipo))];
const agg = l => ({ n: l.length, A_evidencia_completa: l.filter(o => o.A_completa).length / l.length, B_evidencia_completa: l.filter(o => o.B_completa).length / l.length,
  A_tokens_mediana: med(l.map(o => o.A_tokens)), B_tokens_mediana: med(l.map(o => o.B_tokens)), B_resposta_certa: l.filter(o => o.B_resposta_certa).length / l.length,
  B_entidade_errada: l.filter(o => !o.B_entidade_certa).length, B_empate_sinalizado: l.filter(o => o.B_empate).length,
  B_entidade_errada_sem_aviso: l.filter(o => !o.B_entidade_certa && !o.B_empate).length });
function med(a) { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; }
const todosTokens = tok(docs.map(d => d.texto).join('\n'));
const cl = out.filter(o => !o.ambigua), amb = out.filter(o => o.ambigua);
const res = { k: K, perguntas: out.length, documentos: docs.length, tokens_base_inteira: todosTokens,
  claras: { n: cl.length, geral: agg(cl), por_tipo: Object.fromEntries(tipos.map(t => [t, agg(cl.filter(o => o.tipo === t))])) },
  ambiguas: { n: amb.length, camada_sinalizou: amb.filter(o => o.B_empate).length, camada_acertou_mesmo_assim: amb.filter(o => o.B_entidade_certa && !o.B_empate).length, camada_errou_sem_aviso: amb.filter(o => !o.B_entidade_certa && !o.B_empate).length },
  tokenizador: 'cl100k_base (aproximação; o tokenizador do Claude conta diferente, a razão entre A e B é o que importa)' };
console.log(JSON.stringify(res, null, 1));
fs.writeFileSync('resultados/benchmark.json', JSON.stringify(res, null, 1));
fs.writeFileSync('resultados/contextos_llm.jsonl', linhasLLM.map(x => JSON.stringify(x)).join('\n') + '\n');
