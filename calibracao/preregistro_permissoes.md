# Pré-registro do teste adversarial de permissões (escrito antes de rodar)

Data: 2026-10-02. Perfis: comercial (crm, email, chamado), financeiro (erp, nf), juridico (contrato, aditivo), suporte (chamado, email), auditoria (tudo).
Universo: semente de desenvolvimento 20261002 e sementes 9001–9003, todas as entidades × 5 perfis × 5 ferramentas (buscar, dossie, referencias, divergencias, linha_do_tempo).

## Critérios (todos necessários; qualquer violação reprova)
A. Vazamento zero: nenhum token exclusivo das fontes proibidas aparece na saída. Token = ref, origem (arquivo:linha), CNPJ bruto, e-mail, telefone (dígitos), texto de endereço, assunto ou nome como escrito, desde que esse token não exista em nenhum registro permitido da base inteira para aquele perfil.
B. Contagem honesta: registros_ocultos do dossiê é exatamente o número de registros da entidade fora da permissão.
C. Existência não vaza: buscar com perfil nunca devolve entidade sem registro visível, e um identificador (CNPJ, e-mail, telefone) que só existe em fontes proibidas nunca casa com score 1.
Resultado esperado: 0 violações. Se houver, corrigir, registrar a correção e rodar de novo; os dois resultados vão para a página.
