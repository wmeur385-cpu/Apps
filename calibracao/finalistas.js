// finalistas.js — junta até 5 finalistas (ótimo restrito da RSM + escolhido de cada otimização + melhor da busca aleatória)
const fs = require('fs');
const R = JSON.parse(fs.readFileSync('rsm_resultado.json', 'utf8')); const F = R.fatores;
const dec = x => { const p = { grupo: 'aprende' }; F.forEach(([n, a, b], i) => p[n] = +(a + (x[i] + 1) / 2 * (b - a)).toFixed(4)); return p; };
const fin = [{ nome: 'RSM, ótimo restrito', params: dec(R.aprende.otimo_restrito.x) }];
for (const s of [1, 2, 3]) { const b = JSON.parse(fs.readFileSync(`bo_aprende_${s}.json`, 'utf8')); fin.push({ nome: `Otimização bayesiana ${s}`, params: b.hist[b.hist.length - 1].escolhido }); }
const rs = [1, 2, 3].map(s => JSON.parse(fs.readFileSync(`rs_aprende_${s}.json`, 'utf8'))).map(r => r.hist[r.hist.length - 1]).filter(h => h.escolhido).sort((a, b) => a.melhor - b.melhor)[0];
if (rs) fin.push({ nome: 'Busca aleatória (melhor de 3)', params: rs.escolhido });
// remove duplicados exatos
const vistos = new Set(); const unicos = fin.filter(f => { const k = JSON.stringify(f.params); if (vistos.has(k)) return false; vistos.add(k); return true; });
fs.writeFileSync('finalistas.json', JSON.stringify(unicos, null, 1)); console.log(unicos);
const { ruidoDaSemente } = require('./exp_lib'); const jobs = [];
const cfgs = [{ nome: 'padrão (v1.0)', params: {} }, ...unicos];
cfgs.forEach((c, i) => { for (let s = 2001; s <= 2050; s++) jobs.push({ id: `v${i}_${s}`, meta: { cfg: i, nome: c.nome, semente: s }, params: c.params, semente: s, ruido: ruidoDaSemente(s) }); });
fs.writeFileSync('validacao_jobs.json', JSON.stringify(jobs)); console.log('validação:', jobs.length, 'avaliações');
