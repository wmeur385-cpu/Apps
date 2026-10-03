import json, numpy as np, pandas as pd, statsmodels.api as sm, statsmodels.formula.api as smf, warnings; warnings.filterwarnings('ignore')
exec(open('analise_triagem.py').read().split("res = {}")[0])  # reaproveita a preparação dos dados
out = {}
for resp in ['y1', 'pendentes']:
    m = glm(resp)
    for termo, a, b in [('regras', 'll', 'ld'), ('grupo', 'atual', 'exclusiva'), ('grupo', 'atual', 'pendente')]:
        niv = [x for n, _, x in FAT if n == termo][0]; ia, ib = niv.index(a), niv.index(b)
        # coeficientes de tratamento relativos ao nível 0
        ca = 0 if ia == 0 else m.params[f'C({termo})[T.{ia}]']; cb = 0 if ib == 0 else m.params[f'C({termo})[T.{ib}]']
        cov = m.cov_params(); va = 0 if ia == 0 else cov.loc[f'C({termo})[T.{ia}]', f'C({termo})[T.{ia}]']; vb = 0 if ib == 0 else cov.loc[f'C({termo})[T.{ib}]', f'C({termo})[T.{ib}]']
        cab = 0 if (ia == 0 or ib == 0) else cov.loc[f'C({termo})[T.{ia}]', f'C({termo})[T.{ib}]']
        d = cb - ca; se = np.sqrt(va + vb - 2 * cab); r = np.exp(d); lo, hi = np.exp(d - 1.96 * se), np.exp(d + 1.96 * se)
        from scipy.stats import norm; p = 2 * norm.sf(abs(d / se))
        out[f'{resp}:{termo}:{b}/{a}'] = dict(razao=float(r), ic=[float(lo), float(hi)], p=float(p))
        print(f'{resp:10s} {termo}: {b} ÷ {a} = {r:.3f}  IC95% [{lo:.3f}, {hi:.3f}]  p={p:.4f}')
json.dump(out, open('triagem_contrastes.json', 'w'), indent=1)
