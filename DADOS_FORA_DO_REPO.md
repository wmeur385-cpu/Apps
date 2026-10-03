# Dados que ficam fora do repositório (grandes) e de onde vêm

| dado | origem pública | uso |
|---|---|---|
| Google Open Buildings v3 (edificações) | https://sites.research.google/open-buildings/ | detecção de edificação, sementes de lote |
| IBGE faces de logradouro 2022 / setores / quadras | https://www.ibge.gov.br/geociencias/ (Censo 2022, malha de faces) | quadras, faces, nomes de rua |
| IBGE CNEFE 2022 (endereços) | https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Arquivos_CNEFE/CSV/Municipio/ | bairros, busca por endereço, endereço do lote |
| Cadastro oficial de lotes de Araucária | WFS da Prefeitura de Araucária (ver araucaria_ippuc_parana/dados_oficiais/01_baixa_wfs.py) | régua do IoU e base do casamento documento→lote |
| Lotes de Curitiba (amostra) | GeoCuritiba/IPPUC REST (MapaCadastral, camada 15) | régua fria do IoU; consulta por indicação fiscal |
| Esri World Imagery (tiles) | https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer | fundo do 3D, modo quadra, dataset VLM satélite |
| Real-ESRGAN x4plus (pesos) | https://github.com/xinntao/Real-ESRGAN | super-resolução do modo quadra |
| Tesseract.js 5.1.1 + por.traineddata (best) | npm @tesseract.js-data/por | OCR local no navegador (já embutido no HTML) |
| Qwen2-VL-2B-Instruct | Hugging Face | replay do VLM (v9) |

Os HTMLs prontos JÁ trazem tudo embutido (dados processados, imagens, OCR): quem só quer abrir o gêmeo digital não precisa de nada desta tabela.
