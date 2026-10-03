# testes_estat.py <arquivo.jsonl> <rótulo> — comparação pareada por semente: baseline (cfg 0) × escolhida (cfg 1)
import json, sys, numpy as np, pandas as pd
from scipy.stats import wilcoxon
from statsmodels.stats.multitest import multipletests
def compara(path, rot, B=10000, seed=7):
    d = pd.DataFrame([json.loads(l) for l in open(path)]); b = d[d.cfg == 0].set_index('semente').sort_index(); x = d[d.cfg == 1].set_index('semente').sort_index()
    rng = np.random.default_rng(seed); n = len(b); idx = rng.integers(0, n, size=(B, n)); out = {'n': n, 'rotulo': rot}
    for m in ['y1', 'mencoes_erradas', 'cadastros_errados', 'pendentes', 'f1', 'exatas']:
        dif = (x[m] - b[m]).values; bs = dif[idx].mean(1); rel = x[m].values[idx].mean(1) / np.maximum(b[m].values[idx].mean(1), 1e-12)
        p = float(wilcoxon(dif).pvalue) if (dif != 0).any() else 1.0
        out[m] = dict(base=float(b[m].mean()), novo=float(x[m].mean()), dif=float(dif.mean()), ic=[float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))],
                      razao=float(x[m].mean() / b[m].mean()) if b[m].mean() else None, razao_ic=[float(np.percentile(rel, 2.5)), float(np.percentile(rel, 97.5))], p=p,
                      melhor=int((dif < 0).sum() if m not in ('f1', 'exatas') else (dif > 0).sum()), empate=int((dif == 0).sum()), pior=int((dif > 0).sum() if m not in ('f1', 'exatas') else (dif < 0).sum()),
                      por_semente=[[int(s), float(b.loc[s, m]), float(x.loc[s, m])] for s in b.index])
    sec = ['mencoes_erradas', 'cadastros_errados', 'pendentes', 'f1', 'exatas']; ph = multipletests([out[m]['p'] for m in sec], method='holm')[1]
    for m, p in zip(sec, ph): out[m]['p_holm'] = float(p)
    # efeito mínimo detectável aproximado (80% de poder, α=0,05 bilateral) para Y1
    sd = float(np.std((x.y1 - b.y1).values, ddof=1)); out['mde_y1'] = 2.8 * sd / np.sqrt(n)
    return out
if __name__ == '__main__':
    r = compara(sys.argv[1], sys.argv[2]); print(json.dumps({k: (v if not isinstance(v, dict) else {kk: vv for kk, vv in v.items() if kk != 'por_semente'}) for k, v in r.items()}, indent=1, default=float))
    json.dump(r, open(sys.argv[1].replace('.jsonl', '_estat.json'), 'w'), default=float)
