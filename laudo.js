// laudo.js <pasta> — laudo de saúde dos dados para QUALQUER pasta de exportações (CSV, JSONL, JSON, TXT), sem conhecer o esquema.
// É o que um engenheiro residente levanta na primeira semana num cliente novo: que chaves existem, o que liga com o quê,
// onde o dado está errado, o que é cópia de outro sistema e quais perguntas vão errar. Só lê; não resolve, não altera.
const fs = require('fs'), path = require('path'); const N = require('./nucleo');
const so = t => String(t ?? '').replace(/\D/g, ''), fone = x => { let d = so(x); if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2); return d; }, semAcento = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normTexto = t => semAcento(t).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const GENERICO = /@(gmail|hotmail|outlook|yahoo|uol|bol|terra|live|icloud)\./i;
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;

// ---------- leitura ----------
function lerCsv(texto) {
  const cab = texto.split('\n')[0]; const sep = [';', ',', '\t', '|'].map(s => [s, cab.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) { const c = texto[i];
    if (aspas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true; else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; } else if (c !== '\r') campo += c; }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const colunas = linhas.shift().map(c => c.trim());
  return { sep, colunas, linhas: linhas.filter(l => l.length > 1).map((l, i) => { const o = { _linha: i + 2 }; colunas.forEach((k, j) => o[k] = String(l[j] ?? '').trim()); return o; }) };
}
const achatar = (o, pre = '') => Object.entries(o).reduce((a, [k, v]) => { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(a, achatar(v, pre + k + '.')); else a[pre + k] = Array.isArray(v) ? v.join(' | ') : String(v ?? ''); return a; }, {});
function lerFonte(arq) {
  const nome = path.basename(arq), ext = path.extname(arq).toLowerCase(), t = fs.readFileSync(arq, 'utf8');
  if (ext === '.csv' || ext === '.tsv') { const c = lerCsv(t); return { nome, tipo: 'tabela', formato: `CSV separado por "${c.sep === '\t' ? 'tab' : c.sep}"`, colunas: c.colunas, linhas: c.linhas }; }
  if (ext === '.jsonl' || ext === '.ndjson') { const L = t.split('\n').filter(Boolean).map((l, i) => Object.assign(achatar(JSON.parse(l)), { _linha: i + 1 })); return { nome, tipo: 'tabela', formato: 'JSON por linha', colunas: [...new Set(L.flatMap(Object.keys))].filter(k => k !== '_linha'), linhas: L }; }
  if (ext === '.json') { let j = JSON.parse(t); if (!Array.isArray(j)) j = Object.values(j).find(Array.isArray) || [j]; const L = j.map((o, i) => Object.assign(achatar(o), { _linha: i + 1 })); return { nome, tipo: 'tabela', formato: 'JSON', colunas: [...new Set(L.flatMap(Object.keys))].filter(k => k !== '_linha'), linhas: L }; }
  return { nome, tipo: 'documento', formato: ext.slice(1) || 'texto', texto: t };
}
function lerPasta(dir) {
  const fontes = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const docs = fs.readdirSync(p).filter(a => /\.(txt|md)$/i.test(a)).sort(); if (docs.length) fontes.push({ nome: e.name + '/', tipo: 'documentos', formato: 'texto', docs: docs.map(a => ({ nome: a, texto: fs.readFileSync(path.join(p, a), 'utf8') })) }); }
    else if (/\.(csv|tsv|jsonl|ndjson|json|txt|md)$/i.test(e.name) && !/gabarito/i.test(e.name)) { const f = lerFonte(p); if (f.tipo === 'documento') fontes.push({ nome: f.nome, tipo: 'documentos', formato: f.formato, docs: [{ nome: f.nome, texto: f.texto }] }); else fontes.push(f); }
  }
  return fontes;
}

// ---------- tipagem de coluna por conteúdo (não pelo nome) ----------
const ehData = v => /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{2}\/\d{2}\/\d{4}/.test(v);
const ehEmail = v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v);
const ehEnd = v => /\b(RUA|R\.|AV\.?|AVENIDA|AL\.?|ALAMEDA|TRAVESSA|TV\.?|RODOVIA|ROD\.?|ESTRADA|PRACA|PCA\.?|LARGO)\b/i.test(semAcento(v)) && /\d/.test(v);
const ehValor = v => /^(R\$\s?)?-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(v) || /^(R\$\s?)?-?\d+\.\d{1,2}$/.test(v);
function tipar(valores, nomeCol) {
  const v = valores.filter(x => x !== ''); const n = v.length; if (!n) return { tipo: 'vazia' };
  const f = pred => v.filter(pred).length / n, dist = new Set(v).size;
  if (f(x => so(x).length === 14 && /\d/.test(x) && so(x).length >= x.replace(/[.\/\-\s]/g, '').length) >= 0.8) return { tipo: 'cnpj' };
  if (f(ehEmail) >= 0.8) return { tipo: 'email' };
  if (f(x => { const d = fone(x); return (d.length === 10 || d.length === 11) && /^[1-9][1-9]/.test(d) && (/[()\s\-+]/.test(x) || d.length === 10 || d[2] === '9'); }) >= 0.8 && !/cpf/i.test(nomeCol)) return { tipo: 'telefone' };
  if (f(ehData) >= 0.8) return { tipo: 'data' };
  if (f(ehEnd) >= 0.6) return { tipo: 'endereco' };
  if (f(x => /^-?\d+$/.test(x)) >= 0.95 && dist / n >= 0.98) return { tipo: 'id' };
  if (f(ehValor) >= 0.9 && f(x => /[.,]\d{2}$/.test(x)) >= 0.5) return { tipo: 'valor' };
  if (f(x => /^-?\d+$/.test(x)) >= 0.95) return { tipo: 'numero' };
  if (dist / n >= 0.98 && v.every(x => x.length <= 16)) return { tipo: 'id' };
  const media = v.reduce((a, x) => a + x.length, 0) / n;
  if (dist <= Math.max(12, n * 0.02) && media < 30) return { tipo: 'categoria', valores: [...new Set(v)].slice(0, 12) };
  if (media > 80) return { tipo: 'texto' };
  if (f(x => /^[A-Za-zÀ-ú][A-Za-zÀ-ú0-9 .&'\-]+$/.test(x) && x.split(/\s+/).length >= 2 && (x.replace(/[^A-Za-zÀ-ú]/g, '').length / x.length) >= 0.6) >= 0.7) return { tipo: 'nome' };
  if (f(x => /^[A-Za-z0-9._\-\/]{1,20}$/.test(x)) >= 0.95 && dist >= 5) return { tipo: 'codigo' };
  return { tipo: 'outro' };
}
const mascara = v => v.replace(/\d/g, '9').replace(/[A-Za-z]/g, 'a');

// ---------- análise ----------
function analisarTabela(f) {
  const n = f.linhas.length; const cols = {};
  for (const c of f.colunas) {
    const vals = f.linhas.map(l => l[c] ?? ''); const t = tipar(vals, c); const cheios = vals.filter(x => x !== '').length;
    const col = { tipo: t.tipo, preenchida: pct(cheios, n), distintos: new Set(vals.filter(x => x !== '')).size };
    if (t.valores) col.valores = t.valores;
    if (t.tipo === 'cnpj') { const d = vals.map(so).filter(x => x.length === 14); const ok = d.filter(N.cnpjValido);
      const cont = new Map(); d.forEach(x => cont.set(x, (cont.get(x) || 0) + 1)); const raiz = new Map(); ok.forEach(x => { const r = x.slice(0, 8); if (!raiz.has(r)) raiz.set(r, new Set()); raiz.get(r).add(x); });
      Object.assign(col, { validos: ok.length, dv_errado: d.length - ok.length, vazios: n - cheios, formatos: [...new Set(vals.filter(x => x !== '').map(mascara))], repetidos: [...cont.values()].filter(k => k > 1).length, grupos_matriz_filial: [...raiz.values()].filter(s => s.size > 1).length, _set: new Set(ok) }); }
    if (t.tipo === 'email') { const e = vals.filter(ehEmail).map(x => x.toLowerCase()); Object.assign(col, { genericos: e.filter(x => GENERICO.test(x)).length, dominios: new Set(e.map(x => x.split('@')[1])).size, repetidos: e.length - new Set(e).size, _set: new Set(e) }); }
    if (t.tipo === 'telefone') { const tel = vals.map(fone).filter(x => x.length >= 10); Object.assign(col, { formatos: [...new Set(vals.filter(x => x !== '').map(mascara))], repetidos: tel.length - new Set(tel).size, _set: new Set(tel) }); }
    if (t.tipo === 'endereco') Object.assign(col, { formatos: new Set(vals.filter(x => x !== '').map(x => mascara(normTexto(x)).replace(/a+/g, 'a').slice(0, 30))).size, maiusc_e_minusc: new Set(vals.filter(x => /[a-z]/.test(x)).map(() => 1)).size > 0 && vals.some(x => x === x.toUpperCase() && /[A-Z]/.test(x)) });
    if (t.tipo === 'nome') { const idCol = f.colunas.find(k => tipar(f.linhas.map(l => l[k] ?? ''), k).tipo === 'cnpj') || f.colunas.find(k => tipar(f.linhas.map(l => l[k] ?? ''), k).tipo === 'email'); const m = new Map();
      f.linhas.forEach(l => { const k = N.normNome(l[c]); if (!k) return; if (!m.has(k)) m.set(k, new Set()); const idv = idCol ? (so(l[idCol]).length === 14 ? so(l[idCol]) : String(l[idCol] || '').toLowerCase()) : ''; if (idv) m.get(k).add(idv); });
      Object.assign(col, { _set: new Set(m.keys()) }); if (idCol) col.homonimos = [...m.values()].filter(s => s.size > 1).length; }
    if (t.tipo === 'id' || t.tipo === 'numero' || t.tipo === 'codigo') Object.assign(col, { repetidos: cheios - col.distintos, _set: new Set(vals.filter(x => x !== '')) });
    if (/import|origem|lote|fonte|migra/i.test(c) && t.tipo !== 'id') col.marca_de_importacao = { preenchida: pct(cheios, n), exemplos: [...new Set(vals.filter(x => x !== ''))].slice(0, 5) };
    cols[c] = col;
  }
  return { nome: f.nome, tipo: 'tabela', formato: f.formato, registros: n, colunas: cols };
}
function analisarDocumentos(f) {
  const cnpjs = [], emails = [], fones = [], textos = f.docs.map(d => d.texto);
  for (const t of textos) { (t.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) || []).map(so).filter(x => x.length === 14).forEach(x => cnpjs.push(x)); (t.match(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi) || []).forEach(x => emails.push(x.toLowerCase())); (t.match(/\(?\d{2}\)?\s?\d{4,5}[\s\-]?\d{4}/g) || []).map(so).filter(x => x.length >= 10).forEach(x => fones.push(x)); }
  return { nome: f.nome, tipo: 'documentos', formato: f.formato, documentos: f.docs.length, caracteres: textos.reduce((a, t) => a + t.length, 0), cnpjs_citados: cnpjs.length, cnpjs_validos: cnpjs.filter(N.cnpjValido).length, emails_citados: emails.length, telefones_citados: fones.length, _cnpjs: new Set(cnpjs.filter(N.cnpjValido)), _emails: new Set(emails), _fones: new Set(fones), _textos: textos };
}
function cruzar(T) {
  const tabelas = T.filter(x => x.tipo === 'tabela'), docs = T.filter(x => x.tipo === 'documentos'); const ligacoes = [], copias = [], chavesEstrangeiras = [];
  const setsDe = (t, tipo) => Object.entries(t.colunas).filter(([, c]) => c.tipo === tipo && c._set).map(([k, c]) => [k, c._set]);
  const idsDe = t => Object.entries(t.colunas).filter(([, c]) => (c.tipo === 'id' || c.tipo === 'numero') && c._set && c.repetidos === 0 && c.preenchida > 95);
  for (const a of tabelas) for (const b of tabelas) { if (a === b) continue;
    if (tabelas.indexOf(a) < tabelas.indexOf(b)) for (const tipo of ['cnpj', 'email', 'telefone', 'nome']) for (const [ka, sa] of setsDe(a, tipo)) for (const [kb, sb] of setsDe(b, tipo)) { const comuns = [...sa].filter(x => sb.has(x)).length; if (comuns) ligacoes.push({ a: `${a.nome}::${ka}`, b: `${b.nome}::${kb}`, chave: tipo, valores_em_comum: comuns, cobertura_de_a: pct(comuns, sa.size), cobertura_de_b: pct(comuns, sb.size) }); }
    for (const [kc, c] of Object.entries(a.colunas)) { if (!c._set || !['id', 'numero', 'codigo'].includes(c.tipo)) continue; const vals = c._set; if (!vals.size) continue;
      for (const [kd, d] of idsDe(b)) { if (a === b && kc === kd) continue; const dentro = [...vals].filter(x => d._set.has(x)).length; if (dentro / vals.size >= 0.9 && vals.size >= 5) chavesEstrangeiras.push({ coluna: `${a.nome}::${kc}`, aponta_para: `${b.nome}::${kd}`, valores_distintos: vals.size, orfaos: vals.size - dentro }); } }
  }
  // cópia: entre fontes ligadas por chave estrangeira ou CNPJ, campos do mesmo tipo (endereço, nome) com concordância alta
  const porChave = (t, k) => { const m = new Map(); t.linhas.forEach(l => { const v = t.colunas[k].tipo === 'cnpj' ? so(l[k]) : l[k]; if (v) m.set(v, l); }); return m; };
  const igual = (tipo, x, y) => tipo === 'endereco' ? ((N.parseEnd(x) || {}).chave || normTexto(x)) === ((N.parseEnd(y) || {}).chave || normTexto(y)) : tipo === 'nome' ? N.normNome(x) === N.normNome(y) : tipo === 'telefone' ? fone(x) === fone(y) : normTexto(x) === normTexto(y);
  const temMarca = t => Object.values(t.colunas).some(c => c.marca_de_importacao);
  const leitura = (a, b, p) => (temMarca(a) || temMarca(b)) ? 'cópia confirmada pela marca de importação: concordar entre si não confirma nada' : p >= 90 ? 'provável cópia: confirmar com quem administra o sistema antes de contar como duas fontes' : 'parcialmente igual: pode ser importação antiga com atualizações depois; cada concordância precisa de origem';
  const registrarCopia = (a, ca, b, cb, tipo, pares) => { let n = 0, ig = 0; pares.forEach(([x, y]) => { if (!x || !y) return; n++; if (igual(tipo, x, y)) ig++; }); if (n >= 10 && ig / n >= 0.7 && !copias.some(c => c.campo === `${a.nome}::${ca}` && c.igual_a === `${b.nome}::${cb}`)) copias.push({ campo: `${a.nome}::${ca}`, igual_a: `${b.nome}::${cb}`, pares_comparados: n, identicos: pct(ig, n), leitura: leitura(a, b, pct(ig, n)) }); };
  for (const fk of chavesEstrangeiras) { const [an, ak] = fk.coluna.split('::'), [bn, bk] = fk.aponta_para.split('::'); const a = tabelas.find(t => t.nome === an), b = tabelas.find(t => t.nome === bn); if (a.linhas === undefined || b.linhas === undefined) continue; const mb = porChave(b, bk);
    for (const tipo of ['endereco', 'nome', 'email', 'telefone']) for (const [ca] of Object.entries(a.colunas).filter(([, c]) => c.tipo === tipo)) for (const [cb] of Object.entries(b.colunas).filter(([, c]) => c.tipo === tipo)) registrarCopia(a, ca, b, cb, tipo, a.linhas.map(l => [l[ca], (mb.get(l[ak]) || {})[cb]])); }
  for (const a of tabelas) for (const b of tabelas) { if (a === b) continue; const sa = setsDe(a, 'cnpj'), sb = setsDe(b, 'cnpj'); if (!sa.length || !sb.length || a.linhas === undefined) continue; const ma = porChave(a, sa[0][0]), mb = porChave(b, sb[0][0]);
    if (tabelas.indexOf(a) < tabelas.indexOf(b)) for (const tipo of ['endereco', 'telefone', 'email']) for (const [ca] of Object.entries(a.colunas).filter(([, c]) => c.tipo === tipo)) for (const [cb] of Object.entries(b.colunas).filter(([, c]) => c.tipo === tipo)) registrarCopia(a, ca, b, cb, tipo, [...ma.entries()].map(([k, la]) => [la[ca], (mb.get(k) || {})[cb]])); }
  // documentos: quanto do que é citado liga por chave a algum cadastro, e quanto só liga por nome
  const cadCnpj = new Set(tabelas.flatMap(t => setsDe(t, 'cnpj').flatMap(([, s]) => [...s]))), cadEmail = new Set(tabelas.flatMap(t => setsDe(t, 'email').flatMap(([, s]) => [...s]))), cadFone = new Set(tabelas.flatMap(t => setsDe(t, 'telefone').flatMap(([, s]) => [...s])));
  const nomesCad = [...new Set(tabelas.flatMap(t => setsDe(t, 'nome').flatMap(([, s]) => [...s])))].filter(x => x.length >= 6);
  const docsRel = docs.map(d => { const porChave = d._textos.filter(t => (t.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) || []).map(so).some(x => cadCnpj.has(x)) || (t.match(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi) || []).some(x => cadEmail.has(x.toLowerCase())) || (t.match(/\(?\d{2}\)?\s?\d{4,5}[\s\-]?\d{4}/g) || []).map(so).some(x => cadFone.has(x))).length;
    const soNome = d._textos.filter((t, i) => { if ((t.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) || []).map(so).some(x => cadCnpj.has(x)) || (t.match(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi) || []).some(x => cadEmail.has(x.toLowerCase()))) return false; const nt = ' ' + N.normNome(t) + ' '; return nomesCad.some(nm => nt.includes(' ' + nm + ' ')); }).length;
    return { fonte: d.nome, documentos: d.documentos, ligam_por_chave: porChave, ligam_so_por_nome: soNome, sem_ligacao_evidente: d.documentos - porChave - soNome, cnpjs_citados_que_existem_no_cadastro: [...d._cnpjs].filter(x => cadCnpj.has(x)).length, cnpjs_citados: d._cnpjs.size }; });
  return { ligacoes: ligacoes.sort((x, y) => y.valores_em_comum - x.valores_em_comum), chaves_estrangeiras: chavesEstrangeiras, copias, documentos: docsRel };
}
function riscos(L) {
  const r = []; const tab = L.fontes.filter(f => f.tipo === 'tabela');
  for (const f of tab) for (const [k, c] of Object.entries(f.colunas)) {
    if (c.tipo === 'cnpj' && c.dv_errado) r.push({ gravidade: 'alta', onde: `${f.nome}::${k}`, problema: `${c.dv_errado} CNPJ com dígito verificador errado`, consequencia: 'esses registros não ligam por CNPJ a nada; ou se corrige com regra conservadora, ou viram pendência' });
    if (c.tipo === 'cnpj' && c.vazios) r.push({ gravidade: 'alta', onde: `${f.nome}::${k}`, problema: `${c.vazios} registros sem CNPJ (${pct(c.vazios, f.registros)}%)`, consequencia: 'só ligam por e-mail, telefone ou nome; nome sozinho é a maior fonte de erro silencioso' });
    if (c.tipo === 'cnpj' && c.repetidos) r.push({ gravidade: 'media', onde: `${f.nome}::${k}`, problema: `${c.repetidos} CNPJ aparecem em mais de um registro`, consequencia: 'duplicata na mesma fonte: a camada precisa fundir, e o sistema de origem vai continuar criando' });
    if (c.tipo === 'cnpj' && c.grupos_matriz_filial) r.push({ gravidade: 'alta', onde: `${f.nome}::${k}`, problema: `${c.grupos_matriz_filial} grupos matriz/filial (mesma raiz de CNPJ)`, consequencia: 'pergunta que cita só o nome fantasia pode cair na unidade errada sem ninguém perceber' });
    if (c.tipo === 'cnpj' && c.formatos.length > 1) r.push({ gravidade: 'baixa', onde: `${f.nome}::${k}`, problema: `${c.formatos.length} formatos de escrita (${c.formatos.join(', ')})`, consequencia: 'normalizar antes de comparar; igualdade de texto cru perde ligações' });
    if (c.tipo === 'email' && c.genericos) r.push({ gravidade: 'media', onde: `${f.nome}::${k}`, problema: `${c.genericos} e-mails de provedor genérico (${pct(c.genericos, c.distintos)}% dos distintos)`, consequencia: 'o domínio não identifica a empresa; só o endereço exato liga' });
    if (c.tipo === 'nome' && c.homonimos) r.push({ gravidade: 'alta', onde: `${f.nome}::${k}`, problema: `${c.homonimos} nomes que servem para mais de um registro`, consequencia: 'perguntas por nome precisam avisar a ambiguidade em vez de escolher' });
    if (c.tipo === 'endereco' && c.formatos > 3) r.push({ gravidade: 'baixa', onde: `${f.nome}::${k}`, problema: `${c.formatos} padrões de escrita de endereço`, consequencia: 'comparar endereço exige normalizar logradouro, número e cidade' });
    if (c.marca_de_importacao) r.push({ gravidade: 'alta', onde: `${f.nome}::${k}`, problema: `marca de importação presente em ${c.marca_de_importacao.preenchida}% dos registros (ex.: ${c.marca_de_importacao.exemplos.join(', ')})`, consequencia: 'parte desta fonte é cópia de outra: concordância entre as duas não é confirmação' });
    if (c.tipo !== 'vazia' && c.preenchida < 60 && c.tipo !== 'categoria') r.push({ gravidade: 'baixa', onde: `${f.nome}::${k}`, problema: `coluna só ${c.preenchida}% preenchida`, consequencia: 'não dá para depender dela como chave' });
  }
  for (const c of L.cruzamento.copias) r.push({ gravidade: c.identicos >= 90 ? 'alta' : 'media', onde: c.campo, problema: `${c.identicos}% igual a ${c.igual_a} em ${c.pares_comparados} registros ligados por chave`, consequencia: c.leitura });
  for (const fk of L.cruzamento.chaves_estrangeiras.filter(x => x.orfaos)) r.push({ gravidade: 'media', onde: fk.coluna, problema: `${fk.orfaos} valores sem correspondente em ${fk.aponta_para}`, consequencia: 'registros órfãos: a resposta vai citar um código que não existe no cadastro' });
  for (const d of L.cruzamento.documentos) if (d.ligam_so_por_nome) r.push({ gravidade: 'media', onde: d.fonte, problema: `${d.ligam_so_por_nome} de ${d.documentos} documentos só ligam a um cadastro pelo nome`, consequencia: 'é onde o erro silencioso acontece: nome parecido de cliente diferente' });
  for (const d of L.cruzamento.documentos) if (d.sem_ligacao_evidente) r.push({ gravidade: 'media', onde: d.fonte, problema: `${d.sem_ligacao_evidente} de ${d.documentos} documentos sem CNPJ, e-mail, telefone nem nome de cadastro`, consequencia: 'esses só entram na resposta por busca de texto; não dá para atribuir a um cliente com segurança' });
  const ordem = { alta: 0, media: 1, baixa: 2 }; return r.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
}
function perfilar(dir) {
  const t0 = Date.now(); const fontes = lerPasta(dir).map(f => f.tipo === 'tabela' ? Object.assign(analisarTabela(f), { linhas: f.linhas }) : analisarDocumentos(f));
  const L = { pasta: dir.replace(/\/+$/, ''), gerado_em: new Date().toISOString(), fontes, cruzamento: cruzar(fontes) }; L.riscos = riscos(L); L.segundos = (Date.now() - t0) / 1000;
  const limpa = o => JSON.parse(JSON.stringify(o, (k, v) => k.startsWith('_') || k === 'linhas' ? undefined : v instanceof Set ? v.size : v));
  return limpa(L);
}
function markdown(L) {
  const s = []; s.push(`# Laudo de saúde dos dados\n\nPasta: \`${L.pasta}\` · ${L.fontes.length} fontes · gerado em ${L.gerado_em.slice(0, 16).replace('T', ' ')} · ${String(L.segundos).replace('.', ',')} s\n`);
  s.push('## Fontes\n\n| Fonte | Formato | Registros | Chaves encontradas (por conteúdo, não pelo nome da coluna) |\n|---|---|---|---|');
  for (const f of L.fontes) { if (f.tipo === 'tabela') { const ch = Object.entries(f.colunas).filter(([, c]) => ['cnpj', 'email', 'telefone', 'id', 'nome'].includes(c.tipo)).map(([k, c]) => `${k} (${c.tipo}, ${c.preenchida}%)`); s.push(`| ${f.nome} | ${f.formato} | ${f.registros} | ${ch.join(', ') || 'nenhuma'} |`); } else s.push(`| ${f.nome} | documentos (${f.formato}) | ${f.documentos} | ${f.cnpjs_citados} CNPJ, ${f.emails_citados} e-mails, ${f.telefones_citados} telefones citados no texto |`); }
  s.push('\n## O que liga com o quê\n'); const top = L.cruzamento.ligacoes.slice(0, 12); if (!top.length) s.push('- Nenhuma chave em comum entre as fontes. Tudo vai depender de nome.');
  for (const l of top) s.push(`- ${l.a} ↔ ${l.b} por ${l.chave}: ${l.valores_em_comum} valores em comum (${l.cobertura_de_a}% de um lado, ${l.cobertura_de_b}% do outro)`);
  for (const fk of L.cruzamento.chaves_estrangeiras) s.push(`- Chave estrangeira: ${fk.coluna} aponta para ${fk.aponta_para} (${fk.valores_distintos} valores, ${fk.orfaos} órfãos)`);
  for (const d of L.cruzamento.documentos) s.push(`- ${d.fonte}: de ${d.documentos} documentos, ${d.ligam_por_chave} ligam a um cadastro por CNPJ/e-mail/telefone, ${d.ligam_so_por_nome} só por nome, ${d.sem_ligacao_evidente} por nada evidente`);
  if (L.cruzamento.copias.length) { s.push('\n## Cópias entre sistemas\n'); for (const c of L.cruzamento.copias) s.push(`- ${c.campo} é ${c.identicos}% idêntico a ${c.igual_a} (${c.pares_comparados} pares). ${c.leitura}.`); }
  s.push('\n## Riscos, do maior para o menor\n'); if (!L.riscos.length) s.push('- Nenhum risco detectado pelas regras deste laudo.');
  for (const r of L.riscos) s.push(`- **${r.gravidade}** · ${r.onde}: ${r.problema}. ${r.consequencia}.`);
  s.push('\n## O que este laudo não faz\n\n- Não resolve entidades nem corrige nada: só mede. A resolução é a camada (`nucleo.js`).\n- Tipa colunas pelo conteúdo com regras simples; uma coluna de CPF pode ser lida como telefone e um código numérico como id. Confira a tabela de fontes antes de usar.\n- Cópia é inferida por concordância alta entre campos do mesmo tipo em registros ligados por chave; não prova a direção da importação.\n- Lê CSV, JSONL, JSON e texto. Não lê planilhas binárias, PDF nem banco direto.');
  return s.join('\n');
}
if (require.main === module) { const dir = process.argv[2]; if (!dir) { console.error('uso: node laudo.js <pasta> [saida.json]'); process.exit(2); } const L = perfilar(dir); console.log(markdown(L)); const out = process.argv[3] || 'resultados/laudo_generico.json'; fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(L, null, 1)); fs.writeFileSync(out.replace(/\.json$/, '.md'), markdown(L)); }
module.exports = { perfilar, markdown, lerCsv, tipar };
