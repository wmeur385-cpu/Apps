@echo off
rem Junta as partes dos HTMLs (Windows, sem Python). Depois confira o SHA-256 com:
rem   certutil -hashfile pacotes\santa_rita_do_sapucai\santa_rita_sapucai_gemeo_3d_v10.html SHA256
rem e compare com SHA256SUMS.txt.
setlocal enabledelayedexpansion
for /d %%D in (pacotes\*) do (
  for %%F in (%%D\*.part01) do (
    set "nome=%%~nF"
    echo montando %%D\!nome!
    copy /b "%%D\!nome!.part*" "%%D\!nome!" >nul
  )
)
echo pronto. Confira os SHA-256 com certutil (ver SHA256SUMS.txt).
