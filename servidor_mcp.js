#!/usr/bin/env node
// servidor_mcp.js — a camada de entidades exposta como servidor MCP (stdio).
// Mesmo espírito do Serena (achar símbolo, achar referências, visão geral), só que para entidades de negócio.
//   uso: node servidor_mcp.js [pasta_de_dados]
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const N = require('./nucleo'), carregar = require('./carregar');

const I = N.construir(carregar(process.argv[2]));
const srv = new McpServer({ name: 'dossie-entidades', version: N.versao });
const texto = o => ({ content: [{ type: 'text', text: JSON.stringify(o) }] });
const perfil = z.enum(['comercial', 'financeiro', 'juridico', 'suporte', 'auditoria']).optional().describe('perfil de quem pergunta: cada perfil só vê as fontes que já vê no sistema de origem; sem perfil = auditoria');
const naoAchou = id => texto({ erro: `entidade ${id} não existe; use buscar_entidade primeiro` });

srv.registerTool('buscar_entidade', {
  description: 'Equivalente ao find_symbol do Serena, para clientes: acha a entidade por nome (com erro de digitação), CNPJ (até com 1 dígito errado), e-mail ou telefone. Se vier "empate" ou "aviso", pergunte ao usuário qual cliente antes de responder.',
  inputSchema: { consulta: z.string().describe('nome, CNPJ, e-mail ou telefone, do jeito que o usuário escreveu'), limite: z.number().int().min(1).max(10).optional(), perfil },
}, async ({ consulta, limite, perfil }) => texto(I.buscar(consulta, limite || 5, perfil)));

srv.registerTool('dossie', {
  description: 'Equivalente ao get_symbols_overview: visão consolidada da entidade — nomes, CNPJs, endereço mais recente com todas as versões e datas, financeiro, chamados, divergências, lacunas e como cada registro foi ligado. Toda informação vem com ref (fonte:id) e origem (arquivo e linha).',
  inputSchema: { id: z.string().describe('id devolvido por buscar_entidade, ex.: ENT-0012'), perfil },
}, async ({ id, perfil }) => { const d = I.dossie(id, perfil); return d ? texto(d) : naoAchou(id); });

srv.registerTool('referencias', {
  description: 'Equivalente ao find_referencing_symbols: todos os registros, em todas as fontes, que citam a entidade. Itens com "pendente" são menções que podem ser desta entidade mas não puderam ser ligadas com segurança.',
  inputSchema: { id: z.string(), fonte: z.enum(['crm', 'erp', 'nf', 'contrato', 'aditivo', 'email', 'chamado']).optional(), perfil },
}, async ({ id, fonte, perfil }) => { const r = I.referencias(id, fonte, perfil); return r ? texto(r) : naoAchou(id); });

srv.registerTool('divergencias', {
  description: 'Onde as fontes discordam sobre a entidade (endereço, valor faturado × contrato, CNPJ com dígito verificador inválido) e quais cadastros só "concordam" porque um foi copiado do outro.',
  inputSchema: { id: z.string(), perfil },
}, async ({ id, perfil }) => { const r = I.divergencias(id, perfil); return r ? texto(r) : naoAchou(id); });

srv.registerTool('linha_do_tempo', {
  description: 'Eventos da entidade em ordem de data, juntando cadastro, contrato, aditivos, notas, e-mails e chamados, cada um com sua ref.',
  inputSchema: { id: z.string(), perfil },
}, async ({ id, perfil }) => { const r = I.linhaDoTempo(id, perfil); return r ? texto(r) : naoAchou(id); });

srv.connect(new StdioServerTransport());
