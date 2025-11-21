param(
    [string]$RepoPath = "C:\Users\cleit\Xtreino-Freitas",
    [string]$RemoteUrl = "https://github.com/DouglasMiranda18/Xtreino-Freitas.git",
    [string]$Message = "Corrige bug do cupom: impede reaplicar e limita desconto mínimo"
)

Set-Location -Path $RepoPath

if (-not (Test-Path ".git")) {
    Write-Error "Pasta não é um repositório git: $RepoPath"
    exit 1
}

# Mostrar status
git status --porcelain

# Adicionar alterações
git add -A

# Verificar se há alterações
$changes = git status --porcelain
if (-not $changes) {
    Write-Output "Nenhuma alteração para commitar."
    exit 0
}

# Commit
git commit -m "$Message"

# Garantir remote origin
try {
    git remote get-url origin > $null 2>&1
} catch {
    git remote add origin $RemoteUrl
    Write-Output "Remote 'origin' adicionado: $RemoteUrl"
}

# Branch atual
$branch = git branch --show-current
if (-not $branch) { $branch = "main" }

# Push
git push -u origin $branch
