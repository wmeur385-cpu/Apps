# resumo.py — junta todos os resultados da calibração no JSON que a página embute
import json, numpy as np, pandas as pd
L = lambda p: json.load(open(p)); J = lambda p: [json.loads(l) for l in open(p)]
T = L('triagem_resultado.json'); R = L('rsm_resultado.json'); V = L('validacao_resultado.json'); E = L('escolhido.json')
te, es, ot = L('teste_estat.json'), L('estresse_estat.json'), L('otimismo_estat.json')
ROT = {'limiarMencaoNome': 'limiar de menção por nome', 'margem': 'margem sobre o 2º', 'sim': 'função de similaridade', 'removeRuido': 'tirar LTDA, Comércio', 'regras': 'nome incompleto, aprender e-mail', 'guardaFone': 'guarda na chave telefone', 'guardaDominio': 'guarda na chave domínio', 'guardaEnd': 'guarda na chave endereço', 'quaseIdentico': 'nome quase idêntico', 'grupo': 'matriz e filial', 'limiarContato': 'limiar de contato + nome', 'interação limiarMencaoNome×margem': 'interação menção × margem'}
py = {r['termo']: r for r in T['y1']['tabela']}; pp = {r['termo']: r for r in T['pendentes']['tabela']}
fat = [dict(nome=k, rotulo=ROT.get(k, k), ly=float(min(12, -np.log10(max(py[k]['p_holm'], 1e-12)))), lp=float(min(12, -np.log10(max(pp[k]['p_holm'], 1e-12)))), cy=py[k]['contrib_%'], cp=pp[k]['contrib_%']) for k in py]
m = T['medias']; sim, grp, qi = m['sim'], m['grupo'], m['quaseIdentico']
resumo = f"Dois fatores dominam o erro silencioso: a função de similaridade ({sim['y1'][1]:.1f} erros por base com Jaro-Winkler contra {sim['y1'][0]:.1f} com a padrão) e o tratamento de matriz e filial ({grp['y1'][0]:.1f} na regra atual, {grp['y1'][1]:.1f} na regra que exige evidência que separe as unidades). Os limiares respondem por menos de 4% da variação cada."
alias = f"Um alerta de triagem. O limiar de nome quase idêntico pareceu importante (de {qi['y1'][0]:.1f} para {qi['y1'][2]:.1f} erros entre os níveis). Testado sozinho em 40 bases novas, com a similaridade padrão, não mudou nada: zero diferença. O efeito na matriz vinha da combinação com Jaro-Winkler, confundida com o efeito principal, que é o risco conhecido de uma matriz de resolução III. A confirmação um fator por vez pegou."
# confirmação
c = pd.DataFrame(J('confirma.jsonl')); b = c[c.cfg == 'base'].set_index('semente')
def conf(cfg, nome):
    x = c[c.cfg == cfg].set_index('semente'); return dict(nome=nome, y1=dict(base=b.y1.mean(), novo=x.y1.mean()), pend=dict(base=b.pendentes.mean(), novo=x.pendentes.mean()), f1=dict(base=b.f1.mean(), novo=x.f1.mean()))
confirma = [conf('exclusiva', 'suspender ligação dentro do grupo quando nada separa as unidades'), conf('aprende', 'e-mail só decide se nunca assinou por outra unidade do grupo (regra nova)'), conf('ld', 'desligar o aprendizado de e-mails'), conf('h092', 'nome quase idêntico de 0,86 para 0,92')]
regra_txt = ("A regra bruta, que suspende qualquer ligação dentro de um grupo matriz e filial quando nada na mensagem separa as unidades, cortou 82% dos erros silenciosos e mais que dobrou as pendências. O diagnóstico em 20 bases de ajuste mostrou que, das 674 ligações que ela suspendia, 589 estavam certas. "
  "Então a regra ficou mais fina: antes de ligar, a camada olha todas as mensagens de cada e-mail do grupo; se as que têm nome decisivo apontam para unidades diferentes, o e-mail é compartilhado e não decide sozinho. Mesmo corte de erros, um quinto do custo em pendências. Isso é o que Taguchi chamava de projeto do sistema: a matriz apontou o lugar, a mudança foi de regra, não de número.")
# RSM
A = R['aprende']; F = R['fatores']; ax = A['contorno']['eixos']; nomes = [f[0] for f in F]
dec = lambda i, u: F[i][1] + (u + 1) / 2 * (F[i][2] - F[i][1])
tx = [[u, f"{dec(ax[0], u):.2f}"] for u in [-1, -0.5, 0, 0.5, 1]]; ty = [[u, f"{dec(ax[1], u):.2f}"] for u in [-1, -0.5, 0, 0.5, 1]]
cod = lambda i, v: -1 + 2 * (v - F[i][1]) / (F[i][2] - F[i][1])
marcas = [dict(x=0, y=0, rot='limiares padrão'), dict(x=cod(ax[0], E[nomes[ax[0]]]), y=cod(ax[1], E[nomes[ax[1]]]), rot='escolhida')]
ev = A['canonica']['autovalores']
rsm_txt = (f"Composto central face-centrado em quatro limiares (margem, limiar de contato, limiar de menção por nome e guarda de telefone), 28 pontos, cada um nas mesmas 20 bases: 1.120 avaliações nos dois braços (regra atual e regra nova). "
  f"Com a regra atual, o melhor ponto que respeita o limite de pendências ganha {100 * (1 - R['atual']['otimo_restrito']['y1'] / R['atual']['centro']['y1']):.0f}% sobre o centro: platô. Com a regra nova, a superfície é {A['canonica']['tipo']} (autovalores {', '.join(f'{v:+.3f}' for v in ev)}): só o limiar de contato tem gradiente, e a margem conta pouco. O ponto de interesse é a fronteira onde as pendências encostam no teto, não um ótimo interior.")
legenda_c = f"Erro silencioso previsto pela superfície da regra nova no plano {ROT[nomes[ax[0]]]} × {ROT[nomes[ax[1]]]}, os outros dois limiares fixos no ótimo restrito. A área hachurada fura o limite de pendências (≤ 1,10 × padrão)."
# BO
series = []
for s in [1, 2, 3]:
    for arq, tipo in [(f'bo_aprende_{s}.json', 'bo'), (f'rs_aprende_{s}.json', 'rs')]:
        d = L(arq); best = None; y = []
        for o in d['obs']:
            if o['pend'][0] <= d['LIM_PEND'] and o['f1'][0] >= d['LIM_F1'] and (best is None or o['y1'][0] < best): best = o['y1'][0]
            y.append(best)
        series.append(dict(tipo=tipo, y=y))
bo1 = L('bo_aprende_1.json'); ell = bo1['hist'][-1]['ell']
bo_txt = (f"Processo gaussiano Matérn 5/2 escrito em JavaScript puro, com ruído por ponto (erro-padrão da média nas 20 bases), hiperparâmetros por verossimilhança marginal, e aquisição por melhoria esperada sobre a melhor média posterior viável, multiplicada pela probabilidade de respeitar as restrições. Três execuções de 40 configurações (10 aquecidas pela RSM, 30 escolhidas), contra três buscas aleatórias com o mesmo orçamento. "
  f"Os comprimentos de escala finais contam a história sozinhos: {', '.join(f'{ROT[n]} {e}' for n, e in zip(nomes, ell))}. Comprimento 2 é o teto, ou seja, o parâmetro não importa; só o limiar de contato ficou curto. As três execuções convergiram para o mesmo lugar: limiar de contato no piso da faixa, onde as pendências encostam no teto.")
rs_viaveis = [sum(1 for o in L(f'rs_aprende_{s}.json')['obs'] if o['pend'][0] <= L(f'rs_aprende_{s}.json')['LIM_PEND'] and o['f1'][0] >= L(f'rs_aprende_{s}.json')['LIM_F1']) for s in [1, 2, 3]]
legenda_v = f"Melhor erro silencioso observado entre as configurações viáveis, conforme as avaliações acumulam. Verde: otimizador bayesiano, três execuções. A busca aleatória não aparece porque, em 40 configurações por execução, encontrou {', '.join(map(str, rs_viaveis))} configurações viáveis: a região que respeita o teto de pendências é uma faixa estreita, e sortear não a encontra."
# blocos
rsm_lin = J('rsm.jsonl'); ba = [l for l in rsm_lin if l['braco'] == 'atual' and l['ponto'] == 24]
esc_obs = next(o for o in bo1['obs'] if o['params'] == E)
bl = lambda nome, n, st, ic=True: dict(nome=nome, n=n, y1=[st['y1']['base'], st['y1']['novo']], y1_ic=st['y1']['ic'] if ic else None, pend=[st['pendentes']['base'], st['pendentes']['novo']], f1=[st['f1']['base'], st['f1']['novo']])
blocos = [dict(nome='ajuste (sementes do otimizador)', n=20, y1=[np.mean([l['y1'] for l in ba]), esc_obs['y1'][0]], y1_ic=None, pend=[np.mean([l['pendentes'] for l in ba]), esc_obs['pend'][0]], f1=[np.mean([l['f1'] for l in ba]), esc_obs['f1'][0]]),
  bl('ajuste, bloco disjunto (otimismo)', 40, ot), dict(nome='validação', n=50, y1=[V['base']['y1'], V['escolhido']['y1']], y1_ic=None, pend=[V['base']['pend'], V['escolhido']['pend']], f1=[V['base']['f1'], V['escolhido']['f1']]),
  bl('teste, uma execução', 100, te), bl('estresse: bagunça 2× a 4×', 100, es)]
bench = pd.DataFrame(J('benchteste.jsonl')); b0, b1 = bench[bench.cfg == 0], bench[bench.cfg == 1]
val_txt = (f"Quatro finalistas na validação (50 bases novas): o ótimo da RSM e duas das três execuções do otimizador furaram o teto de pendências; a terceira passou e foi a escolhida, sem olhar o teste. "
  f"No teste, 100 bases que nenhuma etapa tinha tocado, rodadas uma vez: erro silencioso de {te['y1']['base']:.1f} para {te['y1']['novo']:.1f} por base, razão {te['y1']['razao']:.2f} (IC 95% {te['y1']['razao_ic'][0]:.2f} a {te['y1']['razao_ic'][1]:.2f}), melhor em {te['y1']['melhor']} bases, pior em {te['y1']['pior']}. Cadastros juntados errado: {te['cadastros_errados']['base']:.1f} para {te['cadastros_errados']['novo']:.2f}. F1 subiu {te['f1']['dif']:.4f}. "
  f"Pendências: {te['pendentes']['base']:.1f} para {te['pendentes']['novo']:.1f}, razão {te['pendentes']['razao']:.3f} (IC {te['pendentes']['razao_ic'][0]:.3f} a {te['pendentes']['razao_ic'][1]:.3f}). Benchmark em 20 bases do teste: evidência completa {100*b0.evidencia.mean():.1f}% → {100*b1.evidencia.mean():.1f}%, tokens {b0.tokens.median():.0f} → {b1.tokens.median():.0f}, ambíguas respondidas errado sem aviso {int(b0.amb_errou_sem_aviso.sum())} → {int(b1.amb_errou_sem_aviso.sum())}.")
pareado = dict(dif=[x[2] - x[1] for x in te['y1']['por_semente']], legenda=f"Diferença de erros silenciosos por base no teste (nova − padrão). Barras para baixo são bases em que a configuração nova errou menos. Efeito mínimo detectável com 100 bases: {te['mde_y1']:.1f} erros por base.")
crit = [dict(texto='Erro silencioso: redução média ≥ 20%, IC 95% da diferença sem o zero, Wilcoxon p < 0,05.', ok=bool(te['y1']['razao'] <= 0.8 and te['y1']['ic'][1] < 0 and te['y1']['p'] < 0.05), detalhe=f"redução de {100*(1-te['y1']['razao']):.0f}%, IC da diferença {te['y1']['ic'][0]:.1f} a {te['y1']['ic'][1]:.1f}, p = {te['y1']['p']:.0e}."),
  dict(texto='F1 não cai mais de 0,002.', ok=bool(te['f1']['ic'][0] >= -0.002), detalhe=f"subiu {te['f1']['dif']:+.4f} (IC {te['f1']['ic'][0]:+.4f} a {te['f1']['ic'][1]:+.4f})."),
  dict(texto='Pendências: limite superior do IC 95% da razão abaixo de 1,10.', ok=bool(te['pendentes']['razao_ic'][1] < 1.10), detalhe=f"razão {te['pendentes']['razao']:.3f}, IC {te['pendentes']['razao_ic'][0]:.3f} a {te['pendentes']['razao_ic'][1]:.3f}."),
  dict(texto='Benchmark: evidência completa não cai mais de 1 ponto, tokens não sobem mais de 5%, ambíguas erradas sem aviso não aumentam.', ok=bool(b1.evidencia.mean() >= b0.evidencia.mean() - 0.01 and b1.tokens.median() <= 1.05 * b0.tokens.median() and b1.amb_errou_sem_aviso.sum() <= b0.amb_errou_sem_aviso.sum()), detalhe=f"{100*b0.evidencia.mean():.1f}% → {100*b1.evidencia.mean():.1f}%; {b0.tokens.median():.0f} → {b1.tokens.median():.0f} tokens; {int(b0.amb_errou_sem_aviso.sum())} → {int(b1.amb_errou_sem_aviso.sum())}."),
  dict(texto='Estresse: a diferença de erros silenciosos não inverte de sinal.', ok=bool(es['y1']['dif'] < 0), detalhe=f"{es['y1']['base']:.1f} → {es['y1']['novo']:.1f} por base com bagunça 2× a 4×; pendências {es['pendentes']['base']:.1f} → {es['pendentes']['novo']:.1f}.")]
aceito = all(k['ok'] for k in crit)
decisao = ("A configuração nova foi adotada como padrão." if aceito else
  f"Não adotada como padrão. Ela corta {100*(1-te['y1']['razao']):.0f}% dos erros silenciosos, mas as pendências ficaram {100*(te['pendentes']['razao']-1):.1f}% acima do padrão, com o IC chegando a {100*(te['pendentes']['razao_ic'][1]-1):.1f}%, e o teto escrito antes era 10%. O critério não foi afrouxado depois de ver o número. A regra nova fica disponível como opção (grupo: 'aprende', margem 0,04, limiar de contato 0,50), com o preço medido: cerca de 3 pendências a mais por base para cerca de 11 erros silenciosos a menos. Escolher entre erro silencioso e pendência é decisão de quem opera, não de quem calibra.")
limites = ("Limites desta calibração: dados sintéticos do mesmo gerador; a regra nova foi desenhada depois de olhar bases de ajuste e os erros das sementes 101–110, por isso o teste usou sementes intocadas; a L27 é de resolução III, e um dos seus efeitos se revelou confundido; o DSD de conferência e um gerador independente não foram rodados; o otimizador rodou só no braço da regra nova; três execuções não são uma distribuição.")
out = dict(hash=open('preregistro.sha256').read().split()[0][:16] + '…', sementes=[['desenvolvimento', '20261002', 'ilustração; contaminada'], ['ex-fora-da-amostra', '101–110', 'já vistas; motivaram o fator de grupo'], ['ajuste', '1001–1100', 'triagem, RSM, otimizador, confirmação, otimismo'], ['validação', '2001–2050', 'escolha entre finalistas'], ['teste', '9001–9100', 'uma execução, padrão × escolhida'], ['estresse', '9501–9600', 'bagunça 2× a 4×, uma execução']],
  triagem=dict(n=432, dispersao=T['y1']['dispersao'], fatores=fat, resumo=resumo, alias=alias), regra=dict(texto=regra_txt, confirma=confirma),
  rsm=dict(texto=rsm_txt, contorno=A['contorno'], lim_pend=R['LIM_PEND'], eixo_x=ROT[nomes[ax[0]]], eixo_y=ROT[nomes[ax[1]]], ticks_x=tx, ticks_y=ty, marcas=marcas, legenda=legenda_c),
  bo=dict(texto=bo_txt, series=series, legenda=legenda_v), validacao=dict(texto=val_txt), blocos=blocos, pareado=pareado, criterios=crit, decisao=decisao, limites=limites, escolhido=E, aceito=aceito)
import re
def pt(o):  # decimais com vírgula nos textos
    if isinstance(o, str): return re.sub(r'(\d)\.(\d)', r'\1,\2', o)
    if isinstance(o, list): return [pt(x) for x in o]
    if isinstance(o, dict): return {k: (v if k in ('hash', 'escolhido', 'contorno', 'params') else pt(v)) for k, v in o.items()}
    return o
json.dump(pt(out), open('calib_pagina.json', 'w'), default=float); print('aceito:', aceito); print(decisao[:300])
