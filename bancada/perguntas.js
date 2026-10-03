// bancada/perguntas.js — gera as perguntas de uma base a partir do gabarito, com a lista de registros que a resposta exige (ouro),
// marca as ambíguas pela verdade (nome que cabe em mais de um cliente real) e planta armadilhas.
const N = require('../nucleo');
const normEnd = t => (N.parseEnd(t) || {}).chave;
module.exports = function perguntas(g) {
  const Q = []; const nomesVerd = g.entidades.map(e => [e.id, [N.normNome(e.fantasia), N.normNome(e.razao)]]);
  const ambigua = v => { const tk = N.normNome(v).split(' '); return nomesVerd.filter(([, ns]) => ns.some(n => { const s2 = new Set(n.split(' ')); return tk.every(t => s2.has(t)); })).length > 1; };
  for (const e of g.entidades) {
    const v = e.variantes_pergunta[0];
    if (e.muda) { const ult = e.ev_end_atual.slice().sort((a, b) => b.data.localeCompare(a.data))[0]; Q.push({ v, tipo: 'endereço atual (cliente que mudou)', ent: e.id, texto: `Qual é o endereço atual do cliente ${v}?`, ouro: [ult.ref], resposta: normEnd(e.endereco_atual), formato: 'endereco' }); }
    if (e.notas_atrasadas.length) Q.push({ v, tipo: 'total em atraso', ent: e.id, texto: `Quanto o cliente ${v} tem em notas fiscais atrasadas?`, ouro: e.notas_atrasadas.map(x => x.ref), resposta: Math.round(e.notas_atrasadas.reduce((a, x) => a + x.valor, 0) * 100) / 100, formato: 'numero' });
    if (e.chamados.length) Q.push({ v, tipo: 'chamados do cliente', ent: e.id, texto: `Quantos chamados de suporte o cliente ${v} abriu e quais foram?`, ouro: e.chamados, resposta: e.chamados.length, formato: 'numero' });
    if (e.contrato) Q.push({ v, tipo: 'faturado diverge do contrato?', ent: e.id, texto: `O valor faturado para o cliente ${v} diverge mais de 4% do valor mensal do contrato?`, ouro: ['ct:' + e.contrato, ...e.registros.filter(r => r.startsWith('nf:'))], resposta: e.diverge_valor, formato: 'booleano' });
  }
  Q.forEach(q => q.ambigua = ambigua(q.v));
  // armadilhas: o certo é avisar ou devolver nada, nunca inventar
  const A = [];
  ['Transportadora Fantasma do Norte', 'Clínica Veterinária Inexistente', 'Posto Miragem Combustíveis'].forEach(v => A.push({ v, tipo: 'cliente inexistente', texto: `Quanto o cliente ${v} tem em notas fiscais atrasadas?`, esperado: 'nenhuma entidade, ou aviso de não encontrado' }));
  const grupos = new Map(); g.entidades.filter(e => e.grupo).forEach(e => { if (!grupos.has(e.grupo)) grupos.set(e.grupo, []); grupos.get(e.grupo).push(e); });
  [...grupos.values()].filter(l => l.length > 1).slice(0, 3).forEach(l => { const comum = N.normNome(l[0].fantasia).split(' ').filter(t => l.every(e => N.normNome(e.fantasia).includes(t))).join(' '); if (comum) A.push({ v: comum.toLowerCase(), tipo: 'matriz/filial sem cidade', texto: `Qual é o endereço atual do cliente ${comum.toLowerCase()}?`, esperado: 'aviso de que o nome serve para mais de uma unidade', unidades: l.map(e => e.id) }); });
  return { claras: Q.filter(q => !q.ambigua), ambiguas: Q.filter(q => q.ambigua), armadilhas: A };
};
