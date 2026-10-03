// teste_permissoes.js — ataque sistemático à camada de permissões, conforme calibracao/preregistro_permissoes.md
const N = require('./nucleo'); const { gerar } = require('./gerar_dados'); const fs = require('fs');
const PERF = Object.keys(N.PERFIS).filter(p => p !== 'auditoria'); const sementes = [20261002, 9001, 9002, 9003];
const fonteDe = ref => ({ crm: 'crm', erp: 'erp', nf: 'nf', em: 'email', ch: 'chamado' }[ref.split(':')[0]] || (ref.includes('#') ? 'aditivo' : 'contrato'));
// CNPJ e telefone comparados na forma normalizada (dígitos): o mesmo CNPJ visível no CRM não é vazamento quando aparece sem pontuação
const tokens = r => [r.ref, r.origem, r.cnpjBruto, r.cnpj, r.cnpjCorrigido, r.email, r.fone, r.end && r.end.texto, r.assunto, r.nomeOrig].filter(x => x && String(x).length >= 6).map(String);
const rel = { violacoes: [], checagens: 0, tokens_testados: 0, entidades: 0, por_criterio: { A: 0, B: 0, C: 0 } };
for (const sd of sementes) {
  const { arq } = gerar(sd); const I = N.construir(arq); const R = I.interno.R;
  for (const perfil of PERF) {
    const ok = new Set(N.PERFIS[perfil]);
    const permitidos = new Set(R.filter(r => ok.has(r.fonte)).flatMap(tokens)); const permitidosTexto = [...permitidos].join('\n');
    for (const e of I.interno.ents) {
      rel.entidades++;
      const regsE = [...e.regs, ...e.fatos, ...e.mencoes]; const proibidos = regsE.filter(r => !ok.has(r.fonte));
      // exclusivo = não aparece, nem como pedaço, em nenhum registro permitido ("Bar Litoral" dentro de "Bar Litoral Ltda" do contrato não é vazamento)
      const exclusivos = [...new Set(proibidos.flatMap(tokens))].filter(t => !permitidos.has(t) && !permitidosTexto.includes(t));
      const saidas = { dossie: I.dossie(e.id, perfil), referencias: I.referencias(e.id, null, perfil), divergencias: I.divergencias(e.id, perfil), linha: I.linhaDoTempo(e.id, perfil),
        busca: [e.nome, e.razao, ...e.cnpjs, ...e.emails, ...e.fones].filter(Boolean).map(q => I.buscar(q, 5, perfil)) };
      const texto = JSON.stringify(saidas); rel.checagens++;
      for (const t of exclusivos) { rel.tokens_testados++; if (texto.includes(JSON.stringify(t).slice(1, -1))) { rel.por_criterio.A++; rel.violacoes.push({ sd, perfil, id: e.id, criterio: 'A', token: t }); } }
      const d = saidas.dossie; if (d && d.registros_ocultos !== proibidos.length) { rel.por_criterio.B++; rel.violacoes.push({ sd, perfil, id: e.id, criterio: 'B', esperado: proibidos.length, obtido: d.registros_ocultos }); }
      const visiveis = regsE.length - proibidos.length;
      for (const lista of saidas.busca) for (const c of lista) { const v = I.vista(c.id, perfil); if (!v || (v.regs.length + v.fatos.length + v.mencoes.length) === 0) { rel.por_criterio.C++; rel.violacoes.push({ sd, perfil, id: c.id, criterio: 'C', porque: 'entidade sem registro visível devolvida pela busca' }); } }
      for (const r of proibidos) for (const [q, mot] of [[r.cnpj && r.cnpjOk ? r.cnpj : '', 'CNPJ'], [r.email, 'e-mail'], [r.fone, 'telefone']]) { if (!q || permitidos.has(q) || (mot === 'CNPJ' && [...e.regs].some(x => ok.has(x.fonte) && (x.cnpj === q || x.cnpjCorrigido === q)))) continue;
        const hit = I.buscar(q, 3, perfil).find(c => c.id === e.id && c.score === 1 && c.motivo === mot); if (hit) { rel.por_criterio.C++; rel.violacoes.push({ sd, perfil, id: e.id, criterio: 'C', identificador: mot }); } }
      if (!visiveis && d && !d.aviso) { rel.por_criterio.C++; rel.violacoes.push({ sd, perfil, id: e.id, criterio: 'C', porque: 'dossiê sem aviso para entidade invisível' }); }
    }
  }
}
rel.resumo = `${rel.checagens} checagens (${sementes.length} bases × ${PERF.length} perfis × entidades), ${rel.tokens_testados} tokens exclusivos de fontes proibidas procurados nas saídas, ${rel.violacoes.length} violações`;
fs.mkdirSync('resultados', { recursive: true }); fs.writeFileSync('resultados/permissoes.json', JSON.stringify(rel, null, 1));
console.log(rel.resumo, JSON.stringify(rel.por_criterio)); if (rel.violacoes.length) { console.log(JSON.stringify(rel.violacoes.slice(0, 8))); process.exit(1); }
