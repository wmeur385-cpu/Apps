# analise_rsm.py — composto central face-centrado: modelo de 2ª ordem (GLM para contagens, MQO para log(1−F1)) com bloco de semente,
# falta de ajuste contra o modelo saturado, análise canônica, cumeeira, ótimo restrito e desejabilidade.
import json, itertools, numpy as np, pandas as pd, statsmodels.api as sm, statsmodels.formula.api as smf, warnings
from scipy.stats import f as fd
from scipy.optimize import brentq
warnings.filterwarnings('ignore')
D = json.load(open('rsm_desenho.json')); F = D['F']; NOM = [f[0] for f in F]
df = pd.DataFrame([json.loads(l) for l in open('rsm.jsonl')]); df = df[df.ponto < 25].copy()
for i, n in enumerate(NOM): df[f'x{i+1}'] = df.x.apply(lambda v: v[i])
df['bloco'] = df.semente.astype(str); df['logm'] = np.log(df.mencoes); df['l1f1'] = np.log(1 - df.f1)
X = ['x1', 'x2', 'x3', 'x4']
QUAD = ' + '.join(X + [f'I({a}**2)' for a in X] + [f'{a}:{b}' for a, b in itertools.combinations(X, 2)])
base = df[(df.braco == 'atual') & (df.ponto == 24)]; BASE = dict(y1=base.y1.mean(), pend=base.pendentes.mean(), f1=base.f1.mean())
LIM_PEND, LIM_F1 = 1.10 * BASE['pend'], BASE['f1'] - 0.002
def ajusta(d, resp, glm=True):
    if glm:
        q = smf.glm(f'{resp} ~ {QUAD} + C(bloco)', data=d, family=sm.families.Poisson(), offset=d.logm).fit(scale='X2')
        s = smf.glm(f'{resp} ~ C(ponto) + C(bloco)', data=d, family=sm.families.Poisson(), offset=d.logm).fit(scale='X2')
        gl = q.df_resid - s.df_resid; Fv = (q.deviance - s.deviance) / gl / s.scale
    else:
        q = smf.ols(f'{resp} ~ {QUAD} + C(bloco)', data=d).fit(); s = smf.ols(f'{resp} ~ C(ponto) + C(bloco)', data=d).fit()
        gl = q.df_resid - s.df_resid; Fv = ((q.ssr - s.ssr) / gl) / (s.ssr / s.df_resid)
    return q, dict(F=float(Fv), gl=int(gl), p=float(fd.sf(Fv, gl, s.df_resid)))
def bB(m):
    b = np.array([m.params[a] for a in X]); B = np.zeros((4, 4))
    for i, a in enumerate(X): B[i, i] = m.params[f'I({a} ** 2)']
    for (i, a), (j, c) in itertools.combinations(list(enumerate(X)), 2): B[i, j] = B[j, i] = m.params[f'{a}:{c}'] / 2
    return b, B
def eta(b, B, x): return x @ b + np.einsum('...i,ij,...j->...', x, B, x)
out = {'BASE': BASE, 'LIM_PEND': LIM_PEND, 'LIM_F1': LIM_F1, 'fatores': F}
grade = np.array(list(itertools.product(np.linspace(-1, 1, 11), repeat=4)))
for braco in ['atual', 'aprende']:
    d = df[df.braco == braco]; c0 = d[d.ponto == 24]; R = {}
    my, lofy = ajusta(d, 'y1'); mp, lofp = ajusta(d, 'pendentes'); mf, loff = ajusta(d, 'l1f1', glm=False)
    by, By = bB(my); bp, Bp = bB(mp); bf, Bf = bB(mf)
    ev, evec = np.linalg.eigh(By); xs = -0.5 * np.linalg.solve(By, by)
    tipo = 'mínimo' if (ev > 0).all() else ('máximo' if (ev < 0).all() else 'sela')
    if (np.abs(ev) < 0.1 * np.abs(ev).max()).any(): tipo += ' com cumeeira (autovalor ≈ 0)'
    # cumeeira: mínimo de Y1 na esfera de raio r (minimização: μ < menor autovalor)
    cume = []
    for r in [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0]:
        g = lambda mu: np.linalg.norm(-0.5 * np.linalg.solve(By - mu * np.eye(4), by)) - r
        try: mu = brentq(g, ev.min() - 1e4, ev.min() - 1e-9); xr = -0.5 * np.linalg.solve(By - mu * np.eye(4), by); cume.append(dict(r=r, x=xr.tolist(), y1=float(c0.y1.mean() * np.exp(eta(by, By, xr)))))
        except Exception as e: pass
    # previsões na grade (relativas ao centro observado do braço)
    Y = c0.y1.mean() * np.exp(eta(by, By, grade)); Pn = c0.pendentes.mean() * np.exp(eta(bp, Bp, grade)); F1 = 1 - (1 - c0.f1.mean()) * np.exp(eta(bf, Bf, grade))
    ok = (Pn <= LIM_PEND) & (F1 >= LIM_F1)
    if ok.any(): i = np.where(ok)[0][np.argmin(Y[ok])]; R['otimo_restrito'] = dict(x=grade[i].tolist(), y1=float(Y[i]), pend=float(Pn[i]), f1=float(F1[i]))
    else: R['otimo_restrito'] = None
    # desejabilidade de Derringer-Suich (secundária)
    dy = np.clip(1 - Y / (1.5 * BASE['y1']), 0, 1); dp = np.clip((1.3 * BASE['pend'] - Pn) / (0.3 * BASE['pend']), 0, 1); dfv = np.clip((F1 - (BASE['f1'] - 0.003)) / 0.006, 0, 1)
    Dd = (dy ** 3 * dp * dfv) ** (1 / 5); j = int(np.argmax(Dd)); R['desejabilidade'] = dict(x=grade[j].tolist(), D=float(Dd[j]), y1=float(Y[j]), pend=float(Pn[j]), f1=float(F1[j]))
    # fronteira de Pareto Y1 × pendentes na grade (F1 dentro do limite)
    pts = sorted([(float(Pn[k]), float(Y[k]), grade[k].tolist()) for k in range(len(grade)) if F1[k] >= LIM_F1]); fr = []; mn = 1e9
    for p, y, x in pts:
        if y < mn - 1e-9: fr.append(dict(pend=p, y1=y, x=x)); mn = y
    # contorno: os dois fatores com maior efeito em Y1, demais no ótimo restrito (ou centro)
    imp = np.abs(by) + np.abs(np.diag(By)); a, b2 = [int(k) for k in np.argsort(-imp)[:2]]
    fixo = np.array(R['otimo_restrito']['x'] if R['otimo_restrito'] else [0, 0, 0, 0]); gl1 = np.linspace(-1, 1, 41)
    cont = []
    for u in gl1:
        linha = []
        for v in gl1:
            x = fixo.copy(); x[a] = u; x[b2] = v
            linha.append([float(c0.y1.mean() * np.exp(eta(by, By, x))), float(c0.pendentes.mean() * np.exp(eta(bp, Bp, x)))])
        cont.append(linha)
    R.update(dict(centro=dict(y1=float(c0.y1.mean()), pend=float(c0.pendentes.mean()), f1=float(c0.f1.mean())),
        falta_ajuste=dict(y1=lofy, pend=lofp, f1=loff), coef_y1=dict(b=by.tolist(), B=By.tolist()), coef_pend=dict(b=bp.tolist(), B=Bp.tolist()),
        canonica=dict(autovalores=ev.tolist(), ponto_estacionario=xs.tolist(), tipo=tipo, dentro_da_regiao=bool((np.abs(xs) <= 1).all())),
        cumeeira=cume, pareto=fr, contorno=dict(eixos=[a, b2], grade=gl1.tolist(), fixo=fixo.tolist(), valores=cont), dispersao=dict(y1=float(my.scale), pend=float(mp.scale)),
        pvals_y1={k: float(v) for k, v in my.pvalues.items() if not k.startswith('C(')}))
    out[braco] = R
    print(f'\n===== braço {braco}: centro Y1 {c0.y1.mean():.2f}  pend {c0.pendentes.mean():.2f}  F1 {c0.f1.mean():.4f}')
    print('  coef. lineares Y1 (log):', np.round(by, 3), ' quadráticos:', np.round(np.diag(By), 3))
    print('  p-valores Y1:', {k: round(v, 4) for k, v in R['pvals_y1'].items() if k != 'Intercept'})
    print('  falta de ajuste:', {k: (round(v['F'], 2), v['gl'], round(v['p'], 4)) for k, v in R['falta_ajuste'].items()})
    print('  canônica:', tipo, ' autovalores', np.round(ev, 3), ' ponto estacionário', np.round(xs, 2))
    print('  cumeeira:', [(c['r'], round(c['y1'], 2)) for c in cume])
    print('  ótimo restrito:', R['otimo_restrito']); print('  desejabilidade:', {k: (round(v, 3) if isinstance(v, float) else v) for k, v in R['desejabilidade'].items()})
    print('  fronteira (pend, y1):', [(round(p['pend'], 1), round(p['y1'], 2)) for p in fr][:12])
print('\nlimites: pend ≤', round(LIM_PEND, 2), ' F1 ≥', round(LIM_F1, 4), ' base', {k: round(v, 4) for k, v in BASE.items()})
json.dump(out, open('rsm_resultado.json', 'w'), default=float)
