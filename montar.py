#!/usr/bin/env python3
"""Junta as partes (nome.html.partNN) de cada pacote e confere o SHA-256 com SHA256SUMS.txt.
Uso: python3 montar.py            (monta tudo)
     python3 montar.py --checar   (só confere os arquivos já montados)"""
import hashlib, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sums = {l.split("  ", 1)[1].strip(): l.split("  ", 1)[0] for l in (HERE / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines() if "  " in l}
so_checar = "--checar" in sys.argv
ok = True
for rel, sha in sums.items():
    alvo = HERE / rel
    partes = sorted(alvo.parent.glob(alvo.name + ".part*"))
    if not so_checar and partes:
        with open(alvo, "wb") as f:
            for p in partes:
                f.write(p.read_bytes())
        print(f"montado {rel} a partir de {len(partes)} parte(s)")
    if not alvo.exists():
        print(f"FALTA {rel}"); ok = False; continue
    h = hashlib.sha256(alvo.read_bytes()).hexdigest()
    print(("OK  " if h == sha else "SHA DIFERENTE  ") + rel)
    ok = ok and h == sha
sys.exit(0 if ok else 1)
