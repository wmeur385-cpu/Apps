// Adaptador: a camada de entidades deste repositório (buscar_entidade + uma ferramenta por tipo de pergunta).
const N = require('../../nucleo'); let I;
module.exports = {
  nome: 'camada de entidades (nucleo.js ' + N.versao + ')',
  preparar({ arq, parametros }) { I = N.construir(arq, parametros || {}); },
  responder({ texto, tipo, alvo }) {
    const cands = I.buscar(alvo, 3); const id = cands[0] && cands[0].id; const aviso = !!(cands[0] && (cands[0].empate || cands[0].aviso));
    if (!id) return { contexto: JSON.stringify({ buscar_entidade: cands }), resposta: null, aviso: true, nao_encontrado: true };
    const d = I.dossie(id); let saida, resposta;
    if (tipo.startsWith('endereço')) { saida = { endereco: d.endereco, mencoes_pendentes: d.mencoes_pendentes.filter(m => m.endereco) }; resposta = d.endereco.atual && d.endereco.atual.endereco; }
    else if (tipo === 'total em atraso') { saida = { financeiro: { codigos_erp: d.financeiro.codigos_erp, atrasadas: d.financeiro.atrasadas, total_atrasado: d.financeiro.total_atrasado } }; resposta = d.financeiro.total_atrasado; }
    else if (tipo === 'chamados do cliente') { const c = I.referencias(id, 'chamado'); saida = { chamados: c }; resposta = c.filter(x => !x.pendente).length; }
    else { saida = { financeiro: d.financeiro, notas: I.referencias(id, 'nf') }; resposta = d.financeiro.desvio_contrato !== null && Math.abs(d.financeiro.desvio_contrato) > 4; }
    return { contexto: JSON.stringify({ buscar_entidade: cands, ...saida }), resposta, aviso, entidade: id };
  }
};
