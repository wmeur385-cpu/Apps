// Adaptador: busca por palavra-chave (linha de base). Devolve os K trechos mais parecidos com a pergunta e não responde nada sozinho.
const montar = require('../base_bm25'); let B, K = +(process.env.BANCADA_K || 20);
module.exports = {
  nome: `busca BM25 top-${K}`,
  preparar({ arq }) { B = montar(arq); },
  responder({ texto }) { const ret = B.bm25(texto, K); return { contexto: ret.map(d => `[${d.ref}] ${d.texto}`).join('\n') }; }
};
