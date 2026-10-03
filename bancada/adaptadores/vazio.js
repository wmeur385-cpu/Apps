// Adaptador de piso: não devolve contexto nenhum. Serve para ver o que a bancada marca como zero.
module.exports = { nome: 'nada (piso)', preparar() {}, responder() { return { contexto: '', resposta: null }; } };
