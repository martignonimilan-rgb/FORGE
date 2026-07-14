# Script de déploiement FORGE sur GitHub Pages
Set-Location "C:\Users\milan\Downloads\BOS-main\FORGE"

# Supprimer l'ancien .git si présent
if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
    Write-Host "Ancien .git supprimé" -ForegroundColor Yellow
}

# Initialiser git
git init -b main
git config user.email "martignoni.milan@gmail.com"
git config user.name "martignonimilan-rgb"

# Ajouter le fichier et committer
git add index.html
git commit -m "premier commit"

# Connexion et push (identifiants via Gestionnaire Windows - pas de token en dur)
git remote add origin https://github.com/martignonimilan-rgb/FORGE.git
git push --force -u origin main

Write-Host ""
Write-Host "TERMINE ! Site envoyé sur GitHub." -ForegroundColor Green
Write-Host "Appuie sur une touche pour fermer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
