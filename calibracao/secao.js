// ---------- calibração (dados em CALIB, gerados por calibracao/resumo.py) ----------
(function () {
  if (typeof CALIB === 'undefined' || !CALIB) return;
  const C = CALIB, $ = s => document.querySelector(s);
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n1 = (x, d = 1) => Number(x).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pc = x => n1(x * 100, 0) + '%';
  const W = 640;
  $('#cal-hash').textContent = C.hash;
  $('#cal-sementes').innerHTML = C.sementes.map(s => `<tr><td>${esc(s[0])}</td><td class="num">${esc(s[1])}</td><td>${esc(s[2])}</td></tr>`).join('');

  // 1. triagem: evidência por fator (−log10 do p de Holm), erro silencioso e pendências lado a lado
  const T = C.triagem; const fat = T.fatores.slice().sort((a, b) => Math.max(b.ly, b.lp) - Math.max(a.ly, a.lp));
  $('#cal-triagem-txt').textContent = `27 combinações de parâmetros, cada uma rodada contra 8 combinações de bagunça do gerador (mais typo ou menos, mais duplicata ou menos, mais e-mail genérico, mais matriz e filial, mais homônimos), com 2 sementes cada: ${T.n} avaliações. Análise por GLM quase-Poisson com bloco de semente; dispersão estimada ${n1(T.dispersao, 2)}. A barra mostra o tamanho da evidência de que o fator mexe na resposta, já corrigida para 12 testes (Holm).`;
  const cap = 12, lh = 30, h = fat.length * lh + 46, x0 = 215, larg = W - x0 - 20, esc_ = v => x0 + Math.min(v, cap) / cap * larg;
  let s = `<svg viewBox="0 0 ${W} ${h}" role="img" aria-labelledby="cal-pareto-cap" class="svg">`;
  const lim = -Math.log10(0.05);
  s += `<line x1="${esc_(lim)}" x2="${esc_(lim)}" y1="8" y2="${h - 26}" stroke="var(--tinta-2)" stroke-dasharray="3 3"/><text x="${esc_(lim) + 4}" y="${h - 12}" class="ax">p = 0,05</text>`;
  [0, 4, 8, 12].forEach(v => s += `<text x="${esc_(v)}" y="${h - 12}" class="ax" text-anchor="middle">${v === 12 ? '≥12' : v}</text>`);
  fat.forEach((f, i) => { const y = 10 + i * lh;
    s += `<text x="${x0 - 8}" y="${y + 15}" class="rot" text-anchor="end">${esc(f.rotulo)}</text>`;
    s += `<rect x="${x0}" y="${y + 2}" width="${Math.max(1, esc_(f.ly) - x0)}" height="10" fill="var(--carimbo)"/><rect x="${x0}" y="${y + 14}" width="${Math.max(1, esc_(f.lp) - x0)}" height="10" fill="var(--tinta-2)"/>`; });
  s += `<rect x="${x0}" y="${h - 40}" width="10" height="8" fill="var(--carimbo)"/><text x="${x0 + 14}" y="${h - 33}" class="ax">erro silencioso</text><rect x="${x0 + 120}" y="${h - 40}" width="10" height="8" fill="var(--tinta-2)"/><text x="${x0 + 134}" y="${h - 33}" class="ax">pendências</text></svg>`;
  $('#cal-pareto').innerHTML = s;
  $('#cal-pareto-cap').textContent = `Evidência por fator, em −log10 do p ajustado (barra maior = efeito mais certo). ${T.resumo}`;
  $('#cal-alias').textContent = T.alias;

  // 2. nova regra
  $('#cal-regra-txt').textContent = C.regra.texto;
  $('#cal-confirma').innerHTML = `<caption class="sr">Confirmação de uma mudança por vez em 40 sementes</caption><thead><tr><th scope="col">Mudança, sozinha</th><th scope="col">Erros silenciosos por base</th><th scope="col">Pendências por base</th><th scope="col">F1</th></tr></thead><tbody>` +
    C.regra.confirma.map(r => `<tr><th scope="row">${esc(r.nome)}</th><td class="num">${n1(r.y1.base)} → <strong>${n1(r.y1.novo)}</strong></td><td class="num">${n1(r.pend.base)} → ${n1(r.pend.novo)}</td><td class="num">${n1(r.f1.base, 4)} → ${n1(r.f1.novo, 4)}</td></tr>`).join('') + '</tbody>';

  // 3. contorno da superfície (regra nova): erro silencioso previsto; região que fura o limite de pendências esmaecida
  const R = C.rsm; $('#cal-rsm-txt').textContent = R.texto;
  const g = R.contorno, nG = g.grade.length, cw = 380, ch = 300, ml = 64, mb = 44, cell = cw / nG, cellh = ch / nG;
  const vals = g.valores.flat().map(v => v[0]); const vmin = Math.min(...vals), vmax = Math.max(...vals);
  let c = `<svg viewBox="0 0 ${ml + cw + 140} ${ch + mb + 12}" role="img" aria-labelledby="cal-contorno-cap" class="svg">`;
  g.valores.forEach((linha, i) => linha.forEach((v, j) => { const t = (v[0] - vmin) / ((vmax - vmin) || 1); const fora = v[1] > R.lim_pend;
    c += `<rect x="${ml + i * cell}" y="${8 + (nG - 1 - j) * cellh}" width="${cell + 0.3}" height="${cellh + 0.3}" fill="var(--carimbo)" fill-opacity="${(0.08 + 0.8 * t).toFixed(3)}"/>` + (fora ? `<rect x="${ml + i * cell}" y="${8 + (nG - 1 - j) * cellh}" width="${cell + 0.3}" height="${cellh + 0.3}" fill="url(#hach)"/>` : ''); }));
  c += `<defs><pattern id="hach" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--tinta)" stroke-width="1.4" stroke-opacity=".55"/></pattern></defs>`;
  const px = u => ml + (u + 1) / 2 * cw, py = v => 8 + ch - (v + 1) / 2 * ch;
  (R.marcas || []).forEach(m => { c += `<circle cx="${px(m.x)}" cy="${py(m.y)}" r="6" fill="var(--papel)" stroke="var(--tinta)" stroke-width="2.5"/><text x="${px(m.x) + 9}" y="${py(m.y) + 4}" class="ax" font-weight="700">${esc(m.rot)}</text>`; });
  c += `<text x="${ml + cw / 2}" y="${ch + 40}" class="ax" text-anchor="middle">${esc(R.eixo_x)}</text><text x="14" y="${8 + ch / 2}" class="ax" text-anchor="middle" transform="rotate(-90 14 ${8 + ch / 2})">${esc(R.eixo_y)}</text>`;
  R.ticks_x.forEach(([u, t]) => c += `<text x="${px(u)}" y="${ch + 24}" class="ax" text-anchor="middle">${esc(t)}</text>`);
  R.ticks_y.forEach(([v, t]) => c += `<text x="${ml - 6}" y="${py(v) + 4}" class="ax" text-anchor="end">${esc(t)}</text>`);
  const lx = ml + cw + 16; c += `<text x="${lx}" y="22" class="ax">erro silencioso</text>`;
  for (let k = 0; k < 5; k++) { const t = k / 4; c += `<rect x="${lx}" y="${30 + k * 22}" width="16" height="16" fill="var(--carimbo)" fill-opacity="${(0.08 + 0.8 * t).toFixed(2)}"/><text x="${lx + 22}" y="${43 + k * 22}" class="ax">${n1(vmin + t * (vmax - vmin), 1)}</text>`; }
  c += `<rect x="${lx}" y="${150}" width="16" height="16" fill="url(#hach)" stroke="var(--linha)"/><text x="${lx + 22}" y="${163}" class="ax">fura o limite</text><text x="${lx + 22}" y="${177}" class="ax">de pendências</text></svg>`;
  $('#cal-contorno').innerHTML = c; $('#cal-contorno-cap').textContent = R.legenda;

  // 4. convergência
  const B = C.bo; $('#cal-bo-txt').textContent = B.texto;
  const cv = 260, mlc = 50, wc = W - mlc - 20, todos = B.series.flatMap(sr => sr.y.filter(v => v !== null));
  const ymn = Math.min(...todos) * 0.95, ymx = Math.max(...todos) * 1.05, nx = Math.max(...B.series.map(sr => sr.y.length));
  const X = i => mlc + i / (nx - 1) * wc, Y = v => 10 + (1 - (v - ymn) / (ymx - ymn)) * cv;
  let v = `<svg viewBox="0 0 ${W} ${cv + 56}" role="img" aria-labelledby="cal-conv-cap" class="svg">`;
  [ymn, (ymn + ymx) / 2, ymx].forEach(t => v += `<line x1="${mlc}" x2="${W - 20}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--linha)"/><text x="${mlc - 6}" y="${Y(t) + 4}" class="ax" text-anchor="end">${n1(t, 1)}</text>`);
  [1, 10, 20, 30, 40].forEach(t => { if (t <= nx) v += `<text x="${X(t - 1)}" y="${cv + 28}" class="ax" text-anchor="middle">${t}</text>`; });
  B.series.forEach(sr => { const pts = sr.y.map((y, i) => y === null ? null : `${X(i).toFixed(1)},${Y(y).toFixed(1)}`).filter(Boolean);
    v += `<polyline points="${pts.join(' ')}" fill="none" stroke="${sr.tipo === 'bo' ? 'var(--conferido)' : 'var(--tinta-2)'}" stroke-width="2.2" ${sr.tipo === 'bo' ? '' : 'stroke-dasharray="5 4"'}/>`; });
  v += `<text x="${mlc + wc / 2}" y="${cv + 48}" class="ax" text-anchor="middle">configurações avaliadas (cada uma em 20 bases)</text>`;
  v += `<line x1="${W - 230}" x2="${W - 205}" y1="22" y2="22" stroke="var(--conferido)" stroke-width="2.2"/><text x="${W - 200}" y="26" class="ax">otimizador bayesiano</text><line x1="${W - 230}" x2="${W - 205}" y1="40" y2="40" stroke="var(--tinta-2)" stroke-width="2.2" stroke-dasharray="5 4"/><text x="${W - 200}" y="44" class="ax">busca aleatória</text></svg>`;
  $('#cal-conv').innerHTML = v; $('#cal-conv-cap').textContent = B.legenda;

  // 5. blocos e teste pareado
  $('#cal-val-txt').textContent = C.validacao.texto;
  $('#cal-blocos').innerHTML = `<caption class="sr">Padrão contra a configuração escolhida em cada bloco de sementes</caption><thead><tr><th scope="col">Bloco</th><th scope="col">Bases</th><th scope="col">Erros silenciosos por base</th><th scope="col">Pendências por base</th><th scope="col">F1</th></tr></thead><tbody>` +
    C.blocos.map(b => `<tr><th scope="row">${esc(b.nome)}</th><td class="num">${b.n}</td><td class="num">${n1(b.y1[0])} → <strong>${n1(b.y1[1])}</strong>${b.y1_ic ? `<br><span class="mini fraco">IC 95% da diferença ${n1(b.y1_ic[0])} a ${n1(b.y1_ic[1])}</span>` : ''}</td><td class="num">${n1(b.pend[0])} → ${n1(b.pend[1])}</td><td class="num">${n1(b.f1[0], 4)} → ${n1(b.f1[1], 4)}</td></tr>`).join('') + '</tbody>';
  const P = C.pareado, n = P.dif.length, ph = 200, mlp = 46, wp = W - mlp - 16, bw = wp / n;
  const amp = Math.max(1, ...P.dif.map(Math.abs)), Yp = d => 10 + ph / 2 - d / amp * (ph / 2 - 6);
  let q = `<svg viewBox="0 0 ${W} ${ph + 40}" role="img" aria-labelledby="cal-pareado-cap" class="svg"><line x1="${mlp}" x2="${W - 16}" y1="${Yp(0)}" y2="${Yp(0)}" stroke="var(--tinta-2)"/>`;
  [-amp, 0, amp].forEach(t => q += `<text x="${mlp - 6}" y="${Yp(t) + 4}" class="ax" text-anchor="end">${t > 0 ? '+' : ''}${n1(t, 0)}</text>`);
  P.dif.slice().sort((a, b) => a - b).forEach((d, i) => { if (d) q += `<rect x="${mlp + i * bw + 0.5}" y="${Math.min(Yp(0), Yp(d))}" width="${Math.max(bw - 1, 0.8)}" height="${Math.abs(Yp(d) - Yp(0))}" fill="${d < 0 ? 'var(--conferido)' : 'var(--carimbo)'}"/>`; });
  q += `<text x="${mlp + wp / 2}" y="${ph + 34}" class="ax" text-anchor="middle">as ${n} bases do teste, ordenadas pela diferença</text></svg>`;
  $('#cal-pareado').innerHTML = q; $('#cal-pareado-cap').textContent = P.legenda;
  $('#cal-criterios').innerHTML = C.criterios.map(k => `<li class="${k.ok ? 'ok' : 'falha'}"><strong>${k.ok ? 'Passou' : 'Não passou'}:</strong> ${esc(k.texto)} <span class="fraco">${esc(k.detalhe)}</span></li>`).join('');
  $('#cal-decisao').textContent = C.decisao; $('#cal-limites').textContent = C.limites;
})();
