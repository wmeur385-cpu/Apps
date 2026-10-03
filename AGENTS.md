# AGENTS.md — regras curtas para quem (pessoa ou agente) mexer aqui

Comandos: `node gerar_dados.js` · `node testes.js` (12 testes, 3× antes de publicar) · `node benchmark.js 20` · `node teste_permissoes.js` · `node laudo.js <pasta>` · `node testes_laudo.js` · `node bancada/bancada.js --sistema <adaptador>` · `node bancada/teste_bancada.js` · `node montar_pagina.js`. Antes de publicar: todos os testes 3×, depois `montar_pagina.js`.

Invariantes:
- O núcleo (`nucleo.js`) nunca lê o gabarito. A prova é `grep gabarito nucleo.js` vazio, e um teste confere.
- Toda afirmação carrega `ref` e `origem`. Resposta sem origem é bug.
- Divergência é exposta, não escondida; menção sem evidência que decida fica pendente.
- CNPJ válido diferente nunca funde entidades.
- Parâmetros padrão são os da v1.0. Mudar padrão exige teste pré-registrado em sementes novas (ver `calibracao/preregistro.md`).
- Perfis de permissão: quem não vê a fonte no sistema de origem não vê aqui. `teste_permissoes.js` tem que dar 0 violações.

Armadilhas (cicatrizes):
- "R." e "Av." quebravam a extração de endereço; o teste de evidência pegou.
- Resultados guardados ficaram velhos depois de mudar o núcleo; a sala limpa pegou. Refaça as medições depois de qualquer mudança no núcleo.
- Menções pendentes não eram filtradas por perfil; o ataque de permissões pegou.
- O laudo tipava telefone pelo nome da coluna e errava com +55 e com 12 dígitos; o teste de esquema trocado pegou. Tipagem é por conteúdo, com o país tirado.
- A bancada contava ids de origem como texto e perdia a parte `#ad1` dos contratos; o teste de equivalência com o benchmark pegou.
- Um efeito "significativo" na L27 era confusão com outro fator; a confirmação um a um pegou.
