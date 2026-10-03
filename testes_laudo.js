// testes_laudo.js — o laudo tem que achar o que foi plantado, achar o mesmo com o esquema trocado, e bater com uma contagem independente
const fs = require('fs'), path = require('path'), os = require('os'); const N = require('./nucleo'); const { perfilar, lerCsv } = require('./laudo');
let ok = 0, falhas = 0; const t = (nome, cond, info) => { if (cond) ok++; else { falhas++; console.log('FALHA', nome, info ?? ''); } };
const so = x => String(x || '').replace(/\D/g, ''); const col = (L, fonte, c) => L.fontes.find(f => f.nome === fonte).colunas[c];
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'laudo-'));
const csv = (cab, linhas, sep = ';') => [cab.join(sep), ...linhas.map(l => l.map(v => /[";,\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v).join(sep))].join('\n') + '\n';

// ---------- 1. oráculo independente sobre dados/ ----------
{
  const L = perfilar('dados'); const crm = lerCsv(fs.readFileSync('dados/crm.csv', 'utf8')).linhas, erp = lerCsv(fs.readFileSync('dados/erp_clientes.csv', 'utf8')).linhas;
  const dvErr = l => l.map(x => so(x.cnpj)).filter(x => x.length === 14 && !N.cnpjValido(x)).length;
  t('dv errado crm bate com contagem independente', col(L, 'crm.csv', 'cnpj').dv_errado === dvErr(crm), [col(L, 'crm.csv', 'cnpj').dv_errado, dvErr(crm)]);
  t('dv errado erp bate', col(L, 'erp_clientes.csv', 'cnpj').dv_errado === dvErr(erp));
  const raizes = l => { const m = new Map(); l.map(x => so(x.cnpj)).filter(N.cnpjValido).forEach(x => { const r = x.slice(0, 8); if (!m.has(r)) m.set(r, new Set()); m.get(r).add(x); }); return [...m.values()].filter(s => s.size > 1).length; };
  t('grupos matriz/filial crm batem', col(L, 'crm.csv', 'cnpj').grupos_matriz_filial === raizes(crm));
  t('vazios crm batem', col(L, 'crm.csv', 'cnpj').vazios === crm.filter(x => !x.cnpj).length);
  t('telefone tipado por conteúdo', col(L, 'crm.csv', 'telefone').tipo === 'telefone');
  t('chave estrangeira notas→clientes, 0 órfãos', L.cruzamento.chaves_estrangeiras.some(f => f.coluna === 'erp_notas.csv::cod_erp' && f.aponta_para === 'erp_clientes.csv::cod_erp' && f.orfaos === 0), L.cruzamento.chaves_estrangeiras);
  t('cópia CRM→ERP de endereço detectada', L.cruzamento.copias.some(c => c.campo === 'crm.csv::endereco' && c.igual_a === 'erp_clientes.csv::endereco_cobranca' && c.identicos >= 80));
  t('marca de importação do ERP vista', !!col(L, 'erp_clientes.csv', 'lote_importacao').marca_de_importacao);
  t('contratos ligam por CNPJ na maioria', L.cruzamento.documentos[0].ligam_por_chave >= 180 && L.cruzamento.documentos[0].sem_ligacao_evidente === 0);
  t('núcleo não é usado para resolver', !JSON.stringify(L).includes('ENT-'));
}
// ---------- 2. mesma base, esquema trocado: nomes inúteis, vírgula, máscaras misturadas, +55, JSON aninhado ----------
{
  const d = tmp(); const crm = lerCsv(fs.readFileSync('dados/crm.csv', 'utf8')).linhas, erp = lerCsv(fs.readFileSync('dados/erp_clientes.csv', 'utf8')).linhas, nf = lerCsv(fs.readFileSync('dados/erp_notas.csv', 'utf8')).linhas;
  const mask = (c, i) => { const x = so(c); if (x.length !== 14) return c; return i % 3 === 0 ? x : i % 3 === 1 ? `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}` : `${x.slice(0, 8)} ${x.slice(8, 12)} ${x.slice(12)}`; };
  fs.writeFileSync(path.join(d, 'Export_Clientes_v3.csv'), csv(['col1', 'Nome do Cliente', 'Documento', 'E-mail', 'Fone', 'Responsável', 'Logradouro completo', 'dt', 'vend'], crm.map((x, i) => [x.id_crm, x.empresa, mask(x.cnpj, i), x.email, (x.telefone.startsWith('+') ? x.telefone : '+55 ' + x.telefone), x.contato, x.endereco.toLowerCase(), x.endereco_atualizado_em, x.vendedor]), ','));
  fs.writeFileSync(path.join(d, 'cadastro_financeiro.jsonl'), erp.map(x => JSON.stringify({ codigo: x.cod_erp, cliente: { razao: x.razao_social, doc: x.cnpj ? so(x.cnpj) : '' }, cobranca: { endereco: x.endereco_cobranca }, desde: x.data_cadastro, lote: x.lote_importacao })).join('\n') + '\n');
  fs.writeFileSync(path.join(d, 'faturas.json'), JSON.stringify({ exportado: '2026-10-02', itens: nf.map(x => ({ numero: x.nf, cliente: x.cod_erp, data: x.emissao, venc: x.vencimento, total: x.valor.replace('.', ','), st: x.situacao })) }));
  fs.mkdirSync(path.join(d, 'juridico')); fs.readdirSync('dados/contratos').forEach(a => fs.copyFileSync(path.join('dados/contratos', a), path.join(d, 'juridico', a)));
  const L = perfilar(d), L0 = perfilar('dados');
  t('esquema trocado: mesmo dv errado', col(L, 'Export_Clientes_v3.csv', 'Documento').dv_errado === col(L0, 'crm.csv', 'cnpj').dv_errado, [col(L, 'Export_Clientes_v3.csv', 'Documento'), col(L0, 'crm.csv', 'cnpj').dv_errado]);
  t('esquema trocado: 3 formatos de CNPJ vistos', col(L, 'Export_Clientes_v3.csv', 'Documento').formatos.length === 3, col(L, 'Export_Clientes_v3.csv', 'Documento').formatos);
  t('esquema trocado: telefone com +55 ainda é telefone', col(L, 'Export_Clientes_v3.csv', 'Fone').tipo === 'telefone');
  t('esquema trocado: JSON aninhado achatado e CNPJ achado', col(L, 'cadastro_financeiro.jsonl', 'cliente.doc').tipo === 'cnpj' && col(L, 'cadastro_financeiro.jsonl', 'cliente.doc').dv_errado === col(L0, 'erp_clientes.csv', 'cnpj').dv_errado);
  t('esquema trocado: chave estrangeira faturas→cadastro achada', L.cruzamento.chaves_estrangeiras.some(f => f.coluna === 'faturas.json::cliente' && f.aponta_para === 'cadastro_financeiro.jsonl::codigo' && f.orfaos === 0), L.cruzamento.chaves_estrangeiras);
  t('esquema trocado: cópia de endereço detectada mesmo em minúsculas', L.cruzamento.copias.some(c => /Logradouro/.test(c.campo + c.igual_a) && /cobranca.endereco/.test(c.campo + c.igual_a) && c.identicos >= 80), L.cruzamento.copias);
  t('esquema trocado: marca de importação pela coluna "lote"', !!col(L, 'cadastro_financeiro.jsonl', 'lote').marca_de_importacao);
  t('esquema trocado: valor tipado como valor', col(L, 'faturas.json', 'total').tipo === 'valor');
  t('esquema trocado: contratos ligam igual', L.cruzamento.documentos[0].ligam_por_chave === L0.cruzamento.documentos[0].ligam_por_chave);
  fs.rmSync(d, { recursive: true });
}
// ---------- 3. sabotagem plantada em base pequena ----------
{
  const d = tmp(); const cn = n => { const b = String(n).padStart(8, '0') + '0001'; const dv = (ds, p) => { const s = ds.reduce((a, x, i) => a + x * p[i], 0) % 11; return s < 2 ? 0 : 11 - s; }; const a = b.split('').map(Number); a.push(dv(a, [5,4,3,2,9,8,7,6,5,4,3,2])); a.push(dv(a, [6,5,4,3,2,9,8,7,6,5,4,3,2])); return a.join(''); };
  const nomeDe = i => `Comercio ${['Ba', 'Ce', 'Di', 'Fo', 'Gu'][i % 5]}${['la', 'mo', 'ni', 're', 'tu'][Math.floor(i / 5) % 5]}${['ra', 'so', 'ta'][Math.floor(i / 25)]} Ltda`;
  const linhas = []; for (let i = 1; i <= 40; i++) linhas.push([`A${i}`, nomeDe(i), cn(1000 + i), `contato${i}@empresa${i}.com.br`, `RUA ${i}, ${i * 10} - CENTRO - CURITIBA`]);
  const quebra = c => c.slice(0, 13) + ((+c[13] + 1) % 10); linhas[3][2] = quebra(linhas[3][2]); linhas[7][2] = quebra(linhas[7][2]); linhas[11][2] = quebra(linhas[11][2]); // 3 DV errados
  linhas[20][2] = linhas[5][2]; linhas[21][2] = linhas[6][2]; // 2 CNPJ repetidos
  linhas[30][1] = linhas[31][1] = 'Mercado Central Ltda'; // homônimo com CNPJ diferente
  linhas[34][2] = cn(1036).slice(0, 8) + '0002' + '00'; { const b = linhas[34][2].slice(0, 12).split('').map(Number); const dv = (ds, p) => { const s = ds.reduce((a, x, i) => a + x * p[i], 0) % 11; return s < 2 ? 0 : 11 - s; }; b.push(dv(b, [5,4,3,2,9,8,7,6,5,4,3,2])); b.push(dv(b, [6,5,4,3,2,9,8,7,6,5,4,3,2])); linhas[34][2] = b.join(''); } // linha 35 vira filial da 36 (raiz igual)
  fs.writeFileSync(path.join(d, 'clientes.csv'), csv(['id', 'nome', 'cnpj', 'email', 'endereco'], linhas));
  const ped = []; for (let i = 1; i <= 60; i++) ped.push([`P${i}`, i <= 56 ? `A${(i % 40) + 1}` : `A${900 + i}`, '2026-01-01', (i * 10.5).toFixed(2)]); // 4 órfãos
  fs.writeFileSync(path.join(d, 'pedidos.csv'), csv(['pedido', 'cliente', 'data', 'valor'], ped));
  fs.writeFileSync(path.join(d, 'espelho.csv'), csv(['codigo', 'cnpj', 'endereco', 'origem'], linhas.map((l, i) => [`E${i}`, l[2], i < 38 ? l[4] : 'RUA OUTRA, 1 - BAIRRO - CIDADE', 'migracao-2024'])));
  fs.mkdirSync(path.join(d, 'docs')); const doc = (n, txt) => fs.writeFileSync(path.join(d, 'docs', n), txt);
  doc('d1.txt', `Contrato com ${linhas[0][1]}, CNPJ ${linhas[0][2]}.`); doc('d2.txt', `Proposta para a empresa de CNPJ ${linhas[1][2]}.`); doc('d3.txt', `Ata com a ${linhas[2][1]} (${linhas[2][2]}).`);
  doc('d4.txt', `Reunião com a ${linhas[8][1]} sobre o novo contrato.`); doc('d5.txt', 'Memorando interno sem cliente nenhum citado.');
  const L = perfilar(d); const c = col(L, 'clientes.csv', 'cnpj');
  t('sabotagem: 3 DV errados', c.dv_errado === 3, c); t('sabotagem: 2 CNPJ repetidos', c.repetidos === 2, c.repetidos); t('sabotagem: 1 grupo matriz/filial', c.grupos_matriz_filial === 1, c.grupos_matriz_filial);
  t('sabotagem: 1 homônimo', col(L, 'clientes.csv', 'nome').homonimos === 1, col(L, 'clientes.csv', 'nome').homonimos);
  t('sabotagem: 4 órfãos na chave estrangeira', L.cruzamento.chaves_estrangeiras.some(f => f.coluna === 'pedidos.csv::cliente' && f.aponta_para === 'clientes.csv::id' && f.orfaos === 4), L.cruzamento.chaves_estrangeiras);
  t('sabotagem: espelho é cópia (38/40 iguais) com marca', L.cruzamento.copias.some(x => x.identicos >= 90 && /espelho|clientes/.test(x.campo) && /migra|marca/.test(x.leitura)), L.cruzamento.copias);
  t('sabotagem: docs 3 por chave, 1 só nome, 1 nada', (() => { const dd = L.cruzamento.documentos[0]; return dd.ligam_por_chave === 3 && dd.ligam_so_por_nome === 1 && dd.sem_ligacao_evidente === 1; })(), L.cruzamento.documentos);
  t('sabotagem: risco de DV errado aparece em primeiro bloco', L.riscos.filter(r => r.gravidade === 'alta').some(r => /dígito verificador/.test(r.problema)));
  fs.rmSync(d, { recursive: true });
}
console.log(`${ok} checagens ok, ${falhas} falhas`); process.exit(falhas ? 1 : 0);
