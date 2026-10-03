# Bancada aberta para Company Brains

Uma régua pública para medir qualquer sistema que prometa "responder sobre a empresa citando a fonte". Mesmos dados, mesmas perguntas, mesmo critério, qualquer sistema: a camada deste repositório, uma busca por palavra-chave, um produto comercial atrás de uma API.

## O que ela mede

Para cada pergunta existe uma lista dos registros de origem de que a resposta depende (o "ouro", vindo do gabarito que o sistema nunca vê). A bancada manda a pergunta ao sistema, recebe o contexto que ele montaria para o modelo e mede:

| Medida | O que é | Por que importa |
|---|---|---|
| Evidência completa | Todos os registros do ouro aparecem no contexto, citados pelo id de origem (`crm:C0012`, `nf:000123`, `ct:CT-0007`) | Resposta certa sem a evidência certa é sorte |
| Tokens por pergunta | Tamanho do contexto (cl100k, aproximação) | É o custo de cada resposta; o que o cliente paga por mês |
| Responde sozinho | Se o sistema devolve a resposta além do contexto, quantas estão certas | Mostra o quanto o modelo precisa inventar por cima |
| Ambíguas sem aviso | Perguntas cujo nome serve para mais de um cliente real: o sistema avisou? | Chutar em silêncio é o erro que o cliente não vê |
| Armadilhas | Cliente que não existe; nome compartilhado por matriz e filial sem a cidade | Inventar contexto para quem não existe é o pior resultado possível |

Cada medida sai como faixa (mínimo, mediana, máximo) sobre várias bases geradas com sementes diferentes, não como número único. A pergunta não é "quanto deu", é "quanto varia".

## Resultado dos adaptadores que vêm com o repositório (sementes 9101–9103)

| Sistema | Evidência completa | Tokens (mediana) | Responde sozinho | Ambíguas sem aviso | Armadilhas pegas |
|---|---|---|---|---|---|
| Camada de entidades | 96,4–98,2% | 496–505 | 94,3–96,4% | 2–16 por base | 6–6 de 6 |
| Busca por palavra-chave (BM25, 20 trechos) | 42,2–49,1% | 1647–1677 | não responde | 116–147 por base | 0–0 de 6 |
| Nada (piso) | 0–0% | 0–0 | não responde | 116–147 por base | 3–3 de 6 |

O piso "pega" a armadilha do cliente inexistente só porque não devolve nada. Por isso armadilha se lê junto com evidência: não inventar é necessário, não é suficiente.

## Como plugar o seu sistema

Um arquivo JavaScript com três coisas:

```js
module.exports = {
  nome: 'meu company brain',
  async preparar({ arq, dir, semente }) { /* indexe as fontes: arq.crm, arq.erp_clientes, arq.erp_notas, arq.contratos[], arq.emails, arq.chamados */ },
  async responder({ texto, tipo, alvo }) { /* texto = a pergunta; alvo = o nome do cliente como foi escrito */
    return { contexto: '...', resposta: null, aviso: false, nao_encontrado: false };
  }
};
```

- `contexto` precisa citar os registros pelos ids da base. Evidência sem origem não conta: esse é o ponto.
- `resposta` é opcional. Se vier, a bancada confere (número com tolerância de um centavo, booleano, endereço normalizado).
- `aviso` = o sistema percebeu que o nome serve para mais de um cliente. `nao_encontrado` = não achou ninguém.

Veja `adaptadores/exemplo_http.js` para um sistema que atende por HTTP.

## Rodar

```sh
node bancada/bancada.js --sistema bancada/adaptadores/camada.js
node bancada/bancada.js --sistema bancada/adaptadores/bm25.js --k 50
node bancada/bancada.js --sistema meu_adaptador.js --sementes 9101,9102,9103,9104,9105
node bancada/teste_bancada.js    # prova que a bancada reproduz o benchmark.js na semente de desenvolvimento
```

## Limites, ditos antes que alguém pergunte

- Os dados são sintéticos. O gerador vai junto (`gerar_dados.js`) e pode ser estendido; uma base real com gabarito real vale mais.
- A bancada vê a resposta, não a entidade. Um sistema que acerta "3 chamados" olhando o cliente errado conta como acerto aqui e como erro no benchmark interno, que confere a entidade pelo gabarito. Na semente de desenvolvimento a diferença foi de 2 perguntas em 420 (`teste_bancada.js`).
- Tokens são contados com cl100k, não com o tokenizador do modelo que você usa. A razão entre dois sistemas é o que vale.
- Quatro tipos de pergunta, uma entidade (cliente), seis fontes. Perguntas de produto, pessoa ou pedido não existem ainda.
