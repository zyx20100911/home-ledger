<#
.SYNOPSIS
Home Ledger PostgreSQL 自动备份脚本（Windows）

.DESCRIPTION
从 Docker 容器导出数据库为 gzip 压缩包，并自动清理过期备份。
可将 -BackupDir 指向 OneDrive / 百度网盘 / 坚果云等本地同步目录，实现零成本异地容灾。
#>
param(
  [string]$BackupDir = (Join-Path $PSScriptRoot '..\backups'),
  [int]$RetainDays = 30,
  [string]$ContainerName = 'home-ledger-prod-postgres',
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env.prod')
)

$ErrorActionPreference = 'Stop'

function Read-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$DefaultValue
  )
  if (-not (Test-Path $Path)) {
    return $DefaultValue
  }
  foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }
    $parts = $trimmed -split '=', 2
    if ($parts.Count -eq 2 -and $parts[0].Trim() -eq $Key) {
      $val = $parts[1].Trim().Trim('"').Trim("'")
      if ($val) {
        return $val
      }
    }
  }
  return $DefaultValue
}

$PgUser = Read-EnvValue -Path $EnvFile -Key 'POSTGRES_USER' -DefaultValue 'home_ledger'
$PgDb = Read-EnvValue -Path $EnvFile -Key 'POSTGRES_DB' -DefaultValue 'home_ledger'

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}
$ResolvedBackupDir = (Resolve-Path $BackupDir).Path

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$TargetFile = Join-Path $ResolvedBackupDir "home-ledger-$Timestamp.sql.gz"
$TempSqlFile = Join-Path $ResolvedBackupDir "home-ledger-$Timestamp.sql.tmp"

Write-Host "[backup] Exporting database '$PgDb' from container '$ContainerName'..."

try {
  $dumpProcess = Start-Process `
    -FilePath 'docker' `
    -ArgumentList @('exec', $ContainerName, 'pg_dump', '-U', $PgUser, '-d', $PgDb, '--clean', '--if-exists', '--no-owner') `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $TempSqlFile

  if ($dumpProcess.ExitCode -ne 0) {
    throw "pg_dump failed with exit code $($dumpProcess.ExitCode)."
  }

  $sqlInfo = Get-Item -Path $TempSqlFile
  if ($sqlInfo.Length -eq 0) {
    throw 'pg_dump produced an empty SQL file.'
  }

  $inStream = [System.IO.File]::OpenRead($TempSqlFile)
  try {
    $outStream = [System.IO.File]::Create($TargetFile)
    try {
      $gzipStream = New-Object System.IO.Compression.GZipStream($outStream, [System.IO.Compression.CompressionMode]::Compress)
      try {
        $inStream.CopyTo($gzipStream)
      }
      finally {
        $gzipStream.Dispose()
      }
    }
    finally {
      $outStream.Dispose()
    }
  }
  finally {
    $inStream.Dispose()
  }

  $gzInfo = Get-Item -Path $TargetFile
  if ($gzInfo.Length -eq 0) {
    throw 'Compressed backup file is empty.'
  }

  Write-Host "[backup] Success: $TargetFile ($($gzInfo.Length) bytes)"
}
finally {
  if (Test-Path $TempSqlFile) {
    Remove-Item -Path $TempSqlFile -Force -ErrorAction SilentlyContinue
  }
}

$Cutoff = (Get-Date).AddDays(-$RetainDays)
$ExpiredFiles = Get-ChildItem -Path $ResolvedBackupDir -Filter 'home-ledger-*.sql.gz' |
  Where-Object { $_.LastWriteTime -lt $Cutoff }

foreach ($file in $ExpiredFiles) {
  Remove-Item -Path $file.FullName -Force
  Write-Host "[backup] Pruned expired backup: $($file.Name)"
}
