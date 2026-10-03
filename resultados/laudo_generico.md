# Laudo de saúde dos dados

Pasta: `dados` · 6 fontes · gerado em 2026-10-02 19:44 · 0,106 s

## Fontes

| Fonte | Formato | Registros | Chaves encontradas (por conteúdo, não pelo nome da coluna) |
|---|---|---|---|
| chamados.jsonl | JSON por linha | 475 | id (id, 100%), empresa_digitada (nome, 100%) |
| contratos/ | documentos (texto) | 210 | 210 CNPJ, 0 e-mails, 0 telefones citados no texto |
| crm.csv | CSV separado por ";" | 264 | id_crm (id, 100%), empresa (nome, 100%), cnpj (cnpj, 81.1%), email (email, 100%), telefone (telefone, 100%), contato (nome, 100%) |
| emails.jsonl | JSON por linha | 447 | id (id, 100%), de (email, 100%) |
| erp_clientes.csv | CSV separado por ";" | 251 | cod_erp (id, 100%), razao_social (nome, 100%), cnpj (cnpj, 91.2%) |
| erp_notas.csv | CSV separado por ";" | 2832 | nf (id, 100%) |

## O que liga com o quê

- crm.csv::empresa ↔ erp_clientes.csv::razao_social por nome: 218 valores em comum (94% de um lado, 100% do outro)
- crm.csv::cnpj ↔ erp_clientes.csv::cnpj por cnpj: 186 valores em comum (100% de um lado, 86.1% do outro)
- chamados.jsonl::empresa_digitada ↔ crm.csv::empresa por nome: 170 valores em comum (64.6% de um lado, 73.3% do outro)
- chamados.jsonl::empresa_digitada ↔ erp_clientes.csv::razao_social por nome: 166 valores em comum (63.1% de um lado, 76.1% do outro)
- crm.csv::email ↔ emails.jsonl::de por email: 166 valores em comum (66.4% de um lado, 61.7% do outro)
- Chave estrangeira: erp_notas.csv::cod_erp aponta para erp_clientes.csv::cod_erp (251 valores, 0 órfãos)
- contratos/: de 210 documentos, 191 ligam a um cadastro por CNPJ/e-mail/telefone, 19 só por nome, 0 por nada evidente

## Cópias entre sistemas

- crm.csv::endereco é 87.6% idêntico a erp_clientes.csv::endereco_cobranca (186 pares). cópia confirmada pela marca de importação: concordar entre si não confirma nada.

## Riscos, do maior para o menor

- **alta** · crm.csv::empresa: 16 nomes que servem para mais de um registro. perguntas por nome precisam avisar a ambiguidade em vez de escolher.
- **alta** · crm.csv::cnpj: 13 CNPJ com dígito verificador errado. esses registros não ligam por CNPJ a nada; ou se corrige com regra conservadora, ou viram pendência.
- **alta** · crm.csv::cnpj: 50 registros sem CNPJ (18.9%). só ligam por e-mail, telefone ou nome; nome sozinho é a maior fonte de erro silencioso.
- **alta** · crm.csv::cnpj: 6 grupos matriz/filial (mesma raiz de CNPJ). pergunta que cita só o nome fantasia pode cair na unidade errada sem ninguém perceber.
- **alta** · crm.csv::contato: 45 nomes que servem para mais de um registro. perguntas por nome precisam avisar a ambiguidade em vez de escolher.
- **alta** · erp_clientes.csv::razao_social: 18 nomes que servem para mais de um registro. perguntas por nome precisam avisar a ambiguidade em vez de escolher.
- **alta** · erp_clientes.csv::cnpj: 22 registros sem CNPJ (8.8%). só ligam por e-mail, telefone ou nome; nome sozinho é a maior fonte de erro silencioso.
- **alta** · erp_clientes.csv::cnpj: 6 grupos matriz/filial (mesma raiz de CNPJ). pergunta que cita só o nome fantasia pode cair na unidade errada sem ninguém perceber.
- **alta** · erp_clientes.csv::lote_importacao: marca de importação presente em 62.5% dos registros (ex.: IMP-CRM-2024-01, IMP-CRM-2024-02, IMP-CRM-2024-03, IMP-CRM-2024-06, IMP-CRM-2024-07). parte desta fonte é cópia de outra: concordância entre as duas não é confirmação.
- **media** · crm.csv::cnpj: 15 CNPJ aparecem em mais de um registro. duplicata na mesma fonte: a camada precisa fundir, e o sistema de origem vai continuar criando.
- **media** · crm.csv::email: 83 e-mails de provedor genérico (33.2% dos distintos). o domínio não identifica a empresa; só o endereço exato liga.
- **media** · emails.jsonl::de: 147 e-mails de provedor genérico (54.6% dos distintos). o domínio não identifica a empresa; só o endereço exato liga.
- **media** · erp_clientes.csv::cnpj: 13 CNPJ aparecem em mais de um registro. duplicata na mesma fonte: a camada precisa fundir, e o sistema de origem vai continuar criando.
- **media** · crm.csv::endereco: 87.6% igual a erp_clientes.csv::endereco_cobranca em 186 registros ligados por chave. cópia confirmada pela marca de importação: concordar entre si não confirma nada.
- **media** · contratos/: 19 de 210 documentos só ligam a um cadastro pelo nome. é onde o erro silencioso acontece: nome parecido de cliente diferente.
- **baixa** · crm.csv::cnpj: 2 formatos de escrita (99.999.999/9999-99, 99999999999999). normalizar antes de comparar; igualdade de texto cru perde ligações.
- **baixa** · crm.csv::endereco: 38 padrões de escrita de endereço. comparar endereço exige normalizar logradouro, número e cidade.
- **baixa** · erp_clientes.csv::endereco_cobranca: 24 padrões de escrita de endereço. comparar endereço exige normalizar logradouro, número e cidade.

## O que este laudo não faz

- Não resolve entidades nem corrige nada: só mede. A resolução é a camada (`nucleo.js`).
- Tipa colunas pelo conteúdo com regras simples; uma coluna de CPF pode ser lida como telefone e um código numérico como id. Confira a tabela de fontes antes de usar.
- Cópia é inferida por concordância alta entre campos do mesmo tipo em registros ligados por chave; não prova a direção da importação.
- Lê CSV, JSONL, JSON e texto. Não lê planilhas binárias, PDF nem banco direto.