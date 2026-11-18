param([Parameter(Mandatory = $true)][ValidateSet('web', 'mobile')][string]$Role)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$configurationFile = Join-Path $repoRoot "services/$Role-api/.env"
if (-not (Test-Path -LiteralPath $configurationFile)) { throw 'Execute scripts/Initialize-Development.ps1 primeiro.' }
$originalValues = @{}
try {
    foreach ($line in (Get-Content -Encoding UTF8 -LiteralPath $configurationFile)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
        $pair = $line -split '=', 2
        if ($pair.Length -ne 2 -or $pair[0] -notmatch '^[A-Za-z][A-Za-z0-9_]*$') { throw 'Linha inválida no arquivo de configuração.' }
        $originalValues[$pair[0]] = [Environment]::GetEnvironmentVariable($pair[0], 'Process')
        [Environment]::SetEnvironmentVariable($pair[0], $pair[1], 'Process')
    }
    & dotnet run --no-launch-profile --project (Join-Path $repoRoot "services/$Role-api/ChatBridge.Api.csproj")
    if ($LASTEXITCODE -ne 0) { throw "API encerrou com código $LASTEXITCODE" }
}
finally {
    foreach ($name in $originalValues.Keys) { [Environment]::SetEnvironmentVariable($name, $originalValues[$name], 'Process') }
}
