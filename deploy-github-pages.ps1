<#
  Cloud Phone Spotify widget -> GitHub Pages yayin script'i

  Kullanim:
      cd C:\Users\Safer\Desktop\spotify\cloudphone-spotify-widget
      .\deploy-github-pages.ps1 -RepoUrl https://github.com/KULLANICI/spotify-widget.git

  GitHub'da ONCEDEN bos bir repo olusturmus ol (README/ .gitignore secmeli degil).
  GitHub kimlik dogrulamasini once "git config" veya GitHub Desktop ile yapmis ol.
#>
param(
  [Parameter(Mandatory = $true)][string]$RepoUrl,
  [string]$Branch = 'main',
  [string]$Message = 'Cloud Phone Spotify widget'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "`n[1/4] Git kontrolu..." -ForegroundColor Cyan
git --version

Write-Host "`n[2/4] Repo hazirlaniyor ($Branch)..." -ForegroundColor Cyan
if (-not (Test-Path '.git')) {
  git init -b $Branch | Out-Null
}
if (-not (git config user.email)) {
  git config user.email "widget@localhost"
  git config user.name "Cloud Phone Widget"
  Write-Host "      (uyari) git kimlik bilgisi yok, gecici deger kullanildi" -ForegroundColor Yellow
}
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "      degisiklik yok, commit atlandi" -ForegroundColor DarkGray
} else {
  git commit -m $Message | Out-Null
  Write-Host "      commit olusturuldu" -ForegroundColor Green
}

Write-Host "`n[3/4] Remote ayarlaniyor..." -ForegroundColor Cyan
$existing = git remote
if ($existing -match 'origin') {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}
Write-Host "      origin -> $RepoUrl"

Write-Host "`n[4/4] Push..." -ForegroundColor Cyan
git push -u origin $Branch

$repoName = ($RepoUrl -replace '\.git$', '') -split '/' | Select-Object -Last 1
$user = ($RepoUrl -replace '\.git$', '') -split '/' | Select-Object -SkipLast 1 | Select-Object -Last 1
$pagesUrl = "https://$user.github.io/$repoName/"

Write-Host "`n----------------------------------------------------------" -ForegroundColor Green
Write-Host "Push tamam. Simdi GitHub'da 2 adim kaldi:" -ForegroundColor Green
Write-Host ""
Write-Host " 1) Repo -> Settings -> Pages"
Write-Host "    Source: 'Deploy from a branch'  |  Branch: $Branch  |  Folder: / (root)"
Write-Host "    Save'a bas, 1-2 dakika bekle."
Write-Host ""
Write-Host " 2) Spotify Dashboard -> Settings -> Redirect URIs"
Write-Host "    Ekle: $pagesUrl"
Write-Host ""
Write-Host " Widget adresi : $pagesUrl"
Write-Host " Cloud Phone   : cloudphone.tech/my -> Widget List -> + ->"
Write-Host "                  Name: Spotify | URL: $pagesUrl | Icon: assets/icon-80.png"
Write-Host "----------------------------------------------------------`n" -ForegroundColor Green
