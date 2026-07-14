@echo off
echo ====================================
echo    DEPLOIEMENT FORGE
echo ====================================
echo.

:: === TROUVER GIT ===
set "GIT=git"
where git >nul 2>&1
if not errorlevel 1 goto :gitok

echo Git non trouve dans PATH.
echo Recherche dans GitHub Desktop...

for /f "delims=" %%G in ('powershell -NoProfile -Command "Get-ChildItem -Path ([Environment]::GetFolderPath('LocalApplicationData') + '\GitHubDesktop') -Recurse -Filter 'git.exe' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like '*cmd*git.exe' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName" 2^>nul') do (
    set "GIT=%%G"
    goto :gitok
)

echo.
echo ERREUR : Git introuvable.
echo Ouvrez GitHub Desktop et reconnectez-vous, puis relancez ce fichier.
echo.
pause
exit /b 1

:gitok
echo Git : %GIT%
echo.

:: === COPIE DES FICHIERS ===
echo [1/4] Copie des fichiers HTML...
cd /d "C:\Users\milan\Downloads\BOS-main\FORGE\Site"

if not exist "Site FORGE.html" (
    echo ERREUR : "Site FORGE.html" introuvable dans ce dossier.
    pause
    exit /b 1
)

copy /Y "Site FORGE.html" "..\index.html" >nul
copy /Y "faq.html" "..\faq.html" >nul
copy /Y "mentions-legales.html" "..\mentions-legales.html" >nul
copy /Y "merci.html" "..\merci.html" >nul
copy /Y "forge-logo-icon.svg" "..\forge-logo-icon.svg" >nul
copy /Y "tarifs.html" "..\tarifs.html" >nul
echo OK - fichiers copies.
echo.

:: === GIT ===
echo [2/4] Preparation du depot Git...
cd /d "C:\Users\milan\Downloads\BOS-main\FORGE"

if exist ".git" (
    echo Suppression ancien .git...
    rmdir /s /q ".git"
)

"%GIT%" init -b main
"%GIT%" config user.email "martignoni.milan@gmail.com"
"%GIT%" config user.name "martignonimilan-rgb"
echo.

echo [3/4] Commit...
"%GIT%" add .
"%GIT%" commit -m "mise a jour site FORGE"
echo.

echo [4/4] Envoi vers GitHub...
:: Utilise le Gestionnaire d'identifiants Windows (installe par GitHub Desktop)
:: Pas besoin de token dans l'URL - les identifiants sont stockes en securite
"%GIT%" remote add origin https://github.com/martignonimilan-rgb/FORGE.git
"%GIT%" push --force -u origin main

if errorlevel 1 (
    echo.
    echo ATTENTION : le push a echoue.
    echo Ouvrez GitHub Desktop, verifiez que vous etes connecte a martignonimilan-rgb
    echo puis relancez ce fichier.
) else (
    echo.
    echo ====================================
    echo  TERMINE ! Site deploye sur Netlify.
    echo ====================================
)

echo.
pause
