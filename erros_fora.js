// erros_fora.js — classifica os erros das 10 sementes fora da amostra (só observa; o código já está congelado)
const { execSync } = require('child_process'); const fs = require('fs');
const tot = { erros: 0, mesmo_grupo: 0, cadastros_separados: 0, cadastros_mesmo_grupo: 0, por_motivo: {} };
for (let s = 101; s <= 110; s++) {
  execSync(`node gerar_dados.js ${s}`);
  for (const k of Object.keys(require.cache)) if (/gabarito|nucleo|avaliacao/.test(k)) delete require.cache[k];
  const N = require('./nucleo'), A = require('./avaliacao'), g = require('./gabarito/gabarito.json');
  const I = N.construir(require('./carregar')()); const r = A.avaliar(I, g);
  const grupo = new Map(g.entidades.map(e => [e.id, e.grupo]));
  r.erros.forEach(e => { tot.erros++; const dono = r.donoPrev.get(e.foi_para); const mg = grupo.get(dono) && grupo.get(dono) === grupo.get(e.era); if (mg) tot.mesmo_grupo++; if (mg && e.tipo.startsWith('cadastro')) tot.cadastros_mesmo_grupo++;
    if (e.tipo.startsWith('cadastro')) tot.cadastros_separados++; const m = e.tipo.startsWith('cadastro') ? 'cadastro' : (e.ligado_por || '').replace(/ \(.*\)/, ''); tot.por_motivo[m] = (tot.por_motivo[m] || 0) + 1; });
}
execSync('node gerar_dados.js');
fs.writeFileSync('resultados/erros_fora.json', JSON.stringify(tot, null, 1)); console.log(JSON.stringify(tot));
