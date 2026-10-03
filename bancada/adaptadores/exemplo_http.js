// Adaptador de exemplo para um Company Brain que atende por HTTP. Copie, troque a URL e o formato da resposta.
// Contrato: preparar({ arq, dir }) recebe os textos crus das fontes e a pasta; responder({ texto, tipo, alvo }) devolve
// { contexto: string, resposta?: valor, aviso?: boolean, nao_encontrado?: boolean }.
// O contexto precisa citar os registros de origem pelos ids da base (crm:C0012, erp:10045, nf:000123, ct:CT-0007, em:E019, ch:4107):
// a bancada mede se a evidência certa chegou, e evidência sem origem não conta.
const URL = process.env.BRAIN_URL || 'http://localhost:8080/perguntar';
module.exports = {
  nome: 'company brain via HTTP',
  async preparar({ dir }) { await fetch(URL.replace('/perguntar', '/indexar'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pasta: dir }) }); },
  async responder({ texto }) { const r = await (await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pergunta: texto }) })).json();
    return { contexto: r.contexto_usado || '', resposta: r.resposta ?? null, aviso: !!r.ambiguo, nao_encontrado: !!r.nao_encontrado }; }
};
