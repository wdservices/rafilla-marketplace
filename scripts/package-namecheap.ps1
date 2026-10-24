# Packages a fresh node-server .output build into TWO zips for the split deploy.
# Preferred: run scripts/build-namecheap.ps1 instead (stamps + builds + calls this).
# Standalone:  $env:NITRO_PRESET="node-server"; npm run build, then this script.
# Output:     deploy/namecheap/backend.zip + deploy/namecheap/frontend.zip
#   backend.zip:  extract CONTENTS into ~/backend  (home dir, OUTSIDE public_html).
#                 Node app, mounted at https://<domain>/api via cPanel
#                 "Setup Node.js App" (Application root `backend`, URL path `api`).
#                 Self-contained: no npm install. Served paths: SSR pages,
#                 server functions (/_serverFn/*), /api/health, /sitemap.xml.
#   frontend.zip: extract CONTENTS into public_html (static frontend + .htaccess).
#                 Apache serves prerendered pages/assets directly; everything
#                 else rewrites to /api/* (the backend above).
# Both zips share one build ID (VITE_BUILD_ID baked in + build-info.json
# surfaced by /api/health) - always upload BOTH from the same run.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root ".output"
$Deploy = Join-Path $Root "deploy/namecheap"

# 1. Sanity: .output must be a node-server build (Cloudflare preset won't run on cPanel).
$nitroJson = Join-Path $Out "nitro.json"
if (-not (Test-Path -LiteralPath $nitroJson)) { throw ".output/nitro.json missing - run npm run build first." }
$preset = (Get-Content -LiteralPath $nitroJson -Raw | ConvertFrom-Json).preset
if ($preset -ne "node-server") {
  throw "Wrong preset '$preset'. Rebuild with: `$env:NITRO_PRESET='node-server'; npm run build"
}
Write-Host "Preset OK: node-server"

# 2. Fresh deploy dir. (Windows AV/indexer briefly locks freshly-written zips, and
#    PowerShell Remove-Item trips on it - cmd's del does not. So: PS first, del fallback.)
function Remove-DeployPath([string]$p) {
  for ($i = 1; $i -le 5; $i++) {
    try {
      if (Test-Path -LiteralPath $p) {
        if ((Get-Item -LiteralPath $p).PSIsContainer) {
          Remove-Item -LiteralPath $p -Recurse -Force
        } else {
          Remove-Item -LiteralPath $p -Force
        }
      }
      return
    } catch {
      $isDir = $false
      try { $isDir = (Get-Item -LiteralPath $p -ErrorAction Stop).PSIsContainer } catch {}
      if ($isDir) { cmd /c rmdir /s /q "$p" 2>$null } else { cmd /c del /f /q "$p" 2>$null }
      if (-not (Test-Path -LiteralPath $p)) { return }
      if ($i -eq 5) { throw "Could not clear $p (locked?): $($_.Exception.Message)" }
      Start-Sleep -Seconds 2
    }
  }
}
Remove-DeployPath (Join-Path $Deploy "backend")
Remove-DeployPath (Join-Path $Deploy "frontend")
Remove-DeployPath (Join-Path $Deploy "stage")
Remove-DeployPath (Join-Path $Deploy "stage-frontend")
Remove-DeployPath (Join-Path $Deploy "backend.zip")
Remove-DeployPath (Join-Path $Deploy "frontend.zip")
Remove-DeployPath (Join-Path $Deploy "README-DEPLOY.md")
Get-ChildItem -LiteralPath $Deploy -Filter "rafilla-*.zip" -ErrorAction SilentlyContinue | ForEach-Object {
  Remove-DeployPath $_.FullName
}
if (-not (Test-Path -LiteralPath $Deploy)) { New-Item -ItemType Directory -Path $Deploy | Out-Null }
$StageDir = Join-Path $Deploy "stage"
$FrontDir = Join-Path $Deploy "stage-frontend"
New-Item -ItemType Directory -Path $StageDir | Out-Null
New-Item -ItemType Directory -Path $FrontDir | Out-Null

# 3. Build stamp (also baked into the frontend as VITE_BUILD_ID by
#    scripts/build-namecheap.ps1, and surfaced by /api/health).
$buildId = "$env:BUILD_ID".Trim()
if (-not $buildId) {
  $buildSha = ""
  try { $buildSha = (git rev-parse --short HEAD 2>$null).Trim() } catch {}
  if (-not $buildSha) { $buildSha = "nogit" }
  $buildId = "$buildSha-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmm'))"
}
Write-Host "Build ID: $buildId"

# 4. BACKEND stage: everything the Node app needs (self-contained, no npm install).
Copy-Item -LiteralPath (Join-Path $Out "server") -Destination (Join-Path $StageDir "server") -Recurse
Copy-Item -LiteralPath (Join-Path $Out "nitro.json") -Destination (Join-Path $StageDir "nitro.json")
# node-server preset emits no usable root package.json (only a traced stub inside
# server/) - generate a minimal one so cPanel has an explicit entry point.
$appPkg = @'
{
  "name": "rafilla-grand-prizes",
  "private": true,
  "type": "module",
  "main": "./server/index.mjs",
  "scripts": {
    "start": "node ./server/index.mjs"
  },
  "engines": {
    "node": ">=20"
  }
}
'@
Set-Content -LiteralPath (Join-Path $StageDir "package.json") -Value $appPkg -Encoding Ascii
# Ship a copy of the static frontend INSIDE the backend too: Apache normally
# serves these from public_html, but the copy keeps the Node app fully
# self-sufficient (standalone `node server/index.mjs` serves the whole site,
# and any asset path that ever reaches the app still resolves with etags).
Get-ChildItem -LiteralPath (Join-Path $Out "public") -Force | Copy-Item -Destination (Join-Path $StageDir "public") -Recurse -Force
$buildInfo = (@{
  buildId = $buildId
  builtAt = (Get-Date).ToUniversalTime().ToString("o")
  preset  = "node-server"
} | ConvertTo-Json)
Set-Content -LiteralPath (Join-Path $StageDir "build-info.json") -Value $buildInfo -Encoding Ascii
# NOTE: this file lives at the folder ROOT for the server to read at runtime
# (process.cwd()/build-info.json). Do NOT also copy it into public/: this Nitro
# preset only serves files that existed at build time, so a post-build addition
# would 404. The frontend carries the same ID baked in (VITE_BUILD_ID, visible
# as <meta name="build-id">) - compare that with /api/health.

# 4b. Backend .env: bake server secrets from the release machine so the
# upload works with zero manual secret entry. Server keys only: no VITE_*
# PORT or HOST. Sources per key: process env first, then the repo .env.
# Only KEY NAMES are ever printed; values stay in the file.
$serverEnvKeys = @(
  "PAYSTACK_SECRET_KEY",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "SITE_ORIGIN",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "NOTIFY_CRON_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT"
)
$repoEnv = @{}
$repoEnvFile = Join-Path $Root ".env"
if (Test-Path -LiteralPath $repoEnvFile) {
  foreach ($line in (Get-Content -LiteralPath $repoEnvFile)) {
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t.StartsWith("#")) { continue }
    if (-not $t.Contains("=")) { continue }
    $k = $t.Substring(0, $t.IndexOf("=")).Trim()
    if ($k -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") { continue }
    if (-not $repoEnv.ContainsKey($k)) { $repoEnv[$k] = $t.Substring($t.IndexOf("=") + 1) }
  }
}
$envLines = @()
$envMissing = @()
foreach ($k in $serverEnvKeys) {
  $v = [Environment]::GetEnvironmentVariable($k)
  if ([string]::IsNullOrWhiteSpace($v) -and $repoEnv.ContainsKey($k)) { $v = $repoEnv[$k] }
  if ([string]::IsNullOrWhiteSpace($v)) { $envMissing += $k; continue }
  $envLines += ($k + "=" + $v.Trim())
}
$bakedEnv = $false
if ($envLines.Count -gt 0) {
  Set-Content -LiteralPath (Join-Path $StageDir ".env") -Value ($envLines -join "`n") -Encoding Ascii
  $bakedEnv = $true
  $bakedNames = @()
  foreach ($e in $envLines) { $bakedNames += $e.Substring(0, $e.IndexOf("=")) }
  Write-Host ("backend/.env baked with keys: " + ($bakedNames -join ", "))
} else {
  Write-Host "WARNING: no server secrets found, backend/.env omitted."
}
if ($envMissing.Count -gt 0) {
  Write-Host ("WARNING: missing secret keys: " + ($envMissing -join ", "))
}

# 4c. Real node_modules for the backend (Rivotels-style workflow): install the
# server SDK pinned to the EXACT version this bundle was built and verified
# against. The bundle itself is self-contained (imports resolve inside its own
# chunks), so this is belt-and-braces + disaster recovery - and it makes the
# cPanel "Run NPM Install" button a real verify/reconcile step instead of a
# no-op. backend/package.json declares the dep, package-lock.json pins the tree.
$adminVer = (Get-Content -LiteralPath (Join-Path $Root "node_modules/firebase-admin/package.json") -Raw | ConvertFrom-Json).version
if (-not $adminVer) { throw "Cannot read local firebase-admin version - run npm install first." }
Write-Host "Installing firebase-admin@$adminVer into backend stage ..."
& npm install --prefix $StageDir --no-audit --no-fund --save-exact "firebase-admin@$adminVer"
if ($LASTEXITCODE -ne 0) { throw "npm install for backend stage failed (exit $LASTEXITCODE)" }
if (-not (Test-Path -LiteralPath (Join-Path $StageDir "node_modules/firebase-admin/package.json"))) {
  throw "backend/node_modules/firebase-admin missing after install."
}
if (-not (Test-Path -LiteralPath (Join-Path $StageDir "package-lock.json"))) {
  throw "backend/package-lock.json missing after install."
}
Write-Host "backend/node_modules ready."

# 5. Setup cheat-sheet shipped inside backend.zip.
$readme = @"
RAFFILA - SPLIT DEPLOY (build $buildId)
========================================
Two zips, ONE matching build -- always upload BOTH from this same run:
  backend.zip  -> extract CONTENTS into ~/backend   (Node app, OUTSIDE public_html)
  frontend.zip -> extract CONTENTS into public_html (static frontend + .htaccess)

A) FRONTEND (public_html)
1. cPanel File Manager: open public_html. Upload frontend.zip INTO
   public_html and Extract here. Files must land as public_html/index.html,
   public_html/assets/..., public_html/.htaccess (no extra subfolder level).
   If public_html/.htaccess ALREADY exists (cPanel rules, redirects):
   do NOT overwrite it -- open both files and merge the "Raffila storefront"
   rewrite block into the existing one instead. (File Manager hides dotfiles
   unless "Show Hidden Files" is enabled in its Settings.)
2. If cPanel created a public_html/api folder for the Node app mount below,
   leave it alone.

B) BACKEND (~/backend)
1. Create folder ~/backend (home directory, OUTSIDE public_html).
   Upload backend.zip INTO ~/backend and Extract here, so files land as
   ~/backend/server/index.mjs (no extra subfolder level).
2. Secrets are PRE-INSTALLED: this zip ships ~/backend/.env with the server
   secrets from the release machine (see the packaging log for which keys).
   Verify/rotate any time by editing ~/backend/.env in File Manager, or
   override individual keys in the Node app's "Environment variables"
   section (real environment variables always win). Restart the app after
   changing secrets. Needed keys: PAYSTACK_SECRET_KEY plus
   FIREBASE_SERVICE_ACCOUNT_JSON (or the 3-field split
   FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY).
   This zip now contains LIVE secrets -- never share or re-upload it
   anywhere except your own cPanel; delete superseded zips.
3. cPanel -> Setup Node.js App -> Create Application:
      Node.js version : 20 or higher    Application mode : Production
      Application root: backend
      Application URL : your-domain with path "api" (https://raffila.com/api)
      Startup file    : server/index.mjs
   Click "Run NPM Install" (verifies/reconciles the shipped node_modules,
   ~1 minute), or skip it - the bundle runs standalone regardless.
4. Save, Start (or Restart), wait 60 seconds.

C) VERIFY (both sides, one matching build)
1. https://raffila.com/api/health must say "API running successfully"
   with this same build ID: $buildId
2. View Source on https://raffila.com/ -> <meta name="build-id"> must equal it.
   Mismatch = sides from different builds (the site shows an "update in
   progress" banner): re-upload BOTH zips from one run.
3. Open https://raffila.com/auth directly (SSR via the backend) plus one
   /assets/... URL (static via Apache). Both must load.
4. Admin -> Settings -> Payments & API status should be green.
5. If the app won't start, read ~/backend/stderr.log first -- it holds the
   crash reason. If pages 404 but /api/health works, the public_html
   rewrite block (.htaccess) is missing or unmerged.
6. Stale styling/buttons after an upload: hard-refresh (Ctrl+Shift+R).
"@
Set-Content -LiteralPath (Join-Path $StageDir "README-DEPLOY.txt") -Value $readme -Encoding Ascii

# 6. FRONTEND stage: static site as Apache will serve it, plus the rewrite rules.
Get-ChildItem -LiteralPath (Join-Path $Out "public") -Force | Copy-Item -Destination $FrontDir -Recurse -Force
$htaccess = @'
# Raffila storefront (public_html/.htaccess).
# Apache serves the static frontend; everything else falls through to the
# Node backend mounted at /api (cPanel "Setup Node.js App", Application URL
# path "api", app root ~/backend).
#
# If public_html/.htaccess ALREADY exists (cPanel rules, redirects): do NOT
# overwrite it -- merge the <IfModule mod_rewrite.c> block below into it.

<IfModule mod_rewrite.c>
  RewriteEngine On

  # 0. Mount-root status: /api (and /api/) answer a tiny JSON success document
  #    in BOTH Passenger modes (prefix stripped or kept). Guarded so the
  #    rewritten URL does not loop.
  RewriteCond %{QUERY_STRING} !api-root=1
  RewriteRule ^api/?$ /api/?api-root=1 [L,QSA]

  # 1. Backend mount: hand over untouched, Passenger serves it from ~/backend.
  RewriteRule ^api(/.*)?$ - [L]

  # 2. Real files and directories (prerendered pages, JS/CSS bundles, images,
  #    robots.txt, favicon): served directly by Apache.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # 3. SSR pages, server functions (/_serverFn/*), /sitemap.xml, API probes:
  #    forward to the Node app. The original query string is preserved
  #    automatically. The app accepts the path both with and without the
  #    /api prefix (see src/server.ts), so this works however the host
  #    maps the mount.
  RewriteRule ^(.*)$ /api/$1 [L,QSA]
</IfModule>

# Long-cache the content-hashed bundles (same headers the Node server used).
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable" "expr=%{REQUEST_URI} =~ m#^/assets/# && %{REQUEST_STATUS} == 200"
</IfModule>
'@
Set-Content -LiteralPath (Join-Path $FrontDir ".htaccess") -Value $htaccess -Encoding Ascii

# 7. Zip both. Files at each zip's root: extract-in-place into ~/backend / public_html.
Compress-Archive -LiteralPath @((Get-ChildItem -LiteralPath $StageDir -Force | ForEach-Object { $_.FullName })) -DestinationPath (Join-Path $Deploy "backend.zip") -Force
Compress-Archive -LiteralPath @((Get-ChildItem -LiteralPath $FrontDir -Force | ForEach-Object { $_.FullName })) -DestinationPath (Join-Path $Deploy "frontend.zip") -Force

# 7b. Frontend self-consistency gate: every file-like absolute reference in
# the prerendered HTML must resolve to a file in the frontend stage. This
# catches a stale prerender (HTML rendered against an older build's asset
# hashes - every script/link would 404 and the site would ship dead).
$frontFiles = @{}
Get-ChildItem -LiteralPath $FrontDir -Recurse -File -Force | ForEach-Object {
  $frontFiles[$_.FullName.Substring($FrontDir.Length + 1).Replace("\", "/")] = $true
}
$badRefs = @()
Get-ChildItem -LiteralPath $FrontDir -Recurse -Filter "*.html" -Force | ForEach-Object {
  $html = Get-Content -LiteralPath $_.FullName -Raw
  foreach ($m in [regex]::Matches($html, '(?:src|href)="(/[^"]+)"')) {
    $ref = $m.Groups[1].Value
    if ($ref.StartsWith("//")) { continue }  # protocol-relative (CDN) URL
    $rel = $ref.TrimStart("/").Split("?")[0].Split("#")[0]
    if ((Split-Path -Leaf $rel) -notlike "*.*") { continue }  # route link, not a file
    if (-not $frontFiles.ContainsKey($rel)) { $badRefs += ($_.Name + " -> " + $ref) }
  }
}
if ($badRefs.Count -gt 0) {
  $sample = ($badRefs | Select-Object -First 10) -join "; "
  throw "Frontend HTML references $($badRefs.Count) missing files (stale prerender output?). e.g. $sample"
}
Write-Host "Frontend refs OK."
# The stamp must be baked into the HTML too (proves VITE_BUILD_ID reached prerender).
$indexHtml = Get-Content -LiteralPath (Join-Path $FrontDir "index.html") -Raw
$stampRe = '<meta name="build-id" content="' + [regex]::Escape($buildId) + '"'
if ($indexHtml -notmatch $stampRe) {
  throw 'Frontend index.html lacks <meta name="build-id" content="' + $buildId + '"> - VITE_BUILD_ID was not baked into the prerender.'
}
Write-Host "Build stamp OK in HTML."

# 8. Verify the zips actually contain the load-bearing files (Compress-Archive
#    has skipped dotfiles like .htaccess in the past - fail loudly, not silently).
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Assert-ZipContains([string]$zipPath, [string[]]$required) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    # Windows zips store "\" separators - normalize before comparing.
    $names = @($zip.Entries | ForEach-Object { ($_.FullName -replace "\\", "/") })
    foreach ($need in $required) {
      if ($names -notcontains $need) {
        throw "$zipPath is missing required entry '$need'. Got: $($names -join ', ')"
      }
    }
  } finally {
    $zip.Dispose()
  }
}
Assert-ZipContains (Join-Path $Deploy "backend.zip") @(
  "server/index.mjs", "public/index.html", "package.json", "build-info.json", "README-DEPLOY.txt"
)
if ($bakedEnv) {
  Assert-ZipContains (Join-Path $Deploy "backend.zip") @(".env")
  Write-Host "backend.zip .env present."
}
Assert-ZipContains (Join-Path $Deploy "frontend.zip") @(
  "index.html", ".htaccess", "robots.txt"
)
$frontZip = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $Deploy "frontend.zip"))
try {
  $frontNames = @($frontZip.Entries | ForEach-Object { ($_.FullName -replace "\\", "/") })
  if (-not ($frontNames | Where-Object { $_ -like "assets/*" })) { throw "frontend.zip contains no assets/* entries." }
  if (-not ($frontNames | Where-Object { $_ -like "about/index.html" })) { throw "frontend.zip contains no prerendered route folders." }
} finally {
  $frontZip.Dispose()
}

# 9. Zips-only deploy folder: remove the loose staging dirs.
Remove-DeployPath $StageDir
Remove-DeployPath $FrontDir

Write-Host ""
Write-Host "Packaged OK -> $Deploy (backend.zip + frontend.zip, build $buildId)"
