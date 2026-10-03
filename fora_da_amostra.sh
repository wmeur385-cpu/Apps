#!/bin/sh
# Roda resolução + benchmark em sementes que NUNCA foram usadas para ajustar o código (101..110).
cd "$(dirname "$0")"
echo "semente;f1_pares;precisao;revocacao;mencoes_erradas;mencoes_ambiguas;cadastros_errados;A_evid;B_evid;A_tok;B_tok;B_resp;amb_sinalizou;amb_errou_sem_aviso"
for s in 101 102 103 104 105 106 107 108 109 110; do
  node gerar_dados.js $s >/dev/null
  node -e "
const N=require('./nucleo'),c=require('./carregar'),A=require('./avaliacao');const I=N.construir(c());const r=A.avaliar(I,require('./gabarito/gabarito.json'));
const {execSync}=require('child_process');const b=JSON.parse(execSync('node benchmark.js 20').toString());const g=b.claras.geral;
console.log([$s,r.pares.f1.toFixed(4),r.pares.precisao.toFixed(4),r.pares.revocacao.toFixed(4),r.mencoes.erradas,r.mencoes.ambiguas_nao_ligadas,r.cadastros_errados,g.A_evidencia_completa.toFixed(3),g.B_evidencia_completa.toFixed(3),g.A_tokens_mediana,g.B_tokens_mediana,g.B_resposta_certa.toFixed(3),b.ambiguas.camada_sinalizou+'/'+b.ambiguas.n,b.ambiguas.camada_errou_sem_aviso].join(';'))"
done
node gerar_dados.js >/dev/null
