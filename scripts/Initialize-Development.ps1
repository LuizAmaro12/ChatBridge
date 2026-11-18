param()
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$targets = @('web', 'mobile') | ForEach-Object { Join-Path $repoRoot "services/$_-api/.env" }
foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) { throw "Configuração já existe: $target. Preserve ou edite manualmente; nenhum arquivo foi escrito." }
}
function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
$serviceSecret = New-RandomSecret
foreach ($role in @('web', 'mobile')) {
    $example = Join-Path $repoRoot "services/$role-api/.env.example"
    $configuration = Get-Content -Raw -Encoding UTF8 -LiteralPath $example
    $configuration = $configuration.Replace('Auth__SigningKey=', ('Auth__SigningKey=' + (New-RandomSecret)))
    $configuration = $configuration.Replace('Interbackend__ServiceKey=', ('Interbackend__ServiceKey=' + $serviceSecret))
    $configuration = $configuration.Replace('DemoUser__Password=', ('DemoUser__Password=' + (New-RandomSecret)))
    [System.IO.File]::WriteAllText((Join-Path $repoRoot "services/$role-api/.env"), $configuration, (New-Object System.Text.UTF8Encoding $false))
}
Write-Output 'Configurações locais criadas. Consulte DemoUser__Username e DemoUser__Password no .env de cada API. Não compartilhe esses arquivos.'
