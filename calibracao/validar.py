# validar.py — escolhe entre os finalistas nas sementes de validação (2001–2050) pelo critério pré-registrado
import json, pandas as pd, numpy as np
d = pd.DataFrame([json.loads(l) for l in open('validacao.jsonl')]); fin = json.load(open('finalistas.json'))
b = d[d.cfg == 0].set_index('semente').sort_index(); base = dict(y1=b.y1.mean(), pend=b.pendentes.mean(), f1=b.f1.mean())
LIM_P, LIM_F = 1.10 * base['pend'], base['f1'] - 0.002; linhas = []
for i, f in enumerate(fin, start=1):
    x = d[d.cfg == i].set_index('semente').sort_index()
    linhas.append(dict(i=i, nome=f['nome'], params=f['params'], y1=x.y1.mean(), pend=x.pendentes.mean(), f1=x.f1.mean(), viavel=bool(x.pendentes.mean() <= LIM_P and x.f1.mean() >= LIM_F), reducao=1 - x.y1.mean() / base['y1']))
ok = [l for l in linhas if l['viavel']]; esc = min(ok, key=lambda l: l['y1']) if ok else None
print('baseline', {k: round(v, 4) for k, v in base.items()}, 'limites pend ≤', round(LIM_P, 2), 'F1 ≥', round(LIM_F, 4))
for l in linhas: print(f"  {l['i']} {l['nome']:30s} y1 {l['y1']:.2f} ({l['reducao']*100:+.0f}%) pend {l['pend']:.2f} f1 {l['f1']:.4f} {'viável' if l['viavel'] else 'fura limite'}")
print('escolhido:', esc and esc['nome'], esc and esc['params'])
json.dump(dict(base=base, LIM_P=LIM_P, LIM_F=LIM_F, finalistas=linhas, escolhido=esc), open('validacao_resultado.json', 'w'), indent=1, default=float)
