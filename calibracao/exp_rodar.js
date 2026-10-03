// exp_rodar.js jobs.json saida.jsonl — roda os trabalhos que ainda não estão na saída (retomável)
const fs = require('fs'); const { avaliar, benchCamada } = require('./exp_lib');
const [jf, of] = process.argv.slice(2); const jobs = JSON.parse(fs.readFileSync(jf, 'utf8'));
const feitos = new Set(fs.existsSync(of) ? fs.readFileSync(of, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
let n = 0; const t0 = Date.now();
for (const j of jobs) { if (feitos.has(j.id)) continue;
  const m = j.bench ? benchCamada(j.params, j.semente, j.ruido) : avaliar(j.params, j.semente, j.ruido);
  fs.appendFileSync(of, JSON.stringify(Object.assign({ id: j.id }, j.meta || {}, m)) + '\n'); n++; }
console.log(`ok: ${n} novos em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
