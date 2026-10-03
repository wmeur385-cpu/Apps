// bancada/teste_bancada.js — a bancada tem que reproduzir os números do benchmark.js na semente de desenvolvimento, e o piso tem que dar zero
const { medir } = require('./bancada'); const b20 = require('../resultados/benchmark_k20.json');
let ok = 0, falhas = 0; const t = (n, c, i) => { if (c) ok++; else { falhas++; console.log('FALHA', n, i ?? ''); } };
(async () => {
  const cam = await medir(require('./adaptadores/camada'), 20261002), bm = await medir(require('./adaptadores/bm25'), 20261002), vz = await medir(require('./adaptadores/vazio'), 20261002);
  const r = x => Math.round(x * 1000) / 10;
  t('camada: evidência igual ao benchmark', cam.claras.geral.evidencia_completa === r(b20.claras.geral.B_evidencia_completa), [cam.claras.geral.evidencia_completa, r(b20.claras.geral.B_evidencia_completa)]);
  t('camada: tokens iguais ao benchmark', cam.claras.geral.tokens_mediana === b20.claras.geral.B_tokens_mediana, [cam.claras.geral.tokens_mediana, b20.claras.geral.B_tokens_mediana]);
  // a bancada só vê a resposta; o benchmark interno exige também a entidade certa. Acerto por coincidência na entidade errada entra aqui e não lá: diferença pequena e sempre para cima
  t('camada: responde sozinha ≥ benchmark e no máximo 1 ponto acima', cam.claras.geral.responde_sozinho >= r(b20.claras.geral.B_resposta_certa) && cam.claras.geral.responde_sozinho - r(b20.claras.geral.B_resposta_certa) <= 1, [cam.claras.geral.responde_sozinho, r(b20.claras.geral.B_resposta_certa)]);
  // o benchmark conta "entidade errada sem aviso" (olha o gabarito); a bancada só vê a resposta, então conta "respondeu errado sem aviso" — nunca mais que o benchmark
  t('camada: ambíguas sem aviso e errou não passa do benchmark', cam.ambiguas.sem_aviso_e_errou <= b20.ambiguas.camada_errou_sem_aviso && cam.ambiguas.sem_aviso === b20.ambiguas.n - b20.ambiguas.camada_sinalizou, [cam.ambiguas, b20.ambiguas]);
  t('bm25: evidência igual ao benchmark', bm.claras.geral.evidencia_completa === r(b20.claras.geral.A_evidencia_completa), [bm.claras.geral.evidencia_completa, r(b20.claras.geral.A_evidencia_completa)]);
  t('bm25: tokens iguais ao benchmark', bm.claras.geral.tokens_mediana === b20.claras.geral.A_tokens_mediana);
  t('bm25: não responde sozinho', bm.claras.geral.responde_sozinho === null);
  t('piso: zero evidência, zero tokens', vz.claras.geral.evidencia_completa === 0 && vz.claras.geral.tokens_mediana === 0);
  t('camada: pega todas as armadilhas', cam.armadilhas.pegou === cam.armadilhas.n, cam.armadilhas);
  t('bm25: cai em todas as armadilhas', bm.armadilhas.pegou === 0, bm.armadilhas);
  console.log(`${ok} checagens ok, ${falhas} falhas`); process.exit(falhas ? 1 : 0);
})();
