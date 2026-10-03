# Gêmeo digital cadastral a partir de dados abertos — Santa Rita do Sapucaí (MG) e Araucária (PR)

Aplicações de **um arquivo HTML só**, que abrem com dois cliques e funcionam sem servidor:
mapa 3D com edificações (Open Buildings v3) e altura estimada, quadras e faces do IBGE, lotes
**estimados** (Santa Rita) ou **oficiais** (Araucária), busca por endereço (CNEFE 2022), Mesa
Sentinela por bairro (diagnóstico cadastral e ordem de grandeza de IPTU), modo quadra hiper-real,
VLM em ação, e o **leitor de documentos** (matrícula/projeto → OCR local no navegador → localizar o
lote no mapa → comparar área/frente → registrar quem confirmou, com log de uso local).

> Nada aqui substitui o cadastro oficial nem tem fé pública. Lote estimado é estimativa; toda
> decisão passa por conferência humana (a interface diz isso em cada painel).

## Como abrir

1. Baixe a pasta `pacotes/<cidade>/` inteira (ou clone o repositório).
2. Junte as partes do HTML (o GitHub limita o upload pela web a 25 MB por arquivo, por isso cada
   HTML está em pedaços de 23 MiB (24,1 MB)):
   - qualquer sistema com Python: `python3 montar.py`
   - Windows sem Python: dê dois cliques em `montar.bat`
   O script confere o **SHA-256** de cada arquivo montado contra `SHA256SUMS.txt`.
3. Abra `santa_rita_sapucai_gemeo_3d_v10.html` (ou `araucaria_gemeo_3d_v7.html`) no Chrome/Edge.
   Sem internet: tudo funciona menos a imagem de satélite de fundo (tiles da Esri).

Alternativas para quem mantém o repositório: **Git LFS** (arquivo inteiro; descomente a linha em
`.gitattributes` e rode `git lfs install`) ou publicar o HTML montado como anexo de uma
**Release** (até 2 GB por arquivo) — é o jeito mais simples de distribuir o arquivo pronto.

## O que tem em cada pasta

| pasta | conteúdo |
|---|---|
| `pacotes/santa_rita_do_sapucai/` | SPA v10 (partes) — lotes estimados v7, Mesa Sentinela (Estratégico + Valor Venal), leitor v3, log de uso, régua, marcadores, atalhos |
| `pacotes/araucaria/` | SPA v7 (partes) — cadastro oficial de lotes + leitor v3 com OCR local e casamento documento→lote |
| `fonte/` | scripts que geram e PROVAM cada SPA (Playwright), o experimento de forma de partida (Parte 6), o leitor v3 e a regra generalista de extração (Python e JS, conferidas uma contra a outra) |
| `docs/` | LEIA-MEs e relatórios em PDF (concorrentes, fluxo do operador com prova real, Partes 1–6 do polígono, receita do fine-tune do VLM, leitor) |
| `montar.py` / `montar.bat` / `SHA256SUMS.txt` | remontagem e conferência dos HTMLs |
| `DADOS_FORA_DO_REPO.md` | origem pública de cada dado bruto (não versionado: grande demais) |

## Segurança e privacidade

- O HTML não contém chave de API nenhuma. O card do Gemini pede a chave do próprio usuário, só
  na memória do navegador, e recusa por SHA-256 uma chave conhecida como comprometida.
- O OCR roda dentro do navegador (Tesseract.js embutido): o documento não sai da máquina.
- O leitor só extrai campos técnicos do imóvel; nome e CPF não entram em campo nem em log.
- O log de uso fica no `localStorage` do navegador; sai só quando o operador baixa o `.jsonl`/`.csv`.
- Toda entrega passa por `fonte/_lib/checagem_seguranca_entrega.py` (credenciais) e
  `fonte/_lib/checagem_pii_entrega.py` (nome/CPF/RG dos documentos de teste) antes de sair.
- Os documentos reais usados nos testes NÃO estão no repositório; a prova usa cópias com nome neutro
  e só campos técnicos do imóvel (matrícula, lote, área, indicação fiscal…).

## Como reproduzir

```
cd fonte/leitor_documentos_antifragil && python3 13_monta_leitor_v3.py && python3 14_teste_extrator_js_vs_py.py
cd ../santa_rita_sapucai && python3 12_monta_spa_v10.py && python3 13_prova_v10.py
cd ../araucaria_ippuc_parana && python3 71_monta_araucaria_v7.py && python3 72_prova_araucaria_v7.py
```
(precisa dos dados brutos listados em `DADOS_FORA_DO_REPO.md` e de Playwright + Chromium.)

## Licença

A definir pelo autor. Componentes embutidos: MapLibre GL (BSD-3), pdf.js (Apache-2.0),
Tesseract.js (Apache-2.0), fontes DejaVu (licença própria). Dados: Open Buildings (CC BY 4.0 /
ODbL), IBGE (uso livre com citação), Esri World Imagery (termos da Esri; só como fundo online).
