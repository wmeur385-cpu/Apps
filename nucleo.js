/* nucleo.js — camada de entidades ("Serena para o que não é código").
   Um único arquivo, sem dependências. Roda igual no navegador (página offline) e no Node (servidor MCP e benchmark).
   Princípios: toda afirmação carrega a origem (ref = fonte:id); divergência é exposta, não escondida;
   cópia entre sistemas não conta como confirmação independente; o que nenhuma fonte sabe vira lacuna. */
(function (raiz) {
  'use strict';

  // ---------- parâmetros (fatores do experimento de calibração) ----------
  // Os valores padrão são os da versão 1.0. construir(arq, params) troca qualquer um deles.
  const PADRAO = {
    sim: 'max',              // A: similaridade de nomes — 'max' (max(Dice, Jaccard)) | 'jw' (Jaro-Winkler) | 'tsort' (Levenshtein com tokens ordenados)
    removeRuido: true,       // B: tirar LTDA, ME, COMERCIO… antes de comparar
    regraIncompleto: true,   // C: nome incompleto que cabe em vários clientes vira pendente
    aprendeEmail: true,      // D: aprender e-mail novo a partir de ligação forte
    guardaFone: 0.35,        // E: nome mínimo para juntar cadastros pelo telefone
    guardaDominio: 0.55,     // F: nome mínimo para juntar cadastros pelo domínio corporativo
    guardaEnd: 0.50,         // G: nome mínimo para juntar cadastros pelo endereço
    quaseIdentico: 0.86,     // H: nome quase idêntico na mesma cidade
    simCorrecaoCnpj: 0.50,   // I: nome mínimo para aceitar CNPJ corrigido (1 dígito)
    limiarMencaoNome: 0.72,  // J: ligar menção só pelo nome
    limiarContato: 0.60,     // K: contato conhecido + nome da empresa
    margem: 0.08,            // L: vantagem mínima sobre o 2º candidato (as três margens de desempate)
    grupo: 'atual',          // M: matriz/filial — 'atual' | 'exclusiva' (exige evidência que separe as unidades) | 'pendente' | 'aprende' (e-mail só decide se nunca apareceu assinando por outra unidade)
    margemBusca: 0.05, scoreMinBusca: 0.40,
  };
  let P = Object.assign({}, PADRAO);

  // ---------- utilidades ----------
  const semAcento = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const so = t => String(t || '').replace(/\D/g, '');
  function csv(texto) {
    const linhas = []; let campo = '', linha = [], aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
      else if (c === '"') aspas = true;
      else if (c === ';') { linha.push(campo); campo = ''; }
      else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
      else if (c !== '\r') campo += c;
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    const cab = linhas.shift();
    return linhas.filter(l => l.length > 1).map((l, i) => { const o = { _linha: i + 2 }; cab.forEach((k, j) => o[k] = l[j] ?? ''); return o; });
  }
  const jsonl = t => t.split('\n').filter(Boolean).map((l, i) => Object.assign(JSON.parse(l), { _linha: i + 1 }));

  // ---------- CNPJ (dígitos verificadores reais) ----------
  function dvc(d, p) { const s = d.reduce((a, x, i) => a + x * p[i], 0) % 11; return s < 2 ? 0 : 11 - s; }
  function cnpjValido(c) {
    if (!/^\d{14}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
    const d = c.slice(0, 12).split('').map(Number); d.push(dvc(d, [5,4,3,2,9,8,7,6,5,4,3,2])); d.push(dvc(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]));
    return d.join('') === c;
  }

  // ---------- nomes ----------
  const ABREV = { MERC: 'MERCADO', SUPERM: 'SUPERMERCADO', PAD: 'PADARIA', FARM: 'FARMACIA', REST: 'RESTAURANTE', LANCH: 'LANCHONETE', ACOUG: 'ACOUGUE', HORTI: 'HORTIFRUTI', EMP: 'EMPORIO', DROG: 'DROGARIA', CONV: 'CONVENIENCIA', POUS: 'POUSADA' };
  const RUIDO = new Set(['LTDA','ME','EPP','EIRELI','SA','COMERCIO','COM','SERVICOS','DISTRIBUICAO','DIST','ALIMENTOS','DE','DA','DO','DAS','DOS','E','SHOP','PETISCARIA']);
  function normNome(t) {
    const tk = semAcento(t).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map(x => ABREV[x] || x);
    return tk.filter(x => x.length > 1 && (!P.removeRuido || !RUIDO.has(x))).join(' ');
  }
  function bigramas(s) { const t = ' ' + s.replace(/ /g, '') + ' '; const m = new Map(); for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
  function dice(a, b) {
    if (!a || !b) return 0; if (a === b) return 1;
    const A = bigramas(a), B = bigramas(b); let inter = 0, na = 0, nb = 0;
    A.forEach((v, k) => { na += v; inter += Math.min(v, B.get(k) || 0); }); B.forEach(v => nb += v);
    return 2 * inter / (na + nb);
  }
  function jaroWinkler(a, b) {
    if (a === b) return 1; const la = a.length, lb = b.length; if (!la || !lb) return 0;
    const jan = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1); const ma = new Uint8Array(la), mb = new Uint8Array(lb); let m = 0;
    for (let i = 0; i < la; i++) for (let j = Math.max(0, i - jan); j < Math.min(lb, i + jan + 1); j++) if (!mb[j] && a[i] === b[j]) { ma[i] = mb[j] = 1; m++; break; }
    if (!m) return 0; let t = 0, k = 0;
    for (let i = 0; i < la; i++) if (ma[i]) { while (!mb[k]) k++; if (a[i] !== b[k]) t++; k++; }
    const jaro = (m / la + m / lb + (m - t / 2) / m) / 3; let l = 0; while (l < 4 && a[l] === b[l]) l++;
    return jaro + l * 0.1 * (1 - jaro);
  }
  function levRatio(a, b) {
    if (a === b) return 1; const la = a.length, lb = b.length; if (!la || !lb) return 0;
    let prev = new Array(lb + 1), cur = new Array(lb + 1); for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) { cur[0] = i; for (let j = 1; j <= lb; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [prev, cur] = [cur, prev]; }
    return 1 - prev[lb] / Math.max(la, lb);
  }
  function simNome(a, b) { // a e b já normalizados
    if (!a || !b) return 0;
    if (P.sim === 'jw') return jaroWinkler(a, b);
    if (P.sim === 'tsort') return levRatio(a.split(' ').sort().join(' '), b.split(' ').sort().join(' '));
    const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
    let i = 0; ta.forEach(x => { if (tb.has(x)) i++; });
    return Math.max(dice(a, b), i / (ta.size + tb.size - i));
  }

  // ---------- endereços ----------
  function parseEnd(t) {
    if (!t) return null;
    let s = semAcento(t).toUpperCase().trim(), cidade = '';
    const par = s.match(/\(([^)]+)\)\s*$/);
    if (par) { cidade = par[1]; s = s.slice(0, par.index); }
    else { const p = s.split(/,| - /).map(x => x.trim()).filter(Boolean); cidade = p.length > 1 ? p[p.length - 1] : ''; }
    s = s.replace(/^R\.\s*/, 'RUA ').replace(/^AV\.\s*/, 'AVENIDA ').replace(/\bN[ºO°]\s*/g, ' ');
    const m = s.match(/^([A-Z .']+?)[ ,]+(\d+)/);
    if (!m) return { chave: null, cidade: cidade.trim(), texto: t };
    const rua = m[1].replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    return { chave: rua + ', ' + m[2], cidade: cidade.replace(/\s+/g, ' ').trim(), texto: t };
  }
  // fim de frase = ponto que NÃO é de abreviação de logradouro ("R.", "Av.") — bug achado pelo teste de evidência
  const extrairEnd = t => { const m = String(t).match(/(?:endere[cç]o (?:[eé]|correto agora [eé])|[Ee]ndere[cç]o novo:|CONTRATANTE para)\s+(.+?)(?:(?<!\b(?:R|Av|AV))\.(?:\s|$)|,? mantidas|$)/m); return m ? m[1].trim() : null; };

  // ---------- leitura das fontes cruas ----------
  function lerFontes(arq) {
    const R = [], porRef = new Map();
    const add = r => { R.push(r); porRef.set(r.ref, r); return r; };
    for (const x of csv(arq.crm)) {
      const cn = so(x.cnpj), e = parseEnd(x.endereco);
      add({ ref: 'crm:' + x.id_crm, fonte: 'crm', origem: `crm.csv linha ${x._linha}`, papel: 'cadastro', nomeOrig: x.empresa, nome: normNome(x.empresa),
        cnpjBruto: x.cnpj, cnpj: cn, cnpjOk: cnpjValido(cn), email: x.email.toLowerCase(), fone: so(x.telefone).slice(-8), contato: x.contato,
        end: e, dataEnd: x.endereco_atualizado_em, cidade: e && e.cidade, data: x.endereco_atualizado_em });
    }
    for (const x of csv(arq.erp_clientes)) {
      const cn = so(x.cnpj), e = parseEnd(x.endereco_cobranca);
      add({ ref: 'erp:' + x.cod_erp, fonte: 'erp', origem: `erp_clientes.csv linha ${x._linha}`, papel: 'cadastro', nomeOrig: x.razao_social, nome: normNome(x.razao_social),
        cnpjBruto: x.cnpj, cnpj: cn, cnpjOk: cnpjValido(cn), end: e, dataEnd: x.data_cadastro, cidade: e && e.cidade, data: x.data_cadastro,
        copiaDe: /^IMP-CRM/.test(x.lote_importacao) ? 'crm' : null, lote: x.lote_importacao, cod: x.cod_erp });
    }
    const notasPorCod = new Map();
    for (const x of csv(arq.erp_notas)) {
      const r = add({ ref: 'nf:' + x.nf, fonte: 'nf', origem: `erp_notas.csv linha ${x._linha}`, papel: 'fato', cod: x.cod_erp, data: x.emissao, valor: +x.valor, situacao: x.situacao });
      if (!notasPorCod.has(x.cod_erp)) notasPorCod.set(x.cod_erp, []); notasPorCod.get(x.cod_erp).push(r);
    }
    for (const c of arq.contratos) {
      const t = c.texto, num = (t.match(/CONTRATO DE FORNECIMENTO (\S+)/) || [])[1] || c.arquivo;
      const m = t.match(/CONTRATANTE:\s*(.+?), inscrita no CNPJ ([\d./-]+), com sede em (.+?)\.\n/);
      const cn = so(m && m[2]), e = parseEnd(m && m[3]);
      const valor = +(((t.match(/R\$\s*([\d.]+,\d{2})/) || [])[1] || '0').replace(/\./g, '').replace(',', '.'));
      const assin = (t.match(/Curitiba, (\d{4}-\d{2}-\d{2})/) || [])[1] || '';
      const ct = add({ ref: 'ct:' + num, fonte: 'contrato', origem: `contratos/${c.arquivo}`, papel: 'cadastro', nomeOrig: m ? m[1] : '', nome: normNome(m ? m[1] : ''),
        cnpjBruto: m ? m[2] : '', cnpj: cn, cnpjOk: cnpjValido(cn), end: e, dataEnd: assin, cidade: e && e.cidade, data: assin, valorMensal: valor, num });
      const ad = t.match(/TERMO ADITIVO \((\d{4}-\d{2}-\d{2})\) ---\n(.+)/);
      if (ad) add({ ref: 'ct:' + num + '#ad1', fonte: 'aditivo', origem: `contratos/${c.arquivo} (aditivo)`, papel: 'fato', pai: ct.ref, data: ad[1], end: parseEnd(extrairEnd(ad[2])), dataEnd: ad[1] });
    }
    for (const x of jsonl(arq.emails)) {
      const ass = x.corpo.split('\n').map(s => s.trim()).filter(Boolean); const fone = ass.find(l => /^[+\d( ][\d() +-]{7,}$/.test(l));
      const iFone = fone ? ass.indexOf(fone) : ass.length; const empresa = ass[iFone - 1] || '';
      const ed = extrairEnd(x.corpo);
      add({ ref: 'em:' + x.id, fonte: 'email', origem: `emails.jsonl linha ${x._linha}`, papel: 'mencao', email: x.de.toLowerCase(), nomeOrig: empresa, nome: normNome(empresa),
        fone: so(fone).slice(-8), data: x.data, assunto: x.assunto, texto: x.corpo, end: ed ? parseEnd(ed) : null, dataEnd: x.data });
    }
    for (const x of jsonl(arq.chamados)) {
      const ed = extrairEnd(x.descricao); const email = /@/.test(x.solicitante) ? x.solicitante.toLowerCase() : '';
      add({ ref: 'ch:' + x.id, fonte: 'chamado', origem: `chamados.jsonl linha ${x._linha}`, papel: 'mencao', email, pessoa: email ? '' : x.solicitante, nomeOrig: x.empresa_digitada,
        nome: normNome(x.empresa_digitada), data: x.aberto_em, assunto: x.assunto, texto: x.descricao, end: ed ? parseEnd(ed) : null, dataEnd: x.aberto_em });
    }
    return { R, porRef, notasPorCod };
  }

  function identidade(e) { // o que a entidade "é", derivado só dos cadastros visíveis
    const regs = e.regs; const nomes = regs.map(r => r.nome).filter(Boolean);
    e.nomesNorm = [...new Set(nomes)];
    e.emails = new Set(regs.map(r => r.email).filter(Boolean)); e.dominios = new Set([...e.emails].map(dominio).filter(Boolean));
    e.fones = new Set(regs.map(r => r.fone).filter(Boolean));
    e.cnpjs = new Set(regs.map(r => r.cnpjOk ? r.cnpj : r.cnpjCorrigido).filter(Boolean));
    const crm = regs.find(r => r.fonte === 'crm'), ct = regs.find(r => r.fonte === 'contrato');
    e.nome = (crm && crm.nomeOrig) || (ct && ct.nomeOrig) || (regs[0] && regs[0].nomeOrig) || '';
    e.razao = ct ? ct.nomeOrig : ((regs.find(r => r.fonte === 'erp') || regs[0] || {}).nomeOrig || '');
    return e;
  }
  // ---------- permissões: cada perfil só vê as fontes que já vê no sistema de origem ----------
  const PERFIS = { comercial: ['crm', 'email', 'chamado'], financeiro: ['erp', 'nf'], juridico: ['contrato', 'aditivo'], suporte: ['chamado', 'email'], auditoria: ['crm', 'erp', 'nf', 'contrato', 'aditivo', 'email', 'chamado'] };
  const GENERICOS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'yahoo.com', 'uol.com.br', 'bol.com.br']);
  const dominio = e => { const d = (e || '').split('@')[1] || ''; return d && !GENERICOS.has(d) ? d : ''; };

  // ---------- resolução ----------
  function construir(arq, params) {
    P = Object.assign({}, PADRAO, params || {});
    const { R, porRef, notasPorCod } = lerFontes(arq);
    const cad = R.filter(r => r.papel === 'cadastro');
    const pai = new Map(), cnpjs = new Map(), motivos = [];
    cad.forEach(r => { pai.set(r.ref, r.ref); cnpjs.set(r.ref, new Set(r.cnpjOk ? [r.cnpj] : [])); });
    const ach = x => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
    const bloqueios = [];
    function unir(a, b, motivo, forca) {
      const ra = ach(a), rb = ach(b); if (ra === rb) return true;
      const A = cnpjs.get(ra), B = cnpjs.get(rb);
      if (A.size && B.size && ![...A].some(x => B.has(x))) { bloqueios.push({ a, b, motivo }); return false; } // CNPJs válidos diferentes: nunca mesma entidade
      pai.set(rb, ra); B.forEach(x => A.add(x)); motivos.push({ a, b, motivo, forca }); return true;
    }
    // 1) CNPJ válido idêntico
    const porCnpj = new Map();
    cad.forEach(r => { if (r.cnpjOk) { if (porCnpj.has(r.cnpj)) unir(porCnpj.get(r.cnpj), r.ref, 'mesmo CNPJ válido', 1); else porCnpj.set(r.cnpj, r.ref); } });
    // 2) CNPJ inválido: corrige se houver exatamente um CNPJ válido a 1 dígito de distância e o nome confirmar
    const correcoes = [];
    cad.filter(r => r.cnpj.length === 14 && !r.cnpjOk).forEach(r => {
      const cand = [...porCnpj.keys()].filter(c => { let d = 0; for (let i = 0; i < 14; i++) if (c[i] !== r.cnpj[i]) d++; return d === 1; });
      const ok = cand.filter(c => simNome(porRef.get(porCnpj.get(c)).nome, r.nome) >= P.simCorrecaoCnpj || cad.some(o => o.cnpj === c && o.fone && o.fone === r.fone));
      if (ok.length === 1) { correcoes.push({ ref: r.ref, de: r.cnpjBruto, para: ok[0] }); r.cnpjCorrigido = ok[0]; unir(porCnpj.get(ok[0]), r.ref, `CNPJ ${r.cnpjBruto} com 1 dígito errado (DV inválido); corrigido para ${ok[0]}`, 0.9); }
    });
    // 3) chaves de contato: e-mail exato, telefone, domínio corporativo (com guarda de nome)
    // mesmaCidade: com a regra de grupo ligada, e-mail e domínio (que matriz e filial dividem) só juntam cadastros da mesma cidade
    const chave = (campo, fn, guarda, motivo, forca, mesmaCidade) => {
      const m = new Map(); cad.forEach(r => { const k = fn(r); if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
      m.forEach(lista => { for (let i = 1; i < lista.length; i++) for (let j = 0; j < i; j++) if (simNome(lista[i].nome, lista[j].nome) >= guarda && (!mesmaCidade || (lista[i].cidade && lista[i].cidade === lista[j].cidade))) { unir(lista[j].ref, lista[i].ref, motivo, forca); break; } });
    };
    const regraGrupo = P.grupo !== 'atual';
    chave('email', r => r.email, 0, 'mesmo e-mail', 0.95, regraGrupo);
    chave('fone', r => r.fone && r.fone.length === 8 ? r.fone : '', P.guardaFone, 'mesmo telefone e nome parecido', 0.85);
    if (P.grupo !== 'pendente') chave('dominio', r => dominio(r.email), P.guardaDominio, 'mesmo domínio corporativo e nome parecido', 0.8, regraGrupo);
    chave('end', r => r.end && r.end.chave ? r.end.chave + '|' + r.end.cidade : '', P.guardaEnd, 'mesmo endereço e nome parecido', 0.8);
    // 4) nome muito parecido na mesma cidade (sem CNPJ conflitante)
    const porCid = new Map(); cad.forEach(r => { const c = r.cidade || '?'; if (!porCid.has(c)) porCid.set(c, []); porCid.get(c).push(r); });
    porCid.forEach(l => { for (let i = 0; i < l.length; i++) for (let j = 0; j < i; j++) if (simNome(l[i].nome, l[j].nome) >= P.quaseIdentico) unir(l[j].ref, l[i].ref, 'nome quase idêntico na mesma cidade', 0.7); });

    // monta entidades
    const grupos = new Map(); cad.forEach(r => { const g = ach(r.ref); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(r); });
    const ents = []; const entDe = new Map();
    let n = 0;
    grupos.forEach(regs => {
      const id = 'ENT-' + String(++n).padStart(4, '0');
      const e = { id, regs, mencoes: [], fatos: [] }; ents.push(e); regs.forEach(r => entDe.set(r.ref, e));
      // fatos ligados por chave dura: notas (cod ERP) e aditivos (contrato)
      regs.forEach(r => { if (r.fonte === 'erp') (notasPorCod.get(r.cod) || []).forEach(nf => { e.fatos.push(nf); entDe.set(nf.ref, e); }); });
      R.filter(x => x.fonte === 'aditivo' && regs.some(r => r.ref === x.pai)).forEach(a => { e.fatos.push(a); entDe.set(a.ref, e); });
      identidade(e);
      const cidades = regs.map(r => r.cidade).filter(Boolean); e.cidade = cidades.sort((a, b) => cidades.filter(x => x === b).length - cidades.filter(x => x === a).length)[0] || '';
    });
    // grupo econômico: mesma raiz de CNPJ, filial diferente
    const porRaiz = new Map(); ents.forEach(e => e.cnpjs.forEach(c => { const k = c.slice(0, 8); if (!porRaiz.has(k)) porRaiz.set(k, new Set()); porRaiz.get(k).add(e); }));
    ents.forEach(e => { e.grupo = new Set(); e.cnpjs.forEach(c => (porRaiz.get(c.slice(0, 8)) || []).forEach(o => { if (o !== e) e.grupo.add(o.id); })); });
    const entPorId = new Map(ents.map(e => [e.id, e]));
    // 5) menções (e-mails e chamados): liga por e-mail exato > telefone > domínio > nome; empate vira ambíguo
    const porEmail = new Map(), porFone = new Map(), porDom = new Map();
    const addEmail = (x, e) => { if (!porEmail.has(x)) porEmail.set(x, new Set()); porEmail.get(x).add(e); };
    ents.forEach(e => { e.emails.forEach(x => addEmail(x, e)); e.fones.forEach(x => porFone.set(x, e)); e.dominios.forEach(d => { if (!porDom.has(d)) porDom.set(d, []); porDom.get(d).push(e); }); });
    const pessoas = new Map(); cad.forEach(r => { if (!r.contato) return; const k = semAcento(r.contato).toUpperCase(); if (!pessoas.has(k)) pessoas.set(k, new Set()); pessoas.get(k).add(entDe.get(r.ref)); });
    const ambiguos = [];
    function melhorPorNome(nome, candidatos) {
      const sc = candidatos.map(e => ({ e, s: Math.max(0, ...e.nomesNorm.map(x => simNome(x, nome))) })).sort((a, b) => b.s - a.s);
      return sc;
    }
    // regra de grupo 'aprende': antes de ligar, olha TODAS as menções de cada e-mail do grupo. Se as que têm nome
    // decisivo apontam para unidades diferentes, o e-mail é compartilhado (ex.: comprador central) e não decide sozinho.
    const votosEmail = new Map();
    if (P.grupo === 'aprende') R.filter(r => r.papel === 'mencao' && r.email && r.nome).forEach(r => {
      const viaEmail = porEmail.has(r.email) ? [...porEmail.get(r.email)] : (dominio(r.email) && porDom.has(dominio(r.email)) ? porDom.get(dominio(r.email)) : []);
      const g = viaEmail.find(x => x.grupo.size); if (!g) return;
      const unidades = [g, ...[...g.grupo].map(id => entPorId.get(id))]; const sc = melhorPorNome(r.nome, unidades);
      if (sc[0].s - sc[1].s >= P.margem) { if (!votosEmail.has(r.email)) votosEmail.set(r.email, new Set()); votosEmail.get(r.email).add(sc[0].e.id); }
    });
    // aprende e-mails novos ao ligar: duas passadas
    for (let passada = 0; passada < 2; passada++) R.filter(r => r.papel === 'mencao' && !entDe.has(r.ref)).forEach(r => {
      let e = null, motivo = '';
      const doEmail = r.email && porEmail.has(r.email) ? [...porEmail.get(r.email)] : [];
      if (doEmail.length === 1) { e = doEmail[0]; motivo = 'e-mail do remetente já conhecido'; }
      else if (r.fone && porFone.has(r.fone)) { e = porFone.get(r.fone); motivo = 'telefone da assinatura'; }
      else if (doEmail.length > 1) { // e-mail compartilhado (ex.: comprador central de matriz e filial)
        const sc = melhorPorNome(r.nome, doEmail);
        if (sc[0].s - sc[1].s >= P.margem) { e = sc[0].e; motivo = 'e-mail compartilhado no grupo + nome'; }
        else if (passada) { ambiguos.push({ ref: r.ref, origem: r.origem, texto: r.nomeOrig, candidatos: doEmail.map(x => x.id), porque: 'e-mail usado por mais de uma empresa do grupo e nem telefone nem nome desempatam' }); return; }
        else return;
      }
      else if (r.email && dominio(r.email) && porDom.has(dominio(r.email))) {
        const c = porDom.get(dominio(r.email));
        if (c.length === 1) { e = c[0]; motivo = 'domínio corporativo do remetente'; }
        else { const sc = melhorPorNome(r.nome, c); if (sc[0].s - sc[1].s >= P.margem) { e = sc[0].e; motivo = 'domínio de grupo + nome'; } else if (passada) { ambiguos.push({ ref: r.ref, origem: r.origem, texto: r.nomeOrig, candidatos: c.map(x => x.id), porque: 'domínio compartilhado por empresas do mesmo grupo e o nome não desempata' }); return; } }
      }
      else if (r.pessoa && pessoas.has(semAcento(r.pessoa).toUpperCase())) {
        // nome de pessoa se repete entre empresas: só vale se o nome da empresa digitado confirmar
        const sc = melhorPorNome(r.nome, [...pessoas.get(semAcento(r.pessoa).toUpperCase())]);
        if (sc[0].s >= P.limiarContato && (!sc[1] || sc[0].s - sc[1].s >= P.margem)) { e = sc[0].e; motivo = 'contato conhecido no CRM + nome da empresa'; }
      }
      if (!e && r.nome && passada) {
        // nome incompleto (ex.: só "Ponto Certo") que cabe inteiro em mais de um cliente: não decide
        const tk = r.nome.split(' '); const cabem = ents.filter(x => x.nomesNorm.some(nn => { const s2 = new Set(nn.split(' ')); return tk.every(t => s2.has(t)); }));
        if (P.regraIncompleto && cabem.length > 1 && !cabem.some(x => x.nomesNorm.includes(r.nome))) { ambiguos.push({ ref: r.ref, origem: r.origem, texto: r.nomeOrig, candidatos: cabem.slice(0, 4).map(x => x.id), porque: `nome incompleto que serve para ${cabem.length} clientes` }); return; }
        const sc = melhorPorNome(r.nome, ents);
        if (sc[0].s >= P.limiarMencaoNome && sc[0].s - (sc[1] ? sc[1].s : 0) >= P.margem) { e = sc[0].e; motivo = `nome parecido (${sc[0].s.toFixed(2)})`; }
        else { ambiguos.push({ ref: r.ref, origem: r.origem, texto: r.nomeOrig, candidatos: sc.slice(0, 3).filter(x => x.s >= 0.5).map(x => x.e.id), porque: sc[0].s < P.limiarMencaoNome ? 'nome digitado não se parece o bastante com nenhum cliente' : 'dois ou mais clientes com nome igualmente parecido' }); return; }
      }
      // regra de grupo: matriz e filial dividem domínio, às vezes o e-mail e quase o nome. Fora do telefone, só liga se algo na mensagem separar as unidades.
      if (e && P.grupo !== 'atual' && e.grupo.size && motivo !== 'telefone da assinatura') {
        const unidades = [e, ...[...e.grupo].map(id => entPorId.get(id))];
        const sc = melhorPorNome(r.nome, unidades);
        const votos = r.email && votosEmail.get(r.email);
        if (P.grupo !== 'pendente' && sc[0].s - sc[1].s >= P.margem) { e = sc[0].e; motivo += ' + nome que separa a unidade do grupo'; }
        else if (P.grupo === 'aprende' && motivo === 'e-mail do remetente já conhecido' && !(votos && votos.size > 1)) { motivo += ' (e-mail nunca usado por outra unidade do grupo)'; }
        else { if (!passada) return; ambiguos.push({ ref: r.ref, origem: r.origem, texto: r.nomeOrig, candidatos: unidades.map(x => x.id), porque: 'matriz e filial do mesmo grupo: nada na mensagem separa as unidades' }); return; }
      }
      if (e) { e.mencoes.push(r); entDe.set(r.ref, e); r.motivoLigacao = motivo;
        // só aprende e-mail novo quando a ligação veio de evidência forte (nunca de nome parecido)
        if (P.aprendeEmail && r.email && !/nome parecido|contato conhecido/.test(motivo)) { addEmail(r.email, e); e.emails.add(r.email); } }
    });

    const porId = new Map(ents.map(e => [e.id, e]));
    return api({ R, porRef, ents, porId, entDe, motivos, bloqueios, correcoes, ambiguos });
  }

  // ---------- consultas (o "IDE" do agente) ----------
  const resumo = r => {
    const b = { ref: r.ref, origem: r.origem };
    if (r.fonte === 'nf') return Object.assign(b, { data: r.data, valor: r.valor, situacao: r.situacao, cod_erp: r.cod });
    if (r.nomeOrig) b.nome = r.nomeOrig;
    if (r.cnpjBruto) b.cnpj = r.cnpjBruto + (r.cnpjOk ? '' : (r.cnpjCorrigido ? ' (DV inválido, corrigido)' : ' (DV inválido)'));
    if (r.email) b.email = r.email; if (r.end && r.end.texto) b.endereco = r.end.texto; if (r.data) b.data = r.data;
    if (r.assunto) b.assunto = r.assunto; if (r.valorMensal) b.valor_mensal = r.valorMensal; if (r.copiaDe) b.copia_de = `${r.copiaDe} (lote ${r.lote})`;
    if (r.motivoLigacao) b.ligado_por = r.motivoLigacao;
    return b;
  };
  function api(I) {
    const todos = e => [...e.regs, ...e.fatos, ...e.mencoes];
    // visão de uma entidade para um perfil: registros fora da permissão somem, e a identidade é recalculada só com o que sobra
    function vista(e, perfil) {
      if (!perfil || perfil === 'auditoria') return e;
      const ok = new Set(PERFIS[perfil] || []); const f = r => ok.has(r.fonte);
      const v = { id: e.id, regs: e.regs.filter(f), fatos: e.fatos.filter(f), mencoes: e.mencoes.filter(f), grupo: e.grupo, cidade: e.cidade, perfil };
      v.ocultos = todos(e).length - v.regs.length - v.fatos.length - v.mencoes.length;
      identidade(v); if (!v.regs.length) { v.nome = v.mencoes[0] ? v.mencoes[0].nomeOrig : ''; v.razao = ''; }
      return v;
    }
    const pegar = (id, perfil) => { const e = I.porId.get(id); return e ? vista(e, perfil) : null; };
    const visivel = (v) => v && (v.regs.length + v.fatos.length + v.mencoes.length) > 0;
    function enderecos(e) {
      const decl = todos(e).filter(r => r.end && r.end.chave).map(r => ({ endereco: r.end.chave, texto: r.end.texto, cidade: r.end.cidade, data: r.dataEnd || r.data, ref: r.ref, fonte: r.fonte, copia_de: r.copiaDe || null }));
      decl.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      const indep = decl.filter(d => !d.copia_de);
      const atual = indep[0] || decl[0] || null;
      const valores = [...new Set(decl.map(d => d.endereco))];
      const contagemIngenua = new Map(); decl.forEach(d => contagemIngenua.set(d.endereco, (contagemIngenua.get(d.endereco) || 0) + 1));
      const maioria = [...contagemIngenua.entries()].sort((a, b) => b[1] - a[1])[0];
      return { atual, declaracoes: decl, valores_distintos: valores.length, maioria_ingenua: maioria ? maioria[0] : null };
    }
    function financeiro(e) {
      const nf = e.fatos.filter(r => r.fonte === 'nf').sort((a, b) => a.data.localeCompare(b.data));
      const atr = nf.filter(r => r.situacao === 'ATRASADA');
      const ct = e.regs.find(r => r.fonte === 'contrato');
      const media = nf.length ? nf.reduce((a, r) => a + r.valor, 0) / nf.length : 0;
      const desvio = ct && ct.valorMensal && media ? (media - ct.valorMensal) / ct.valorMensal : null;
      return {
        notas: nf.length, codigos_erp: [...new Set(nf.map(r => r.cod))],
        atrasadas: atr.map(r => ({ ref: r.ref, data: r.data, valor: r.valor })),
        total_atrasado: Math.round(atr.reduce((a, r) => a + r.valor, 0) * 100) / 100,
        contrato: ct ? { ref: ct.ref, valor_mensal: ct.valorMensal } : null,
        media_faturada: Math.round(media * 100) / 100,
        desvio_contrato: desvio === null ? null : Math.round(desvio * 1000) / 10,
        formula: 'desvio = (média das notas − valor do contrato) / valor do contrato; diverge se |desvio| > 4%',
      };
    }
    function divergencias(e) {
      const d = []; const en = enderecos(e), fi = financeiro(e);
      if (en.valores_distintos > 1) {
        const desatualizados = e.regs.filter(r => (r.fonte === 'crm' || r.fonte === 'erp') && r.end && en.atual && r.end.chave !== en.atual.endereco).map(r => r.ref);
        d.push({ campo: 'endereço', mais_recente: en.atual, versoes: en.declaracoes.map(x => ({ endereco: x.endereco, data: x.data, ref: x.ref, copia_de: x.copia_de })),
          maioria_ingenua: en.maioria_ingenua, maioria_erraria: en.maioria_ingenua !== (en.atual && en.atual.endereco), cadastros_desatualizados: desatualizados });
      }
      if (fi.desvio_contrato !== null && Math.abs(fi.desvio_contrato) > 4) d.push({ campo: 'valor faturado × contrato', contrato: fi.contrato, media_faturada: fi.media_faturada, desvio_pct: fi.desvio_contrato, formula: fi.formula });
      const crus = [...new Set(todos(e).filter(r => r.cnpjBruto && !r.cnpjOk).map(r => r.ref))];
      if (crus.length) d.push({ campo: 'CNPJ', registros_com_dv_invalido: crus.map(ref => ({ ref, cnpj: I.porRef.get(ref).cnpjBruto, corrigido_para: I.porRef.get(ref).cnpjCorrigido || null })) });
      // falsa confirmação: ERP concorda com o CRM só porque foi importado dele
      const copias = e.regs.filter(r => r.copiaDe === 'crm');
      if (copias.length) d.push({ campo: 'independência das fontes', nota: 'cadastro do ERP importado do CRM: concordância entre os dois não conta como confirmação independente', refs: copias.map(r => r.ref + ' ← lote ' + r.lote) });
      return d;
    }
    function lacunas(e) {
      const l = []; const fi = financeiro(e);
      if (!fi.contrato) l.push('nenhum contrato encontrado para esta entidade');
      if (!e.cnpjs.size) l.push('nenhuma fonte traz CNPJ válido');
      const en = enderecos(e);
      if (en.atual && !e.regs.some(r => (r.fonte === 'crm' || r.fonte === 'erp') && r.end && r.end.chave === en.atual.endereco)) l.push('endereço mais recente só aparece em ' + ({ email: 'e-mail', chamado: 'chamado', aditivo: 'aditivo de contrato', contrato: 'contrato' }[en.atual.fonte] || en.atual.fonte) + '; CRM e ERP ainda não foram atualizados');
      return l;
    }
    function linhaDoTempo(e) {
      return todos(e).filter(r => r.data).map(r => {
        let o = r.fonte;
        if (r.fonte === 'nf') o = `nota ${r.ref.slice(3)} R$ ${r.valor.toFixed(2)} ${r.situacao}`;
        else if (r.fonte === 'crm') o = 'CRM: endereço registrado/atualizado';
        else if (r.fonte === 'erp') o = r.copiaDe ? `ERP: cadastro importado do CRM (${r.lote})` : 'ERP: cadastro manual';
        else if (r.fonte === 'contrato') o = `contrato ${r.num} assinado (R$ ${r.valorMensal.toFixed(2)}/mês)`;
        else if (r.fonte === 'aditivo') o = 'aditivo: novo endereço';
        else o = `${r.fonte}: ${r.assunto}`;
        return { data: r.data, evento: o, ref: r.ref };
      }).sort((a, b) => a.data.localeCompare(b.data));
    }
    function dossie(id, perfil) {
      const e = pegar(id, perfil); if (!e) return null;
      if (!visivel(e)) return { id: e.id, perfil, aviso: 'nenhum registro desta entidade está nas fontes que o seu perfil pode ver', registros_ocultos: e.ocultos };
      return { id: e.id, perfil: perfil || 'auditoria', registros_ocultos: e.ocultos || 0, nome: e.nome, razao_social: e.razao, cidade: e.cidade, cnpj: [...e.cnpjs], emails: [...e.emails], grupo_economico: [...e.grupo],
        endereco: enderecos(e), financeiro: financeiro(e), chamados: e.mencoes.filter(r => r.fonte === 'chamado').map(resumo), mencoes_pendentes: possiveis(id).filter(p => !perfil || perfil === 'auditoria' || (PERFIS[perfil] || []).includes(I.porRef.get(p.ref).fonte)),
        divergencias: divergencias(e), lacunas: lacunas(e), registros: todos(e).length,
        como_foi_ligado: I.motivos.filter(m => e.regs.some(r => r.ref === m.b) && e.regs.some(r => r.ref === m.a)).map(m => ({ de: m.a, para: m.b, motivo: m.motivo })) };
    }
    function buscar(consulta, n, perfil) {
      n = n || 5; const q = String(consulta || '').trim(); if (!q) return [];
      const dig = so(q), ql = q.toLowerCase(), qn = normNome(q);
      const sc = I.ents.map(e0 => vista(e0, perfil)).filter(visivel).map(e => {
        let s = 0, motivo = '';
        if (dig.length >= 8 && [...e.cnpjs].some(c => c.startsWith(dig) || c === dig)) { s = 1; motivo = 'CNPJ'; }
        else if (dig.length === 14 && [...e.cnpjs].some(c => { let d = 0; for (let i = 0; i < 14; i++) if (c[i] !== dig[i]) d++; return d === 1; })) { s = 0.9; motivo = 'CNPJ com 1 dígito diferente'; }
        else if (ql.includes('@') && e.emails.has(ql)) { s = 1; motivo = 'e-mail'; }
        else if (dig.length >= 8 && e.fones.has(dig.slice(-8))) { s = 0.95; motivo = 'telefone'; }
        else { const m = Math.max(0, ...e.nomesNorm.map(x => simNome(x, qn)), ...todos(e).filter(r => r.papel === 'mencao' && r.nome).map(r => simNome(r.nome, qn) * 0.95)); s = m; motivo = 'nome'; }
        return { id: e.id, nome: e.nome, cidade: e.cidade, score: Math.round(s * 100) / 100, motivo };
      }).filter(x => x.score >= P.scoreMinBusca).sort((a, b) => b.score - a.score).slice(0, n);
      if (sc.length > 1 && sc[0].score - sc[1].score < P.margemBusca) sc.forEach(x => x.empate = true);
      // nome incompleto que cabe inteiro em mais de um cliente (ex.: "Ponto Certo"): sinaliza em vez de chutar
      if (P.regraIncompleto && qn && !dig) { const tk = qn.split(' '); const cabem = I.ents.map(e0 => vista(e0, perfil)).filter(visivel).filter(e => e.nomesNorm.some(nn => { const s2 = new Set(nn.split(' ')); return tk.every(t => s2.has(t)); }));
        if (cabem.length > 1 && !cabem.some(e => e.nomesNorm.includes(qn))) { const ids = new Set(cabem.map(e => e.id)); sc.forEach(x => { if (ids.has(x.id)) x.empate = true; }); if (sc[0] && !sc[0].empate) {} else if (sc[0]) sc[0].aviso = `nome incompleto: serve para ${cabem.length} clientes; pergunte qual`; } }
      return sc;
    }
    // menções que a camada não ligou sozinha mas em que esta entidade é candidata: vão junto, marcadas
    const possiveis = (id, fonte) => I.ambiguos.filter(a => a.candidatos.includes(id) && (!fonte || I.porRef.get(a.ref).fonte === fonte)).map(a => Object.assign(resumo(I.porRef.get(a.ref)), { pendente: a.porque, outros_candidatos: a.candidatos.filter(x => x !== id) }));
    function referencias(id, fonte, perfil) { const e = pegar(id, perfil); if (!e) return null; const ok = perfil && perfil !== 'auditoria' ? new Set(PERFIS[perfil] || []) : null; return todos(e).filter(r => !fonte || r.fonte === fonte).map(resumo).concat(possiveis(id, fonte).filter(p => !ok || ok.has(I.porRef.get(p.ref).fonte))); }
    function estatisticas() {
      const fontes = {}; I.R.forEach(r => fontes[r.fonte] = (fontes[r.fonte] || 0) + 1);
      const falsaConf = I.ents.filter(e => e.regs.some(r => r.copiaDe === 'crm')).length;
      let maioriaErra = 0; I.ents.forEach(e => { const en = enderecos(e); if (en.atual && en.maioria_ingenua && en.maioria_ingenua !== en.atual.endereco) maioriaErra++; });
      return { registros: I.R.length, fontes, entidades: I.ents.length, ambiguos: I.ambiguos.length, correcoes_cnpj: I.correcoes.length, bloqueios_cnpj: I.bloqueios.length,
        entidades_com_copia_crm_erp: falsaConf, maioria_ingenua_erraria_endereco: maioriaErra,
        mencoes_ligadas: I.R.filter(r => r.papel === 'mencao' && I.entDe.has(r.ref)).length, mencoes: I.R.filter(r => r.papel === 'mencao').length };
    }
    return { buscar, dossie, referencias, divergencias: (id, perfil) => { const e = pegar(id, perfil); return e ? (visivel(e) ? divergencias(e) : []) : null; },
      linhaDoTempo: (id, perfil) => { const e = pegar(id, perfil); return e ? (visivel(e) ? linhaDoTempo(e) : []) : null; },
      lacunas: (id, perfil) => { const e = pegar(id, perfil); return e ? lacunas(e) : null; }, vista: pegar, perfis: () => Object.keys(PERFIS),
      entidadeDe: ref => { const e = I.entDe.get(ref); return e ? e.id : null; },
      ambiguos: () => I.ambiguos, estatisticas, interno: I };
  }

  const Nucleo = { construir, cnpjValido, normNome, simNome, parseEnd, csv, PADRAO, PERFIS, parametros: () => Object.assign({}, P), versao: '1.2' };
  if (typeof module !== 'undefined' && module.exports) module.exports = Nucleo; else raiz.Nucleo = Nucleo;
})(typeof globalThis !== 'undefined' ? globalThis : this);
