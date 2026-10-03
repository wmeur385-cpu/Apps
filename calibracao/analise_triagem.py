# analise_triagem.py — GLM quase-Poisson com bloco de semente, testes por termo com Holm, contribuição, médias por nível,
# razão S/N (secundária), resposta dual (média × variância) e interações controle × ruído.
import json, numpy as np, pandas as pd, statsmodels.api as sm, statsmodels.formula.api as smf
from statsmodels.stats.multitest import multipletests
D = json.load(open('triagem_desenho.json')); rows = [json.loads(l) for l in open('triagem.jsonl')]
df = pd.DataFrame(rows); base = df[df.interna == 'base'].copy(); df = df[df.interna != 'base'].copy()
cols27 = [tuple(c) for c in D['cols27']]
FAT = [(n, cols27.index(tuple(v)), niv) for n, v, niv in D['FATORES']]
VAZ = [cols27.index(tuple(v)) for v in D['VAZIAS']]
for n, c, niv in FAT: df[n] = df.niveis.apply(lambda l: l[c])
df['jxl_a'] = df.niveis.apply(lambda l: l[VAZ[0]]); df['jxl_b'] = df.niveis.apply(lambda l: l[VAZ[1]])
for k in ['typo', 'dup', 'generico', 'grupos', 'homonimos']: df['N_' + k] = df.ruido.apply(lambda r: 1 if r[k] > 1 else 0)
df['bloco'] = df.semente.astype(str); df['logm'] = np.log(df.mencoes)
nomes = [n for n, _, _ in FAT]
termos = ' + '.join(f'C({n})' for n in nomes)
def glm(resp, formula_extra='', fam=sm.families.Poisson(), offset=True, dados=df):
    f = f'{resp} ~ {termos} + C(jxl_a) + C(jxl_b) + C(bloco){formula_extra}'
    return smf.glm(f, data=dados, family=fam, offset=dados.logm if offset else None).fit(scale='X2')
def testes(resp, fam=sm.families.Poisson(), offset=True):
    cheio = glm(resp, fam=fam, offset=offset); phi = cheio.scale; out = []
    grupos = [(n, f'C({n})') for n in nomes] + [('interação limiarMencaoNome×margem', 'C(jxl_a) + C(jxl_b)')]
    for nome, t in grupos:
        f = f'{resp} ~ ' + ' + '.join([f'C({n})' for n in nomes if f'C({n})' not in t] + ([] if 'jxl' in t else ['C(jxl_a)', 'C(jxl_b)']) + ['C(bloco)'])
        red = smf.glm(f, data=df, family=fam, offset=df.logm if offset else None).fit(scale='X2')
        gl = red.df_resid - cheio.df_resid; F = (red.deviance - cheio.deviance) / gl / phi
        from scipy.stats import f as fd
        out.append(dict(termo=nome, gl=int(gl), dDev=float(red.deviance - cheio.deviance), F=float(F), p=float(fd.sf(F, gl, cheio.df_resid))))
    t = pd.DataFrame(out); t['p_holm'] = multipletests(t.p, method='holm')[1]
    tot = t.dDev.sum(); t['contrib_%'] = 100 * np.maximum(t.dDev - t.gl * phi, 0) / tot
    return t, phi, cheio
res = {}
for resp, off in [('y1', True), ('pendentes', True)]:
    t, phi, m = testes(resp, offset=off); res[resp] = dict(tabela=t.to_dict('records'), dispersao=float(phi))
    print(f'\n== {resp}  (dispersão quase-Poisson φ = {phi:.2f})'); print(t.round(4).to_string(index=False))
# F1: log(1 - F1) por mínimos quadrados com bloco
df['l1f1'] = np.log(1 - df.f1)
f = f'l1f1 ~ {termos} + C(jxl_a) + C(jxl_b) + C(bloco)'; m = smf.ols(f, data=df).fit()
an = sm.stats.anova_lm(m, typ=2); an = an[an.index.str.startswith('C(') & ~an.index.str.contains('bloco')]
an['p_holm'] = multipletests(an['PR(>F)'], method='holm')[1]; an['contrib_%'] = 100 * an.sum_sq / an.sum_sq.sum()
print('\n== log(1−F1)'); print(an.round(4).to_string())
res['f1'] = dict(tabela=[dict(termo=i, F=float(r.F), p=float(r['PR(>F)']), p_holm=float(r.p_holm), contrib=float(r['contrib_%'])) for i, r in an.iterrows()])
# médias por nível (respostas brutas)
med = {}
for n, c, niv in FAT:
    g = df.groupby(n).agg(y1=('y1', 'mean'), y1_ep=('y1', 'sem'), pend=('pendentes', 'mean'), pend_ep=('pendentes', 'sem'), f1=('f1', 'mean'), cad=('cadastros_errados', 'mean'), men=('mencoes_erradas', 'mean'))
    med[n] = dict(niveis=[str(x) for x in niv], **{k: g[k].round(4).tolist() for k in g.columns})
res['medias'] = med
res['baseline'] = dict(y1=float(base.y1.mean()), pend=float(base.pendentes.mean()), f1=float(base.f1.mean()), n=len(base))
print('\nbaseline (padrão, mesmas 16 células):', res['baseline'])
print('\nmédias por nível (y1 / pendentes / f1):')
for n in nomes: print(f'  {n:18s}', med[n]['niveis'], ' y1', med[n]['y1'], ' pend', med[n]['pend'], ' f1', [round(x, 4) for x in med[n]['f1']])
# razão S/N menor-é-melhor (secundária), por linha interna
lin = df.groupby('interna').agg(**{n: (n, 'first') for n in nomes}, sn=('y1', lambda y: -10 * np.log10(np.mean(np.square(y)) + 1e-9)), media=('y1', 'mean'), lvar=('y1', lambda y: np.log(np.var(y, ddof=1) + 0.25)))
sn = {}
for n in nomes: sn[n] = lin.groupby(n).sn.mean().round(3).tolist()
res['sn'] = sn
for alvo in ['sn', 'lvar']:
    m2 = smf.ols(f'{alvo} ~ ' + termos, data=lin).fit(); a2 = sm.stats.anova_lm(m2, typ=2); a2 = a2.drop('Residual')
    res['dual_' + alvo] = {i: dict(F=float(r.F), p=float(r['PR(>F)'])) for i, r in a2.iterrows()}
    print(f'\n== {alvo} por linha da L27 (27 linhas, {int(m2.df_resid)} gl de erro):'); print(a2[['F', 'PR(>F)']].round(3).to_string())
# interações controle × ruído para os termos que passaram em Y1
sig = [r['termo'] for r in res['y1']['tabela'] if r['p_holm'] < 0.05 and r['termo'] in nomes]
inter = {}
for n in sig:
    for k in ['typo', 'dup', 'generico', 'grupos', 'homonimos']:
        f0 = f'y1 ~ {termos} + C(jxl_a) + C(jxl_b) + C(bloco)'; f1 = f0 + f' + C({n}):N_{k}'
        a = smf.glm(f0, data=df, family=sm.families.Poisson(), offset=df.logm).fit(scale='X2'); b = smf.glm(f1, data=df, family=sm.families.Poisson(), offset=df.logm).fit(scale='X2')
        gl = a.df_resid - b.df_resid
        from scipy.stats import f as fd
        F = (a.deviance - b.deviance) / gl / b.scale; inter[f'{n}×{k}'] = dict(F=float(F), p=float(fd.sf(F, gl, b.df_resid)))
    print(f'\ncontrole×ruído para {n}:', {k: round(v["p"], 4) for k, v in inter.items() if k.startswith(n)})
res['controle_ruido'] = inter
# efeito do ruído no baseline (quanto a bagunça mexe em Y1)
res['efeito_ruido_base'] = {k: [float(base[base.ruido.apply(lambda r: r[k] < 1)].y1.mean()), float(base[base.ruido.apply(lambda r: r[k] > 1)].y1.mean())] for k in ['typo', 'dup', 'generico', 'grupos', 'homonimos']}
print('\nbaseline: Y1 médio com ruído baixo × alto:', {k: [round(a, 2), round(b, 2)] for k, (a, b) in res['efeito_ruido_base'].items()})
json.dump(res, open('triagem_resultado.json', 'w'), indent=1, default=float)
