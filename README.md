# Dossiê de entidades — o Serena para o que não é código

O [Serena](https://github.com/oraios/serena) dá a um agente um "IDE" para código: achar o símbolo, achar quem o referencia, ver a estrutura. Funciona porque o código já tem um *language server* que sabe o que cada coisa é.

Os dados de uma empresa não têm. O mesmo cliente aparece de sete jeitos em seis sistemas, com CNPJ digitado errado, endereço antigo no CRM e o novo só num e-mail. Este repositório constrói essa camada para entidades de negócio e mede quanto ela ajuda um agente.

**Página com tudo rodando no navegador:** [wmeur385-cpu.github.io/Apps](https://wmeur385-cpu.github.io/Apps/) — é o arquivo [`dossie_entidades.html`](dossie_entidades.html) deste repositório, que também roda offline, sem servidor. Para refazer: `node montar_pagina.js`.

## O que tem aqui

| Arquivo | O que faz |
|---|---|
| `nucleo.js` | A camada. JavaScript puro, sem dependências. O mesmo arquivo roda na página, no servidor MCP e no benchmark. |
| `servidor_mcp.js` | Servidor MCP (stdio) com 5 ferramentas: `buscar_entidade`, `dossie`, `referencias`, `divergencias`, `linha_do_tempo`. |
| `gerar_dados.js` | Gera a empresa fictícia com 6 fontes bagunçadas (CRM, ERP, notas, contratos, e-mails, chamados) e o gabarito separado. Semente fixa. |
| `benchmark.js` | Mesmas perguntas, dois contextos: busca BM25 sobre todos os registros vs. a camada. |
| `fora_da_amostra.sh` | Resolução e benchmark em 10 sementes que o código nunca viu. |
| `avaliar_llm.js` | Etapa com modelo: um Haiku responde com cada contexto; conta acerto e tokens cobrados. Pede `--confirmar` antes de gastar. |
| `testes.js` | 12 testes, inclusive o MCP de ponta a ponta. Rodados 3× antes de publicar. |
| `laudo.js` | Laudo de saúde dos dados para qualquer pasta de exportações, sem conhecer o esquema: tipagem por conteúdo, chaves que ligam as fontes, cópias entre sistemas, riscos ordenados. `testes_laudo.js`: 27 checagens (contagem independente, esquema trocado, sabotagem plantada). |
| `teste_permissoes.js` | Ataque pré-registrado à camada de permissões (5 perfis × 5 ferramentas × todas as entidades × 4 bases): 3776 checagens, 131932 tokens de fontes proibidas procurados nas saídas, 0 violações. |
| `bancada/` | Bancada aberta para Company Brains: adaptador de três funções liga qualquer sistema (inclusive por HTTP) às mesmas perguntas e ao mesmo critério; devolve faixa sobre várias bases e seis armadilhas plantadas. `bancada/teste_bancada.js` prova que reproduz o `benchmark.js`. |
| `calibracao/` | Planejamento de experimentos pré-registrado (Taguchi L27×L8 → superfície de resposta → otimização bayesiana) sobre os parâmetros da camada, com teste em 100 bases intocadas. |

## Princípios

1. Toda afirmação carrega a origem (`fonte:id`, arquivo e linha).
2. Divergência é mostrada, não escondida. A camada escolhe a declaração mais recente e lista todas.
3. Cópia entre sistemas não conta como confirmação: o ERP importado do CRM "concordar" com o CRM não prova nada.
4. O que nenhuma fonte sabe vira lacuna. Menção que não dá para ligar com segurança fica pendente, com os candidatos.
5. CNPJ é validado pelos dígitos verificadores; dois CNPJs válidos diferentes nunca viram a mesma entidade.

## Resultados (semente de desenvolvimento, 420 perguntas sem ambiguidade)

"Evidência completa" = todos os registros de que a resposta depende chegaram ao contexto. Tokens = mediana por pergunta (cl100k_base, aproximação).

| Pergunta | n | Busca, 20 trechos | Busca, 50 trechos | Camada | Camada responde certo sem modelo |
|---|---|---|---|---|---|
| endereço atual (cliente que mudou) | 53 | 62,3% · 2176 tok | 75,5% · 4389 tok | **96,2%** · 430 tok | 98,1% |
| chamados do cliente | 154 | 57,1% · 1459 tok | 84,4% · 3438 tok | **96,8%** · 299 tok | 89,6% |
| faturado diverge do contrato? | 164 | 14,6% · 3305 tok | 34,8% · 8380 tok | **98,2%** · 818 tok | 98,2% |
| total em atraso | 49 | 98,0% · 1320 tok | 100,0% · 3112 tok | **95,9%** · 184 tok | 95,9% |
| todas | 420 | 46,0% · 1648 tok | 65,7% · 4009 tok | **97,1%** · 423 tok | 94,8% |

- 119 perguntas citam um nome que serve para mais de um cliente: a camada avisou em 114 e errou sem avisar em 5.
- Fora da amostra (10 sementes): ver `resultados/fora_da_amostra.csv` e `resultados/erros_fora.json`.

## Além da camada: o que um cliente novo cobra

| | O que é | Medido |
|---|---|---|
| Laudo de saúde dos dados | `node laudo.js <pasta>` em qualquer pasta de CSV/JSON/texto, em segundos | acha o mesmo com o esquema trocado e com sabotagem plantada; 27 checagens, 3× |
| Permissões | cada perfil só vê as fontes que já vê; identidade recalculada só com o que sobra; ocultos contados, nunca mostrados | 3776 checagens, 0 violações, critérios com hash antes de rodar |
| Bancada aberta | mesmas perguntas, qualquer sistema, resultado em faixa | camada 96,4–98,2% de evidência e 496–505 tokens vs. BM25 42,2–49,1% e 1647–1677 tokens em 3 bases; armadilhas 6–6 vs. 0–0 de 6 |

## Rodar

```sh
npm install                  # só para o servidor MCP e o contador de tokens
node gerar_dados.js
node testes.js
node benchmark.js 20
./fora_da_amostra.sh
node laudo.js dados                 # laudo de saúde dos dados (qualquer pasta serve)
node testes_laudo.js
node teste_permissoes.js
node bancada/bancada.js --sistema bancada/adaptadores/camada.js
node bancada/teste_bancada.js
ANTHROPIC_API_KEY=... node avaliar_llm.js --confirmar --n 120
```

Configuração MCP:

```json
{ "mcpServers": { "dossie-entidades": { "command": "node", "args": ["/caminho/servidor_mcp.js"] } } }
```

## Calibração com planejamento de experimentos (pasta `calibracao/`)

Pré-registro com hash antes de rodar (`calibracao/preregistro.md`). Sequência: L27 × L8 de Taguchi (448 avaliações) → confirmação um fator por vez → regra nova de matriz/filial (`grupo: 'aprende'`) → composto central face-centrado (1.120 avaliações) → otimizador bayesiano em JS puro (`bo.js`) contra busca aleatória → validação (50 bases) → teste único em 100 bases intocadas + estresse.

Resultado no teste: erros silenciosos de 13,7 para 3,0 por base (−78%, IC da razão 0,19–0,26), cadastros juntados errado a zero, F1 +0,006. Pendências +10,4% (IC 7,1–14,0%), acima do teto de 10% escrito antes. **Decisão: a configuração nova não virou padrão; fica como opção, com o preço medido.** `node calibracao/exp_rodar.js` roda qualquer lote; `python3 calibracao/analise_triagem.py`, `analise_rsm.py`, `testes_estat.py` e `resumo.py` refazem a análise.

## Limites

Dados sintéticos (o gerador vai junto justamente por isso); uma entidade só; permissão por fonte e perfil, não por linha; 4,5 mil registros, com uma etapa de comparação de nomes que precisa de bloqueio para escalar; a linha de base é busca por palavra-chave, não vetorial; a etapa com modelo ainda não foi rodada.

---
Leonardo Pedro Barossi
