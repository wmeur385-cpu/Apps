// gerar_dados.js — empresa fictícia "Distribuidora Andorinha" com 6 fontes bagunçadas.
// Determinístico (semente fixa). O gabarito vai para ./gabarito/ e o núcleo NUNCA o lê.
'use strict';
const fs = require('fs'), path = require('path');
// RUIDO: multiplicadores das taxas de bagunça (fatores de ruído do experimento). Padrão = 1 em tudo,
// e com o padrão a base gerada é byte a byte igual à versão original.
const RUIDO_PADRAO = { typo: 1, dup: 1, generico: 1, grupos: 1, homonimos: 1 };
function gerar(SEMENTE, RUIDO) {
const R = Object.assign({}, RUIDO_PADRAO, RUIDO || {});
let s = SEMENTE >>> 0;
const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, w) => String(n).padStart(w, '0');

// ---------- CNPJ ----------
function dv(d, pesos) { const sm = d.reduce((a, x, i) => a + x * pesos[i], 0) % 11; return sm < 2 ? 0 : 11 - sm; }
function cnpjCom(raiz8, filial4) {
  const d = (raiz8 + filial4).split('').map(Number);
  d.push(dv(d, [5,4,3,2,9,8,7,6,5,4,3,2])); d.push(dv(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]));
  return d.join('');
}
function cnpjValido(c) { if (!/^\d{14}$/.test(c)) return false; return cnpjCom(c.slice(0, 8), c.slice(8, 12)) === c; }
const fmtCnpj = c => `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
function cnpjComErro(c) { for (;;) { const i = int(0, 11); const x = c.split(''); x[i] = String((+x[i] + int(1, 9)) % 10); const r = x.join(''); if (!cnpjValido(r)) return r; } }
const raizes = new Set();
function novaRaiz() { for (;;) { const r = pad(int(10000000, 99999999), 8); if (!raizes.has(r)) { raizes.add(r); return r; } } }

// ---------- vocabulário ----------
const TIPOS = [['Mercado','MERC'],['Supermercado','SUPERM'],['Padaria','PAD'],['Farmácia','FARM'],['Restaurante','REST'],['Lanchonete','LANCH'],['Açougue','ACOUG'],['Hortifruti','HORTI'],['Empório','EMP'],['Drogaria','DROG'],['Pet Shop','PET'],['Conveniência','CONV'],['Pousada','POUS'],['Bar e Petiscaria','BAR']];
const NOMES = ['Bom Preço','São José','Santa Rita','Estrela','Bela Vista','Primavera','Nova Era','Dois Irmãos','Central','Vitória','Aurora','Ponto Certo','Sabor da Terra','Pão Quente','Bom Gosto','Real','Imperial','Iguaçu','Araucária','Pinheiral','Boa Esperança','Recanto','Família','Girassol','Serra Verde','Vale do Sol','Três Marias','Bom Jesus','Paraíso','Litoral','Campo Largo','Rio Branco','Santa Clara','Ouro Verde','Monte Alegre','Jardim','Novo Horizonte','Cruzeiro','Água Verde','Portão','Batel','Mercês','Cristo Rei','São Braz','Tarumã','Bacacheri','Ahú','Boqueirão','Pilarzinho','Juvevê'];
const CIDADES = ['Curitiba','Curitiba','Curitiba','São José dos Pinhais','Colombo','Pinhais','Araucária','Ponta Grossa','Londrina','Maringá','Cascavel','Joinville'];
const RUAS = ['Rua XV de Novembro','Avenida Brasil','Rua das Flores','Rua Marechal Deodoro','Avenida Sete de Setembro','Rua Padre Anchieta','Rua João Negrão','Avenida República Argentina','Rua Visconde de Guarapuava','Rua Mateus Leme','Avenida Paraná','Rua Brigadeiro Franco','Rua Emiliano Perneta','Avenida Getúlio Vargas','Rua Desembargador Westphalen','Rua Itupava','Avenida Iguaçu','Rua Chile','Rua Engenheiros Rebouças','Avenida Comendador Franco'];
const BAIRROS = ['Centro','Batel','Água Verde','Portão','Rebouças','Cristo Rei','Bacacheri','Boqueirão','Mercês','Juvevê'];
const PESSOAS = ['Ana','Bruno','Carla','Diego','Elisa','Fábio','Gabriela','Henrique','Isabela','João','Karina','Lucas','Mariana','Nelson','Olívia','Paulo','Renata','Sérgio','Tatiane','Vinícius','Wagner','Yara'];
const SOBRENOMES = ['Silva','Souza','Oliveira','Pereira','Costa','Rodrigues','Almeida','Nascimento','Lima','Araújo','Fernandes','Carvalho','Gomes','Martins','Rocha','Ribeiro','Kowalski','Nowak','Zanetti','Bortolini'];
const GENERICOS = ['gmail.com','hotmail.com','outlook.com','yahoo.com.br'];

const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = t => semAcento(t).toLowerCase().replace(/[^a-z0-9]+/g, '');
function data(ano, m1, m2) { return `${ano}-${pad(int(m1, m2), 2)}-${pad(int(1, 28), 2)}`; }
function endereco(cidade) { return { rua: pick(RUAS), num: int(10, 3999), bairro: pick(BAIRROS), cidade }; }
function fmtEnd(e, estilo) {
  const r = e.rua;
  switch (estilo) {
    case 0: return `${r}, ${e.num} - ${e.bairro}, ${e.cidade}`;
    case 1: return `${r.replace(/^Rua /, 'R. ').replace(/^Avenida /, 'Av. ')} ${e.num}, ${e.cidade}`;
    case 2: return semAcento(`${r}, ${e.num} - ${e.bairro} - ${e.cidade}`).toUpperCase();
    default: return `${r} nº ${e.num}, ${e.bairro} (${e.cidade})`;
  }
}
function fone() { return `(41) ${int(3000, 3999)}-${pad(int(0, 9999), 4)}`; }
function fmtFone(f) { const d = f.replace(/\D/g, ''); return pick([f, d, `41 ${d.slice(2, 6)} ${d.slice(6)}`, `+55 ${d.slice(0, 2)} ${d.slice(2)}`]); }
function typo(t) {
  if (t.length < 5) return t; const i = int(1, t.length - 2); const op = int(0, 2);
  if (op === 0) return t.slice(0, i) + t.slice(i + 1);
  if (op === 1) return t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2);
  return t.slice(0, i) + t[i] + t.slice(i);
}

// ---------- entidades verdadeiras ----------
const E = []; let eid = 0;
const usados = new Set();
function comboLivre() { for (;;) { const t = pick(TIPOS), n = pick(NOMES); const k = t[0] + '|' + n; if (!usados.has(k)) { usados.add(k); return [t, n]; } } }
function novaEntidade(o) {
  if (!o.tipo) { const [t, n] = comboLivre(); o.tipo = t; o.nome = n; }
  const tipo = o.tipo; const nome = o.nome; const cidade = o.cidade || pick(CIDADES);
  const fantasia = `${tipo[0]} ${nome}`;
  const sufixo = pick(['Ltda','Ltda','ME','EIRELI','Ltda EPP','S/A']);
  const razao = o.razao || `${fantasia} ${pick(['Comércio de Alimentos','Comércio','Serviços','Distribuição',''])} ${sufixo}`.replace(/\s+/g, ' ').trim();
  const corporativo = o.dominio !== undefined ? !!o.dominio : chance(Math.max(0, 1 - 0.3 * R.generico));
  const dominio = o.dominio !== undefined ? o.dominio : (corporativo ? slug(nome + tipo[1]) + pick(['.com.br','.com.br','.net']) : null);
  const contatos = []; const nc = int(1, 3);
  for (let i = 0; i < nc; i++) {
    const p = pick(PESSOAS), sn = pick(SOBRENOMES);
    const em = dominio ? `${slug(p)}${chance(0.5) ? '.' + slug(sn) : ''}@${dominio}` : `${slug(p)}${slug(sn)}${int(1, 99)}@${pick(GENERICOS)}`;
    contatos.push({ nome: `${p} ${sn}`, email: em });
  }
  const antigo = o.endereco || endereco(cidade);
  const muda = o.muda !== undefined ? o.muda : chance(0.3);
  const atual = muda ? endereco(cidade) : antigo;
  const ent = {
    id: 'E' + pad(++eid, 4), tipo: tipo[0], abrev: tipo[1], nome, fantasia, razao, cidade,
    cnpj: o.cnpj || cnpjCom(novaRaiz(), '0001'), dominio, contatos, telefone: fone(),
    end_antigo: antigo, end_atual: atual, muda, data_mudanca: muda ? data(2026, 2, 8) : null,
    tem_contrato: chance(0.88), valor_mensal: Math.round(int(800, 9000) / 10) * 10,
    diverge_valor: false, grupo: o.grupo || null, registros: [],
  };
  ent.diverge_valor = ent.tem_contrato && chance(0.15);
  E.push(ent); return ent;
}
for (let i = 0; i < 200; i++) novaEntidade({});
// homônimos: mesmo nome fantasia, cidades diferentes, CNPJ diferente
for (let i = 0; i < Math.round(12 * R.homonimos); i++) {
  const [t, n] = comboLivre(); const c1 = pick(CIDADES); let c2 = pick(CIDADES); while (c2 === c1) c2 = pick(CIDADES);
  // domínio é único no mundo real: o homônimo de outra cidade não pode ter o mesmo
  novaEntidade({ tipo: t, nome: n, cidade: c1 }); novaEntidade({ tipo: t, nome: n, cidade: c2, dominio: chance(0.5) ? slug(n + t[1] + c2) + '.com.br' : null });
}
// grupos matriz/filial: mesma raiz de CNPJ e mesmo domínio, entidades distintas
for (let g = 0; g < Math.round(6 * R.grupos); g++) {
  const [t, n] = comboLivre(), raiz = novaRaiz(), dom = slug(n + t[1]) + '.com.br';
  const razao = `${t[0]} ${n} Comércio Ltda`;
  const m = novaEntidade({ tipo: t, nome: n, cnpj: cnpjCom(raiz, '0001'), dominio: dom, razao, grupo: 'G' + g, cidade: 'Curitiba' });
  const c2 = pick(CIDADES.filter(c => c !== 'Curitiba'));
  const f = novaEntidade({ tipo: t, nome: n, cnpj: cnpjCom(raiz, '0002'), dominio: dom, razao, grupo: 'G' + g, cidade: c2 });
  f.fantasia = `${t[0]} ${n} ${c2}`;
}

// ---------- fontes ----------
const crm = [], erpCli = [], notas = [], chamados = [], emails = [], contratos = [];
let nCrm = 0, nErp = 10000, nNf = 0, nCh = 4000, nEm = 0, nCt = 0;
const variante = ent => {
  let op = int(0, 6);
  // multiplicador de typo: só consome aleatoriedade extra fora do padrão (o padrão continua idêntico)
  if (R.typo > 1 && op !== 2 && rnd() < (Math.min(1, R.typo / 7) - 1 / 7) / (6 / 7)) op = 2;
  else if (R.typo < 1 && op === 2 && rnd() < 1 - R.typo) { op = int(0, 5); if (op >= 2) op++; }
  if (op === 0) return ent.fantasia;
  if (op === 1) return ent.fantasia.toLowerCase();
  if (op === 2) return typo(ent.fantasia);
  if (op === 3) return ent.nome;
  if (op === 4) return semAcento(ent.fantasia).toUpperCase();
  if (op === 5) return `${ent.abrev} ${ent.nome}`;
  return ent.razao;
};
function regCrm(ent, dup) {
  const id = 'C' + pad(++nCrm, 4);
  const usaFantasia = dup ? true : chance(0.6);
  let nome = usaFantasia ? ent.fantasia : ent.razao; if (dup) nome = variante(ent);
  let cnpj = ''; const r = rnd();
  if (dup) cnpj = chance(0.5) ? '' : fmtCnpj(ent.cnpj);
  else if (r < 0.55) cnpj = fmtCnpj(ent.cnpj); else if (r < 0.80) cnpj = ent.cnpj; else if (r < 0.95) cnpj = ''; else cnpj = fmtCnpj(cnpjComErro(ent.cnpj));
  const atualizado = ent.muda && !dup && chance(0.4);
  const end = atualizado ? ent.end_atual : ent.end_antigo;
  const quando = atualizado ? data(2026, +ent.data_mudanca.slice(5, 7), 9) : data(2024, 1, 6);
  const c = dup ? ent.contatos[ent.contatos.length - 1] : ent.contatos[0];
  crm.push({ id_crm: id, empresa: nome, cnpj, email: c.email, telefone: fmtFone(ent.telefone), contato: c.nome, endereco: fmtEnd(end, int(0, 3)), endereco_atualizado_em: quando, vendedor: pick(['Marcos','Patrícia','Rafaela','Tiago']) });
  ent.registros.push('crm:' + id);
  if (atualizado) ent.ev_end_atual = (ent.ev_end_atual || []).concat({ ref: 'crm:' + id, data: quando });
  // o ERP importa o cadastro de onboarding (2024), antes de qualquer atualização posterior do CRM
  return { id, end: ent.end_antigo, quando: data(2024, 1, 9), nome, cnpj };
}
function regErp(ent, origemCrm) {
  const cod = String(++nErp);
  const importado = !!origemCrm;
  const lote = importado ? `IMP-CRM-${origemCrm.quando.slice(0, 7)}` : '';
  const quando = importado ? origemCrm.quando : data(2024, 1, 8);
  const end = importado ? origemCrm.end : ent.end_antigo;
  const razao = semAcento(ent.razao).toUpperCase().replace(new RegExp('^' + semAcento(ent.tipo).toUpperCase()), ent.abrev).replace('COMERCIO', 'COM').replace('DISTRIBUICAO', 'DIST');
  const cnpj = importado && origemCrm.cnpj === '' ? '' : ent.cnpj;
  erpCli.push({ cod_erp: cod, razao_social: razao, cnpj, endereco_cobranca: fmtEnd(end, 2), data_cadastro: quando, lote_importacao: lote });
  ent.registros.push('erp:' + cod); return cod;
}
for (const ent of E) {
  const c1 = regCrm(ent, false);
  if (chance(0.10 * R.dup)) regCrm(ent, true);
  const cods = [regErp(ent, chance(0.65) ? c1 : null)];
  if (chance(0.06 * R.dup)) cods.push(regErp(ent, null));
  ent.cods = cods;
  // contrato (+ aditivo de endereço para quem mudou)
  if (ent.tem_contrato) {
    const num = 'CT-' + pad(++nCt, 4); const assin = data(2024, 2, 10);
    let txt = `CONTRATO DE FORNECIMENTO ${num}\n\nCONTRATANTE: ${ent.razao}, inscrita no CNPJ ${fmtCnpj(ent.cnpj)}, com sede em ${fmtEnd(ent.end_antigo, 0)}.\nCONTRATADA: Distribuidora Andorinha Ltda.\n\nCLÁUSULA 3 - VALOR. O valor mensal estimado do fornecimento é de R$ ${ent.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\nCLÁUSULA 7 - VIGÊNCIA. 24 meses a partir da assinatura.\n\nCuritiba, ${assin}.\n`;
    const refs = ['ct:' + num];
    if (ent.muda && chance(0.6)) {
      txt += `\n--- PRIMEIRO TERMO ADITIVO (${ent.data_mudanca}) ---\nAs partes alteram o endereço da CONTRATANTE para ${fmtEnd(ent.end_atual, 0)}, mantidas as demais cláusulas.\n`;
      ent.ev_end_atual = (ent.ev_end_atual || []).concat({ ref: 'ct:' + num + '#ad1', data: ent.data_mudanca });
      refs.push('ct:' + num + '#ad1');
    }
    contratos.push({ arquivo: num + '.txt', texto: txt }); ent.contrato = num; ent.registros.push(...refs);
  }
  // notas fiscais: 12 meses, divididas entre os códigos ERP
  const valorNota = ent.diverge_valor ? Math.round(ent.valor_mensal * pick([1.08, 1.12, 0.9]) * 100) / 100 : ent.valor_mensal;
  const atrasa = chance(0.25) ? int(1, 3) : 0; ent.notas = []; ent.notas_atrasadas = [];
  for (let m = 0; m < 12; m++) {
    const ano = m < 3 ? 2025 : 2026, mes = m < 3 ? 10 + m : m - 2;
    const nf = pad(++nNf, 6); const cod = cods[m % cods.length];
    const v = Math.round(valorNota * (0.97 + rnd() * 0.06) * 100) / 100;
    const sit = m >= 12 - atrasa ? 'ATRASADA' : (m === 11 ? 'EM ABERTO' : 'PAGA');
    notas.push({ nf, cod_erp: cod, emissao: `${ano}-${pad(mes, 2)}-05`, vencimento: `${ano}-${pad(mes, 2)}-20`, valor: v.toFixed(2), situacao: sit });
    ent.registros.push('nf:' + nf); ent.notas.push('nf:' + nf); if (sit === 'ATRASADA') ent.notas_atrasadas.push({ ref: 'nf:' + nf, valor: v });
  }
  // e-mails
  ent.emails = [];
  const ne = int(0, 3) + (ent.muda ? 1 : 0);
  for (let i = 0; i < ne; i++) {
    const c = pick(ent.contatos), id = 'M' + pad(++nEm, 4);
    let assunto, corpo, dt;
    if (ent.muda && i === 0 && chance(0.5)) {
      dt = data(2026, +ent.data_mudanca.slice(5, 7), 9); assunto = 'Mudança de endereço';
      corpo = `Bom dia, informamos que a partir de agora nosso endereço é ${fmtEnd(ent.end_atual, int(0, 3))}. Favor atualizar o cadastro para as próximas entregas.`;
      ent.ev_end_atual = (ent.ev_end_atual || []).concat({ ref: 'em:' + id, data: dt });
    } else {
      dt = data(pick([2025, 2026]), 1, 9); const nfRef = pick(ent.notas).slice(3);
      [assunto, corpo] = pick([[`Segunda via NF ${nfRef}`, `Olá, podem reenviar a nota ${nfRef}? Não chegou no financeiro.`], ['Pedido semanal', 'Segue o pedido desta semana, mesmo volume da anterior.'], ['Prazo de entrega', 'A entrega de ontem atrasou, conseguem confirmar o horário de amanhã?']]);
    }
    emails.push({ id, de: c.email, data: dt, assunto, corpo: `${corpo}\n\n${c.nome}\n${variante(ent)}\n${fmtFone(ent.telefone)}` });
    ent.registros.push('em:' + id); ent.emails.push('em:' + id);
  }
  // chamados
  ent.chamados = [];
  const nch = int(0, 4);
  for (let i = 0; i < nch; i++) {
    const id = String(++nCh), c = pick(ent.contatos);
    const sol = chance(0.6) ? c.email : c.nome;
    let assunto = pick(['Produto avariado na entrega', 'Cobrança em duplicidade', 'Atraso na entrega', 'Troca de mercadoria', 'Dúvida sobre boleto']);
    let desc = `Cliente relata: ${assunto.toLowerCase()}.`; let dt = data(pick([2025, 2026]), 1, 9);
    if (ent.muda && i === 0 && chance(0.3)) {
      assunto = 'Entrega no endereço antigo'; dt = data(2026, +ent.data_mudanca.slice(5, 7), 9);
      desc = `Entregaram no endereço antigo. O endereço correto agora é ${fmtEnd(ent.end_atual, int(0, 3))}.`;
      ent.ev_end_atual = (ent.ev_end_atual || []).concat({ ref: 'ch:' + id, data: dt });
    }
    chamados.push({ id, aberto_em: dt, canal: pick(['telefone', 'whatsapp', 'portal']), solicitante: sol, empresa_digitada: variante(ent), assunto, descricao: desc });
    ent.registros.push('ch:' + id); ent.chamados.push('ch:' + id);
  }
  // garante que toda mudança tenha ao menos uma evidência do endereço novo
  if (ent.muda && !(ent.ev_end_atual && ent.ev_end_atual.length)) {
    const id = 'M' + pad(++nEm, 4), c = ent.contatos[0], dt = data(2026, +ent.data_mudanca.slice(5, 7), 9);
    emails.push({ id, de: c.email, data: dt, assunto: 'Novo endereço', corpo: `Mudamos! Endereço novo: ${fmtEnd(ent.end_atual, int(0, 3))}.\n\n${c.nome}\n${variante(ent)}` });
    ent.registros.push('em:' + id); ent.emails.push('em:' + id); ent.ev_end_atual = [{ ref: 'em:' + id, data: dt }];
  }
}
// embaralha a ordem das linhas (fontes reais não vêm ordenadas por cliente)
const embaralha = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
[crm, erpCli, chamados, emails].forEach(embaralha);

// ---------- saída em memória ----------
const csv = rows => { const k = Object.keys(rows[0]); const q = v => /[",;\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v); return [k.join(';'), ...rows.map(r => k.map(x => q(r[x])).join(';'))].join('\n') + '\n'; };
const arq = { crm: csv(crm), erp_clientes: csv(erpCli), erp_notas: csv(notas), chamados: chamados.map(x => JSON.stringify(x)).join('\n') + '\n', emails: emails.map(x => JSON.stringify(x)).join('\n') + '\n',
  contratos: contratos.slice().sort((a, b) => a.arquivo < b.arquivo ? -1 : 1) };
const fmtE = e => `${e.rua}, ${e.num}`;
const gab = { semente: SEMENTE, entidades: E.map(e => ({
  id: e.id, fantasia: e.fantasia, razao: e.razao, cidade: e.cidade, cnpj: e.cnpj, grupo: e.grupo, registros: e.registros,
  endereco_atual: fmtE(e.end_atual), muda: e.muda, ev_end_atual: e.ev_end_atual || [], contrato: e.contrato || null,
  valor_mensal: e.valor_mensal, diverge_valor: e.diverge_valor, notas_atrasadas: e.notas_atrasadas, chamados: e.chamados,
  variantes_pergunta: [variante(e), variante(e), variante(e)],
})) };
return { arq, gab, resumo: `entidades=${E.length} crm=${crm.length} erp=${erpCli.length} notas=${notas.length} chamados=${chamados.length} emails=${emails.length} contratos=${contratos.length}` };
} // fim de gerar()

// ---------- linha de comando: grava em ./dados e ./gabarito ----------
if (require.main === module) {
  const SEMENTE = +(process.argv[2] || 20261002); const RUIDO = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  const { arq, gab: G, resumo } = gerar(SEMENTE, RUIDO);
  const out = path.join(__dirname, 'dados'), gdir = path.join(__dirname, 'gabarito');
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'contratos'), { recursive: true }); fs.mkdirSync(gdir, { recursive: true });
  for (const [f, k] of [['crm.csv', 'crm'], ['erp_clientes.csv', 'erp_clientes'], ['erp_notas.csv', 'erp_notas'], ['chamados.jsonl', 'chamados'], ['emails.jsonl', 'emails']]) fs.writeFileSync(path.join(out, f), arq[k]);
  for (const c of arq.contratos) fs.writeFileSync(path.join(out, 'contratos', c.arquivo), c.texto);
  fs.writeFileSync(path.join(gdir, 'gabarito.json'), JSON.stringify(G, null, 1));
  console.log(resumo);
}
module.exports = { gerar, RUIDO_PADRAO };
