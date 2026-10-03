// perfilar.js [pasta] — laudo de saúde dos dados: o que um engenheiro residente descobre na primeira semana, em segundos
const N = require('./nucleo'), carregar = require('./carregar'); const fs = require('fs');
function perfilar(arq) {
  const I = N.construir(arq); const R = I.interno.R, ents = I.interno.ents; const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
  const cad = R.filter(r => r.papel === 'cadastro'); const porFonte = {}; R.forEach(r => porFonte[r.fonte] = (porFonte[r.fonte] || 0) + 1);
  const cnpj = { validos: cad.filter(r => r.cnpjOk).length, invalidos: cad.filter(r => r.cnpj.length === 14 && !r.cnpjOk).length, vazios: cad.filter(r => !r.cnpj).length, corrigidos: I.interno.correcoes.length,
    formatos: [...new Set(cad.filter(r => r.cnpjBruto).map(r => r.cnpjBruto.replace(/\d/g, '9')))] };
  const dupCrm = ents.filter(e => e.regs.filter(r => r.fonte === 'crm').length > 1).length, dupErp = ents.filter(e => e.regs.filter(r => r.fonte === 'erp').length > 1).length;
  const copias = ents.filter(e => e.regs.some(r => r.copiaDe === 'crm')).length;
  const emails = cad.map(r => r.email).filter(Boolean); const genericos = emails.filter(x => !/\.(com\.br|net|com)$/.test(x) || /@(gmail|hotmail|outlook|yahoo)\./.test(x)).length;
  const fones = [...new Set(cad.filter(r => r.fone).map(r => r.ref))].length; const ends = { formatos: [...new Set(cad.filter(r => r.end).map(r => r.end.texto.replace(/[A-Za-zÀ-ú]+/g, 'x').replace(/\d+/g, '9').slice(0, 24)))].length };
  const porNome = new Map(); ents.forEach(e => e.nomesNorm.forEach(n => { if (!porNome.has(n)) porNome.set(n, new Set()); porNome.get(n).add(e.id); })); const homonimos = [...porNome.values()].filter(s => s.size > 1).length;
  const grupos = new Set(ents.filter(e => e.grupo.size).map(e => [...e.cnpjs][0] && [...e.cnpjs][0].slice(0, 8))).size;
  let semContrato = 0, mudaram = 0, cadastroDesatualizado = 0, divergeValor = 0;
  ents.forEach(e => { const d = I.dossie(e.id); if (!d.financeiro.contrato) semContrato++; const dv = d.divergencias.find(x => x.campo === 'endereço'); if (dv) { mudaram++; if (dv.cadastros_desatualizados.length) cadastroDesatualizado++; } if (d.divergencias.some(x => x.campo.startsWith('valor'))) divergeValor++; });
  const E = I.estatisticas();
  const laudo = { registros: R.length, por_fonte: porFonte, entidades: ents.length, cnpj, duplicatas: { crm: dupCrm, erp: dupErp }, erp_importado_do_crm: copias, emails: { total: emails.length, genericos }, telefones_informados: fones,
    enderecos: { formatos_distintos: ends.formatos, clientes_com_endereco_divergente: mudaram, crm_ou_erp_desatualizados: cadastroDesatualizado }, grupos_matriz_filial: grupos, nomes_que_servem_para_mais_de_um_cliente: homonimos,
    sem_contrato: semContrato, faturado_diverge_do_contrato: divergeValor, mencoes: { total: E.mencoes, ligadas: E.mencoes_ligadas, pendentes: E.ambiguos }, chaves_que_ligaram: Object.fromEntries([...new Set(I.interno.motivos.map(m => m.motivo.replace(/CNPJ .* corrigido para \d+/, 'CNPJ corrigido')))].map(m => [m, I.interno.motivos.filter(x => x.motivo.replace(/CNPJ .* corrigido para \d+/, 'CNPJ corrigido') === m).length])) };
  const md = `# Laudo de saúde dos dados\n\n- ${R.length} registros em ${Object.keys(porFonte).length} fontes viraram ${ents.length} clientes.\n- CNPJ: ${cnpj.validos} válidos, ${cnpj.invalidos} com dígito verificador errado (${cnpj.corrigidos} corrigíveis com segurança), ${cnpj.vazios} vazios, ${cnpj.formatos.length} formatos de escrita.\n- Duplicatas: ${dupCrm} clientes com mais de um cadastro no CRM, ${dupErp} com mais de um código no ERP.\n- ${copias} clientes (${pct(copias, ents.length)}%) têm o ERP importado do CRM: concordância entre os dois não confirma nada.\n- E-mails: ${genericos} de ${emails.length} são de provedor genérico (sem domínio da empresa para ligar cadastros).\n- Endereço: ${mudaram} clientes com versões divergentes entre fontes; em ${cadastroDesatualizado} o CRM ou o ERP ainda têm o endereço antigo.\n- ${grupos} grupos matriz/filial (mesma raiz de CNPJ) e ${homonimos} nomes que servem para mais de um cliente: as duas maiores fontes de erro silencioso.\n- ${semContrato} clientes sem contrato encontrado; ${divergeValor} com faturado divergindo mais de 4% do contrato.\n- Menções em e-mails e chamados: ${E.mencoes_ligadas} de ${E.mencoes} ligadas com segurança, ${E.ambiguos} deixadas pendentes para uma pessoa decidir.\n`;
  return { laudo, md };
}
if (require.main === module) { const { laudo, md } = perfilar(carregar(process.argv[2])); console.log(md); fs.mkdirSync('resultados', { recursive: true }); fs.writeFileSync('resultados/laudo.json', JSON.stringify(laudo, null, 1)); }
module.exports = { perfilar };
