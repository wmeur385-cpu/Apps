/* avaliacao.js — confere a resolução contra o gabarito. Universal (Node e navegador).
   O núcleo constrói tudo sem o gabarito; este arquivo só entra depois, para medir. */
(function (raiz) {
  function avaliar(I, gab) {
    const verdade = new Map(); gab.entidades.forEach(e => e.registros.forEach(r => verdade.set(r, e.id)));
    const refs = [...verdade.keys()], pred = new Map(refs.map(r => [r, I.entidadeDe(r)]));
    const porPred = new Map(), porVerd = new Map();
    refs.forEach(r => { const p = pred.get(r); if (p) { if (!porPred.has(p)) porPred.set(p, []); porPred.get(p).push(r); } const v = verdade.get(r); if (!porVerd.has(v)) porVerd.set(v, []); porVerd.get(v).push(r); });
    const pares = n => n * (n - 1) / 2; let vp = 0, pp = 0, pv = 0;
    porPred.forEach(l => { pp += pares(l.length); const c = new Map(); l.forEach(r => c.set(verdade.get(r), (c.get(verdade.get(r)) || 0) + 1)); c.forEach(k => vp += pares(k)); });
    porVerd.forEach(l => pv += pares(l.length));
    const prec = vp / pp, rev = vp / pv;
    // verdade majoritária de cada entidade prevista (pelos registros de cadastro)
    const donoPrev = new Map();
    porPred.forEach((l, p) => { const cad = l.filter(r => /^(crm|erp|ct):/.test(r)); const base = cad.length ? cad : l; const c = new Map(); base.forEach(r => c.set(verdade.get(r), (c.get(verdade.get(r)) || 0) + 1)); donoPrev.set(p, [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]); });
    const erros = [];
    const men = refs.filter(r => /^(em|ch):/.test(r)); let certas = 0, erradas = 0, soltas = 0;
    men.forEach(r => { const p = pred.get(r); if (!p) { soltas++; return; } if (donoPrev.get(p) === verdade.get(r)) certas++; else { erradas++; const x = I.interno.porRef.get(r); erros.push({ tipo: 'menção ligada à entidade errada', ref: r, texto: x.nomeOrig, ligado_por: x.motivoLigacao, foi_para: p, era: verdade.get(r) }); } });
    const cadErr = refs.filter(r => /^(crm|erp|ct):/.test(r) && !r.includes('#') && donoPrev.get(pred.get(r)) !== verdade.get(r));
    cadErr.forEach(r => { const x = I.interno.porRef.get(r); erros.push({ tipo: 'cadastro separado da entidade certa', ref: r, texto: x.nomeOrig, cnpj: x.cnpjBruto || '(vazio)', foi_para: pred.get(r), era: verdade.get(r) }); });
    return { pares: { precisao: prec, revocacao: rev, f1: 2 * prec * rev / (prec + rev) }, entidades_verdadeiras: gab.entidades.length, entidades_previstas: porPred.size,
      mencoes: { total: men.length, certas, erradas, ambiguas_nao_ligadas: soltas }, cadastros_errados: cadErr.length, erros, donoPrev };
  }
  const A = { avaliar };
  if (typeof module !== 'undefined' && module.exports) module.exports = A; else raiz.Avaliacao = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
