#!/usr/bin/env node
// avaliar_llm.js — etapa G: um modelo barato (Haiku) responde às MESMAS perguntas com o contexto A (busca)
// e com o contexto B (camada). Conta acertos e tokens reais cobrados pela API.
// Roda no VPS:  ANTHROPIC_API_KEY=... node avaliar_llm.js            (mostra o tamanho e pede confirmação)
//               ANTHROPIC_API_KEY=... node avaliar_llm.js --confirmar [--n 120]
//               node avaliar_llm.js --simular                          (testa a correção sem gastar nada)
const fs = require('fs'); const N = require('./nucleo');
const arg = k => process.argv.includes(k); const nArg = process.argv.indexOf('--n');
const MODELO = process.env.MODELO || 'claude-haiku-4-5-20251001';
const todas = fs.readFileSync(__dirname + '/resultados/contextos_llm.jsonl', 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(q => !q.ambigua);
// amostra estratificada e determinística por tipo
const n = nArg > 0 ? +process.argv[nArg + 1] : todas.length; const tipos = [...new Set(todas.map(q => q.tipo))];
const amostra = tipos.flatMap(t => { const l = todas.filter(q => q.tipo === t); const k = Math.max(1, Math.round(n * l.length / todas.length)); return l.filter((_, i) => i % Math.max(1, Math.floor(l.length / k)) === 0).slice(0, k); });
const FORMATO = { 'endereço atual (cliente que mudou)': 'texto no formato "LOGRADOURO, NÚMERO"', 'total em atraso': 'número em reais, ex.: 1234.56 (0 se nada atrasado)', 'chamados do cliente': 'número inteiro de chamados', 'faturado diverge do contrato?': 'true se a média faturada diverge mais de 4% do valor mensal do contrato, senão false' };
const sistema = 'Você responde perguntas sobre clientes usando SOMENTE o contexto fornecido. Responda apenas com JSON {"resposta": ...}. Se o contexto não permitir responder, use {"resposta": null}.';
function corrige(q, r) {
  if (r === null || r === undefined) return false; const o = q.resposta_ouro;
  if (typeof o === 'boolean') return r === o || String(r).toLowerCase() === String(o);
  if (typeof o === 'number') return Math.abs(+String(r).replace(',', '.') - o) < 0.011;
  const pr = N.parseEnd(String(r)); return !!pr && pr.chave === o;
}
async function pergunta(q, ctx) {
  if (arg('--simular')) { const ok = Math.random() < 0.5; return { resposta: ok ? q.resposta_ouro : null, entrada: Math.round(ctx.length / 4), saida: 10 }; }
  for (let t = 0; t < 5; t++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELO, max_tokens: 200, system: sistema, messages: [{ role: 'user', content: `CONTEXTO:\n${ctx}\n\nPERGUNTA: ${q.pergunta}\nFormato da resposta: ${FORMATO[q.tipo]}` }] }) });
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 2000 * 2 ** t)); continue; }
    const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j));
    const txt = j.content.map(c => c.text || '').join(''); let resp = null; try { resp = JSON.parse(txt.replace(/```json|```/g, '').trim()).resposta; } catch { }
    return { resposta: resp, entrada: j.usage.input_tokens, saida: j.usage.output_tokens, bruto: txt };
  }
  throw new Error('API indisponível após 5 tentativas');
}
(async () => {
  const estA = amostra.reduce((a, q) => a + q.contexto_A.length / 4, 0), estB = amostra.reduce((a, q) => a + q.contexto_B.length / 4, 0);
  console.log(`${amostra.length} perguntas claras × 2 contextos com ${MODELO}. Entrada estimada: A≈${Math.round(estA / 1000)}k tokens, B≈${Math.round(estB / 1000)}k tokens.`);
  if (!arg('--confirmar') && !arg('--simular')) { console.log('Nada foi enviado. Rode de novo com --confirmar para gastar.'); return; }
  if (!arg('--simular') && !process.env.ANTHROPIC_API_KEY) { console.log('Falta ANTHROPIC_API_KEY.'); process.exit(1); }
  const linhas = []; let i = 0;
  const trabalho = async () => { while (i < amostra.length) { const q = amostra[i++]; const a = await pergunta(q, q.contexto_A), b = await pergunta(q, q.contexto_B);
    linhas.push({ tipo: q.tipo, pergunta: q.pergunta, ouro: q.resposta_ouro, A: a.resposta, A_ok: corrige(q, a.resposta), A_tok: a.entrada, B: b.resposta, B_ok: corrige(q, b.resposta), B_tok: b.entrada });
    process.stdout.write(`\r${linhas.length}/${amostra.length}`); } };
  await Promise.all([1, 2, 3, 4].map(trabalho)); console.log('');
  const res = {}; for (const t of [...tipos, 'GERAL']) { const l = t === 'GERAL' ? linhas : linhas.filter(x => x.tipo === t);
    res[t] = { n: l.length, A_acerto: +(l.filter(x => x.A_ok).length / l.length).toFixed(3), B_acerto: +(l.filter(x => x.B_ok).length / l.length).toFixed(3), A_tokens: l.reduce((a, x) => a + x.A_tok, 0), B_tokens: l.reduce((a, x) => a + x.B_tok, 0) }; }
  console.table(res);
  const sfx = arg('--simular') ? '_SIMULADO' : '';
  fs.writeFileSync(__dirname + `/resultados/llm${sfx}.json`, JSON.stringify({ modelo: MODELO, quando: new Date().toISOString(), resultado: res, linhas }, null, 1));
  console.log(`Salvo em resultados/llm${sfx}.json`);
})().catch(e => { console.error(e.message); process.exit(1); });
