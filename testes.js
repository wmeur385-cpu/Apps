// testes.js — suíte rodada 3× antes de publicar (regra do Leo)
const assert = require('assert'), crypto = require('crypto'), fs = require('fs'), { execSync } = require('child_process');
const N = require('./nucleo'), carregar = require('./carregar'), A = require('./avaliacao');
let ok = 0; const t = (nome, fn) => { fn(); ok++; };
t('CNPJ: dígitos verificadores reais', () => { assert.ok(N.cnpjValido('11222333000181')); assert.ok(!N.cnpjValido('11222333000182')); assert.ok(!N.cnpjValido('00000000000000')); });
t('nomes: abreviação e ruído', () => { assert.strictEqual(N.normNome('MERC BOM PRECO COM LTDA'), N.normNome('Mercado Bom Preço Comércio Ltda')); });
t('endereço: formatos diferentes, mesma chave', () => { const a = N.parseEnd('Rua XV de Novembro, 123 - Centro, Curitiba').chave, b = N.parseEnd('R. XV de Novembro 123, Curitiba').chave, c = N.parseEnd('RUA XV DE NOVEMBRO, 123 - CENTRO - CURITIBA').chave; assert.ok(a === b && b === c, a + '|' + b + '|' + c); });
t('gerador determinístico', () => { const h = () => crypto.createHash('sha1').update(fs.readFileSync('dados/crm.csv')).digest('hex'); const h1 = h(); execSync('node gerar_dados.js'); assert.strictEqual(h(), h1); });
const I = N.construir(carregar()); const g = require('./gabarito/gabarito.json'); const r = A.avaliar(I, g);
t('núcleo não lê o gabarito', () => { assert.ok(!fs.readFileSync('nucleo.js', 'utf8').includes('gabarito')); });
t('resolução na semente de desenvolvimento', () => { assert.ok(r.pares.f1 > 0.98, 'f1 ' + r.pares.f1); assert.strictEqual(r.cadastros_errados, 0); });
t('nenhuma ref inventada: tudo que a camada cita existe na fonte', () => { I.interno.ents.forEach(e => { const d = I.dossie(e.id); JSON.stringify(d).replace(/"ref":"([^"]+)"/g, (_, x) => { assert.ok(I.interno.porRef.has(x), x); }); }); });
t('linha do tempo sempre ordenada', () => { I.interno.ents.slice(0, 60).forEach(e => { const l = I.linhaDoTempo(e.id); l.forEach((x, i) => assert.ok(!i || l[i - 1].data <= x.data)); }); });
t('CNPJ conflitante nunca funde entidades', () => { I.interno.ents.forEach(e => assert.ok(e.regs.filter(x => x.cnpjOk).every((x, _, a) => x.cnpj === a[0].cnpj))); });
t('homônimos de cidades diferentes ficam separados', () => { const hom = g.entidades.filter((e, i, a) => a.filter(o => o.fantasia === e.fantasia).length > 1); assert.ok(hom.length >= 20); hom.forEach(e => assert.notStrictEqual(I.entidadeDe('crm:' + e.registros.find(x => x.startsWith('crm:')).slice(4)), null)); });
t('benchmark: camada usa menos tokens e traz mais evidência', () => { const b = JSON.parse(fs.readFileSync('resultados/benchmark_k20.json')); assert.ok(b.claras.geral.B_tokens_mediana < b.claras.geral.A_tokens_mediana); assert.ok(b.claras.geral.B_evidencia_completa > b.claras.geral.A_evidencia_completa); });
t('servidor MCP de ponta a ponta', () => { execSync('node teste_mcp.js'); });
console.log(`${ok} testes ok`);
