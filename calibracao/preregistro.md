# Pré-registro da calibração (escrito antes de rodar qualquer experimento)

Data: 2026-10-02. Código de partida: nucleo.js v1.1 com parâmetros padrão = v1.0 (provado: mesmos dossiês em 4 sementes).
Este arquivo tem o hash SHA-256 publicado na página. Mudou depois? O hash denuncia.

## Respostas
- **Y1 (primária, menor é melhor): erros silenciosos por base** = menções ligadas à entidade errada + cadastros juntados à entidade errada.
- Secundárias: pendentes (menções não ligadas), F1 por pares, precisão, revocação, entidades reconstruídas exatas.
- Benchmark (só nas fases 4 e 5): evidência completa, tokens por pergunta, perguntas ambíguas respondidas errado sem aviso.

## Sementes
| Bloco | Sementes | Uso |
|---|---|---|
| Desenvolvimento | 20261002 | contaminada, só ilustração |
| Ex-fora-da-amostra | 101–110 | já vistas; não valem mais como teste |
| Ajuste | 1001–1100 | triagem 1001–1016; RSM e otimizador 1001–1020; confirmação 1021–1060; otimismo 1061–1100 |
| Validação | 2001–2050 | escolher entre finalistas; consultas registradas |
| Teste | 9001–9100 | uma única execução, baseline × final |
| Estresse | 9501–9600 | bagunça 2× a 4× fora da faixa de ajuste; uma única execução |

Ruído por semente (fora da triagem): multiplicadores sorteados de forma determinística pela semente.
Ajuste/validação/teste: typo, dup, genérico, homônimos ∈ [0,5; 1,5]; grupos ∈ [0,5; 2].
Estresse: typo, dup, genérico, homônimos ∈ [2; 3]; grupos ∈ [3; 4].

## Fases
1. Triagem: L27 (3^13 sobre GF(3)) cruzada com L8 (5 fatores de ruído em 2 níveis) × 2 sementes = 432 avaliações.
   Colunas (1,1,0) e (1,2,0) vazias para a interação limiar de menção × margem.
   Análise principal: GLM de Poisson (ou binomial negativa se houver superdispersão) com bloco de célula de ruído; razão S/N só como secundária.
   Passa para a RSM: fator contínuo com p de Holm < 0,05 em Y1, pendentes ou F1, ou contribuição ≥ 5%; no máximo 4.
   Categóricos: fixados no melhor nível se significativos; senão, no padrão.
2. RSM: composto central face-centrado nos contínuos que passaram, 20 sementes comuns por ponto, modelo quadrático, falta de ajuste, análise canônica e de cumeeira.
3. Otimizador sequencial: processo gaussiano Matérn 5/2 ARD (JS próprio), EI sobre a melhor média posterior × probabilidade de cumprir as restrições, aquecido com os pontos da RSM; comparado com busca aleatória de mesmo orçamento.
   Restrições: pendentes ≤ 1,10 × baseline; F1 ≥ baseline − 0,002 (médias no bloco de ajuste).
4. Validação: até 5 finalistas + baseline nas sementes 2001–2050; escolhido = menor Y1 médio que cumpre as restrições.
5. Teste e estresse: baseline × escolhido, uma vez.

## Critério de aceitação (todos necessários, no bloco de teste)
1. Y1: redução média ≥ 20% em relação ao baseline; IC 95% bootstrap pareado (10 000 reamostragens) da diferença excluindo zero; Wilcoxon pareado p < 0,05.
2. Não inferioridade: F1 médio ≥ baseline − 0,002 (limite inferior do IC 95% da diferença); pendentes: limite superior do IC 95% da razão das médias < 1,10.
3. Benchmark em 20 sementes de teste: evidência completa não cai mais de 1 ponto; tokens não sobem mais de 5%; ambíguas respondidas errado sem aviso não aumentam.
4. Estresse: a diferença média de Y1 não inverte de sinal.
Secundárias reportadas com correção de Holm.
Se falhar: os parâmetros atuais ficam, e a página diz isso com o efeito mínimo detectável.
