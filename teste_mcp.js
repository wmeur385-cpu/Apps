// teste_mcp.js — sobe o servidor por stdio como um cliente MCP de verdade e chama as 5 ferramentas
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const assert = require('assert');
(async () => {
  const c = new Client({ name: 'teste', version: '1' });
  await c.connect(new StdioClientTransport({ command: 'node', args: [__dirname + '/servidor_mcp.js'] }));
  const { tools } = await c.listTools(); const nomes = tools.map(t => t.name).sort();
  assert.deepStrictEqual(nomes, ['buscar_entidade', 'divergencias', 'dossie', 'linha_do_tempo', 'referencias']);
  const g = require('./gabarito/gabarito.json'); const alvo = g.entidades.find(e => e.muda && e.contrato && e.diverge_valor) || g.entidades.find(e => e.muda);
  const chama = async (n, a) => JSON.parse((await c.callTool({ name: n, arguments: a })).content[0].text);
  const b = await chama('buscar_entidade', { consulta: alvo.cnpj.slice(0, 2) + '.' + alvo.cnpj.slice(2, 5) + '.' + alvo.cnpj.slice(5, 8) + '/' + alvo.cnpj.slice(8, 12) + '-' + alvo.cnpj.slice(12) });
  assert.ok(b.length && b[0].score === 1, 'busca por CNPJ formatado');
  const d = await chama('dossie', { id: b[0].id });
  assert.strictEqual(d.endereco.atual.endereco, require('./nucleo').parseEnd(alvo.endereco_atual).chave, 'endereço mais recente');
  const refs = await chama('referencias', { id: b[0].id, fonte: 'nf' }); assert.strictEqual(refs.length, 12, '12 notas');
  const dv = await chama('divergencias', { id: b[0].id }); assert.ok(dv.some(x => x.campo === 'endereço'));
  const lt = await chama('linha_do_tempo', { id: b[0].id }); assert.ok(lt.length > 12 && lt.every((x, i) => !i || lt[i - 1].data <= x.data), 'ordenada');
  const nx = await chama('dossie', { id: 'ENT-9999' }); assert.ok(nx.erro);
  console.log(`MCP ok: 5 ferramentas, ${alvo.fantasia} → ${b[0].id}; endereço ${d.endereco.atual.endereco} (de ${d.endereco.atual.ref}); ${dv.length} divergências; ${lt.length} eventos`);
  await c.close();
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
