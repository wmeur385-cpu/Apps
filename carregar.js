// carregar.js — lê a pasta de dados crus no formato que o núcleo espera (só as fontes; nunca o gabarito)
const fs = require('fs'), path = require('path');
module.exports = function carregar(dir) {
  dir = dir || path.join(__dirname, 'dados');
  const r = f => fs.readFileSync(path.join(dir, f), 'utf8');
  const cdir = path.join(dir, 'contratos');
  return { crm: r('crm.csv'), erp_clientes: r('erp_clientes.csv'), erp_notas: r('erp_notas.csv'), chamados: r('chamados.jsonl'), emails: r('emails.jsonl'),
    contratos: fs.readdirSync(cdir).sort().map(a => ({ arquivo: a, texto: fs.readFileSync(path.join(cdir, a), 'utf8') })) };
};
