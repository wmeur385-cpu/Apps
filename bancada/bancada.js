// bancada/bancada.js — bancada de medição para "Company Brains": mesmas perguntas, mesmos dados, qualquer sistema.
// uso: node bancada/bancada.js --sistema bancada/adaptadores/camada.js [--sementes 9101,9102,9103] [--k 20] [--saida resultados/bancada.json]
const fs = require('fs'), path = require('path'); const N = require('../nucleo'); const { gerar } = require('../gerar_dados'); const perguntas = require('./perguntas');
let enc; try { enc = require('js-tiktoken').getEncoding('cl100k_base'); } catch { enc = null; }
const tok = t => enc ? enc.encode(t).length : Math.round(t.length / 3.6);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const normEnd = t => (N.parseEnd(t) || {}).chave;
const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
function certa(q, r) { if (r === null || r === undefined) return false; if (q.formato === 'numero') return Math.abs(+r - q.resposta) < 0.011; if (q.formato === 'booleano') return r === q.resposta; return normEnd(String(r)) === q.resposta; }
async function medir(adaptador, semente, dir) {
  const { arq, gab } = gerar(semente); if (dir) { /* a base também pode ser gravada em disco para sistemas que leem arquivos */ }
  await adaptador.preparar({ arq, dir, semente }); const P = perguntas(gab); const out = [];
  for (const q of [...P.claras, ...P.ambiguas]) { const r = await adaptador.responder({ texto: q.texto, tipo: q.tipo, alvo: q.v }); const ctx = String(r.contexto || '');
    const tem = ref => ctx.includes(ref) || (ref.includes('#') && ctx.includes(ref.split('#')[0])); // "ct:CT-0007#ad1" é uma parte do contrato CT-0007: se o contrato inteiro chegou, a parte chegou
    out.push({ tipo: q.tipo, ambigua: q.ambigua, completa: q.ouro.every(tem), fracao: q.ouro.filter(tem).length / q.ouro.length, tokens: tok(ctx), respondeu: r.resposta !== null && r.resposta !== undefined, certa: certa(q, r.resposta), aviso: !!r.aviso }); }
  const arm = [];
  for (const a of P.armadilhas) { const r = await adaptador.responder({ texto: a.texto, tipo: a.tipo === 'cliente inexistente' ? 'total em atraso' : 'endereço atual (cliente que mudou)', alvo: a.v }); const ctx = String(r.contexto || '');
    const pegou = a.tipo === 'cliente inexistente' ? (!!r.nao_encontrado || !!r.aviso || (!ctx.trim() && (r.resposta === null || r.resposta === undefined))) : (!!r.aviso || (a.unidades && a.unidades.filter(u => ctx.includes(u)).length >= 2));
    arm.push({ tipo: a.tipo, alvo: a.v, pegou, tokens: tok(ctx) }); }
  const cl = out.filter(o => !o.ambigua), amb = out.filter(o => o.ambigua); const tipos = [...new Set(cl.map(o => o.tipo))];
  const agg = l => ({ n: l.length, evidencia_completa: pct(l.filter(o => o.completa).length, l.length), tokens_mediana: med(l.map(o => o.tokens)), responde_sozinho: l.some(o => o.respondeu) ? pct(l.filter(o => o.certa).length, l.length) : null });
  return { semente, perguntas: out.length, claras: { geral: agg(cl), por_tipo: Object.fromEntries(tipos.map(t => [t, agg(cl.filter(o => o.tipo === t))])) },
    ambiguas: { n: amb.length, avisou: amb.filter(o => o.aviso).length, sem_aviso: amb.filter(o => !o.aviso).length, sem_aviso_e_errou: amb.filter(o => !o.aviso && o.respondeu && !o.certa).length },
    armadilhas: { n: arm.length, pegou: arm.filter(a => a.pegou).length, caiu: arm.filter(a => !a.pegou).map(a => `${a.tipo}: ${a.alvo}`) } };
}
function faixa(rs, f) { const v = rs.map(f).filter(x => x !== null); return v.length ? { min: Math.min(...v), mediana: med(v), max: Math.max(...v) } : null; }
async function main() {
  const sis = arg('sistema'); if (!sis) { console.error('uso: node bancada/bancada.js --sistema <adaptador.js> [--sementes a,b,c] [--k 20]'); process.exit(2); }
  if (arg('k')) process.env.BANCADA_K = arg('k');
  const adaptador = require(path.resolve(sis)); const sementes = (arg('sementes', '9101,9102,9103')).split(',').map(Number);
  const t0 = Date.now(); const rs = []; for (const s of sementes) rs.push(await medir(adaptador, s));
  const R = { sistema: adaptador.nome, sementes, segundos: (Date.now() - t0) / 1000, tokenizador: enc ? 'cl100k_base (aproximação)' : 'estimativa por caracteres', por_semente: rs,
    faixa: { evidencia_completa: faixa(rs, r => r.claras.geral.evidencia_completa), tokens_mediana: faixa(rs, r => r.claras.geral.tokens_mediana), responde_sozinho: faixa(rs, r => r.claras.geral.responde_sozinho),
      ambiguas_sem_aviso: faixa(rs, r => r.ambiguas.sem_aviso), armadilhas_pegou: faixa(rs, r => r.armadilhas.pegou) } };
  const saida = arg('saida', `resultados/bancada_${path.basename(sis, '.js')}.json`); fs.mkdirSync(path.dirname(saida), { recursive: true }); fs.writeFileSync(saida, JSON.stringify(R, null, 1));
  const F = R.faixa, f = x => x ? `${x.min}–${x.max} (mediana ${x.mediana})` : 'não responde sozinho';
  console.log(`${R.sistema} · ${sementes.length} bases · ${R.segundos}s\n- evidência completa: ${f(F.evidencia_completa)}%\n- tokens por pergunta (mediana): ${f(F.tokens_mediana)}\n- responde certo sem modelo: ${f(F.responde_sozinho)}${F.responde_sozinho ? '%' : ''}\n- ambíguas sem aviso: ${f(F.ambiguas_sem_aviso)} de ${rs.map(r => r.ambiguas.n).join('/')} por base\n- armadilhas pegas: ${f(F.armadilhas_pegou)} de ${rs[0].armadilhas.n}\n→ ${saida}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { medir };
