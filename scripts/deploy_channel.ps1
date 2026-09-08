# scripts/deploy_channel.ps1
$ErrorActionPreference = "Stop"

$mirthHost = "localhost"
$mirthPort = "8443"
$mirthUser = "admin"
$mirthPass = "admin"
$channelFile = "mirth_channels/HL7_Inbound_ADT_To_Postgres.xml"

if (-not (Test-Path $channelFile)) {
    Write-Error "Error: Channel XML file not found at $channelFile"
}

# Bypass SSL trust check for local Mirth self-signed cert
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

$pair = "${mirthUser}:${mirthPass}"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [Convert]::ToBase64String($bytes)
$headers = @{
    "Authorization" = "Basic $base64"
    "X-Requested-With" = "OpenAPI"
}

Write-Host "==> Importing Channel into Mirth..." -ForegroundColor Cyan
$xmlContent = Get-Content $channelFile -Raw

# 1. Import Channel XML
Invoke-RestMethod -Uri "https://${mirthHost}:${mirthPort}/api/channels" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/xml" `
    -Body $xmlContent

Write-Host "==> Deploying Channel..." -ForegroundColor Cyan
[xml]$xml = $xmlContent
$channelId = $xml.channel.id

# 2. Deploy Channel (Fix for HTTP 415: Pass explicit Content-Type or empty string body)
Invoke-RestMethod -Uri "https://${mirthHost}:${mirthPort}/api/channels/${channelId}/_deploy" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/xml" `
    -Body ""

Write-Host "==> Channel $channelId successfully imported and deployed!" -ForegroundColor Green