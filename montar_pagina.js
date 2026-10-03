// montar_pagina.js — gera a página única offline com núcleo, avaliação, dados crus, gabarito e resultados embutidos
const fs = require('fs'); const carregar = require('./carregar');
const seguro = o => JSON.stringify(o).replace(/<\//g, '<\\/').replace(/\u2028|\u2029/g, '');
let h = fs.readFileSync('pagina.tpl.html', 'utf8');
const g = require('./gabarito/gabarito.json');
const gab = { entidades: g.entidades.map(e => ({ id: e.id, registros: e.registros })) }; // só o necessário para conferir
const bench = { k20: require('./resultados/benchmark_k20.json'), k50: require('./resultados/benchmark_k50.json'), fora: fs.readFileSync('resultados/fora_da_amostra.csv', 'utf8'), erros_fora: require('./resultados/erros_fora.json') };
h = h.replace('/*NUCLEO*/', () => fs.readFileSync('nucleo.js', 'utf8'))
     .replace('/*AVALIACAO*/', () => fs.readFileSync('avaliacao.js', 'utf8'))
     .replace('/*DADOS*/', () => seguro(carregar()))
     .replace('/*GABARITO*/', () => seguro(gab))
     .replace('/*BENCH*/', () => seguro(bench))
     .replace('/*CALIB*/', () => seguro(require('./calibracao/calib_pagina.json')))
     .replace('/*EXTRAS*/', () => seguro(extras()));
function md(t) { // markdown mínimo do laudo → HTML
  const esc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;'); const inl = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = []; let lista = false, tab = [];
  const fechar = () => { if (lista) { out.push('</ul>'); lista = false; } if (tab.length) { const [cab, , ...corpo] = tab; const c = l => l.split('|').slice(1, -1).map(x => x.trim()); out.push(`<div class="tabela-wrap"><table class="livre"><thead><tr>${c(cab).map(x => `<th scope="col">${inl(x)}</th>`).join('')}</tr></thead><tbody>${corpo.map(l => `<tr>${c(l).map(x => `<td>${inl(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); tab = []; } };
  for (const l of t.split('\n')) { if (/^\|/.test(l)) { if (lista) { out.push('</ul>'); lista = false; } tab.push(l); continue; } if (tab.length) fechar();
    if (/^# /.test(l)) { fechar(); out.push(`<h1>${inl(l.slice(2))}</h1>`); } else if (/^## /.test(l)) { fechar(); out.push(`<h2>${inl(l.slice(3))}</h2>`); } else if (/^- /.test(l)) { if (!lista) { out.push('<ul class="lista">'); lista = true; } out.push(`<li>${inl(l.slice(2))}</li>`); } else if (l.trim()) { fechar(); out.push(`<p>${inl(l)}</p>`); } else fechar(); }
  fechar(); return out.join('\n');
}
function extras() {
  const perm = require('./resultados/permissoes.json'); const laudo = require('./resultados/laudo_generico.json');
  return { permissoes: { checagens: perm.checagens, tokens_testados: perm.tokens_testados, violacoes: perm.violacoes.length, por_criterio: perm.por_criterio }, hash_permissoes: fs.readFileSync('calibracao/preregistro_permissoes.sha256', 'utf8').split(' ')[0],
    laudo_html: md(fs.readFileSync('resultados/laudo_generico.md', 'utf8')), laudo_segundos: laudo.segundos,
    bancada: { camada: require('./resultados/bancada_camada.json'), bm25: require('./resultados/bancada_bm25.json'), vazio: require('./resultados/bancada_vazio.json') } };
}
const destino = process.argv[2] || 'dossie_entidades.html'; // na raiz do repositório; o GitHub Pages serve daqui
fs.writeFileSync(destino, h);
console.log('página:', (h.length / 1024).toFixed(0), 'KB');
