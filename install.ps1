<#
.SYNOPSIS
  安装 dsh-context-effort 到本地 DeepSeek Harness profile。

.DESCRIPTION
  不依赖 pnpm、不依赖网络。做两件事：
    1) 把插件文件解到 <profile>\node_modules\dsh-context-effort
    2) 在 <profile>\package.json 里登记 dependency + dsh.profile.bundles

  包自带的 cordis.patch.yml 会作为 bundle 层自动生效，无需手改 profile 的 patch 文件。

.PARAMETER Profile
  profile 名。默认 desktop（DeepSeek Harness 桌面应用使用的 profile）。

.PARAMETER DshHome
  DSH_HOME 路径。默认取 $env:DSH_HOME，取不到则用 $HOME\.dsh。

.PARAMETER Uninstall
  卸载：从 profile 的 package.json 移除登记，并删除已安装的插件目录。

.PARAMETER Force
  目标已存在时直接覆盖，不询问。

.EXAMPLE
  .\install.ps1
  .\install.ps1 -Profile desktop
  .\install.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string]$Profile = 'desktop',
  [string]$DshHome,
  [switch]$Uninstall,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$PackageName = 'dsh-context-effort'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "    XX  $msg" -ForegroundColor Red }

# --- 定位 DSH_HOME ---
if (-not $DshHome) {
  if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME }
  else { $DshHome = Join-Path $HOME '.dsh' }
}
if (-not (Test-Path $DshHome)) {
  Write-Err "找不到 DSH_HOME：$DshHome"
  Write-Host "    请先启动一次 DeepSeek Harness，或用 -DshHome 指定路径。"
  exit 1
}
Write-Step "DSH_HOME = $DshHome"

$ProfileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
if (-not (Test-Path $ProfileDir)) {
  Write-Err "找不到 profile 目录：$ProfileDir"
  Write-Host "    可用 profile："
  Get-ChildItem (Join-Path $DshHome 'profiles') -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "      - $($_.Name)" }
  exit 1
}

$ProfilePkg = Join-Path $ProfileDir 'package.json'
if (-not (Test-Path $ProfilePkg)) {
  Write-Err "profile 缺少 package.json：$ProfilePkg"
  exit 1
}
Write-Step "profile = $Profile  ($ProfileDir)"

$TargetDir = Join-Path (Join-Path $ProfileDir 'node_modules') $PackageName

# ============================================================
# 卸载分支
# ============================================================
if ($Uninstall) {
  Write-Step '卸载'

  $raw = Get-Content $ProfilePkg -Raw -Encoding UTF8
  $pkg = $raw | ConvertFrom-Json

  $changed = $false
  if ($pkg.dependencies -and $pkg.dependencies.PSObject.Properties.Name -contains $PackageName) {
    $pkg.dependencies.PSObject.Properties.Remove($PackageName)
    $changed = $true
    Write-Ok '已从 dependencies 移除'
  }
  if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) {
    $kept = @($pkg.dsh.profile.bundles | Where-Object { $_ -ne $PackageName })
    if ($kept.Count -ne $pkg.dsh.profile.bundles.Count) {
      $pkg.dsh.profile.bundles = $kept
      $changed = $true
      Write-Ok '已从 dsh.profile.bundles 移除'
    }
  }

  if ($changed) {
    Copy-Item $ProfilePkg "$ProfilePkg.bak-uninstall" -Force
    ($pkg | ConvertTo-Json -Depth 20) | Set-Content $ProfilePkg -Encoding UTF8 -NoNewline
    Write-Ok "package.json 已更新（备份：$ProfilePkg.bak-uninstall）"
  } else {
    Write-Warn2 'package.json 里本来就没有登记'
  }

  if (Test-Path $TargetDir) {
    Remove-Item $TargetDir -Recurse -Force
    Write-Ok "已删除 $TargetDir"
  } else {
    Write-Warn2 '插件目录本来就不存在'
  }

  Write-Host ''
  Write-Host '卸载完成。重启 DeepSeek Harness 后生效。' -ForegroundColor Green
  exit 0
}

# ============================================================
# 安装分支
# ============================================================

# --- 检查是否已在运行 ---
$running = Get-Process -Name '*DeepSeek*' -ErrorAction SilentlyContinue
if ($running) {
  Write-Warn2 '检测到 DeepSeek Harness 正在运行。'
  Write-Host '        安装可以继续，但必须【完全退出并重启】才能生效。' -ForegroundColor Yellow
  Write-Host '        建议现在退出，避免配置文件被应用回写覆盖。' -ForegroundColor Yellow
  if (-not $Force) {
    $a = Read-Host '    仍要继续？(y/N)'
    if ($a -notmatch '^(y|Y)') { Write-Host '已取消。'; exit 1 }
  }
}

# --- 找到包内容（来自 tarball 解开后的目录，或本脚本同级） ---
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = $null
foreach ($cand in @(
    (Join-Path $ScriptDir 'package'),      # tarball 解开的 package/ 目录
    $ScriptDir                             # 直接放在包目录里运行
  )) {
  if ((Test-Path (Join-Path $cand 'package.json')) -and
      (Test-Path (Join-Path $cand 'lib\client.js'))) {
    $SourceDir = $cand
    break
  }
}
if (-not $SourceDir) {
  Write-Err '找不到插件内容（需要 package.json 与 lib/client.js）。'
  Write-Host '    请确认本脚本与插件文件在一起（tarball 解开后应有 package\ 子目录）。'
  exit 1
}
Write-Step "插件内容 = $SourceDir"

# --- 校验关键文件 ---
$required = @('lib\client.js', 'lib\index.js', 'cordis.patch.yml', 'locale\zh.json', 'locale\en.json')
foreach ($rel in $required) {
  if (-not (Test-Path (Join-Path $SourceDir $rel))) {
    Write-Err "包内缺少关键文件：$rel"
    exit 1
  }
}
Write-Ok '包内容校验通过'

# --- 覆盖确认 ---
if ((Test-Path $TargetDir) -and -not $Force) {
  Write-Warn2 "目标已存在：$TargetDir"
  $a = Read-Host '    覆盖？(y/N)'
  if ($a -notmatch '^(y|Y)') { Write-Host '已取消。'; exit 1 }
}

# --- 复制文件 ---
Write-Step "安装到 $TargetDir"
if (Test-Path $TargetDir) { Remove-Item $TargetDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

# 只复制运行时需要的（与包的 files 字段一致）
foreach ($item in @('lib', 'locale', 'src', 'cordis.patch.yml', 'package.json', 'README.md', 'LICENSE')) {
  $src = Join-Path $SourceDir $item
  if (Test-Path $src) {
    Copy-Item $src -Destination $TargetDir -Recurse -Force
  }
}
Write-Ok "已复制文件：$((Get-ChildItem $TargetDir -Recurse -File).Count) 个"

# --- 登记到 profile 的 package.json ---
Write-Step '登记到 package.json'
Copy-Item $ProfilePkg "$ProfilePkg.bak-before-$PackageName" -Force

$pkg = (Get-Content $ProfilePkg -Raw -Encoding UTF8) | ConvertFrom-Json

# dependencies
if (-not $pkg.dependencies) {
  $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue ([PSCustomObject]@{}) -Force
}
$depValue = "file:$TargetDir"
if ($pkg.dependencies.PSObject.Properties.Name -contains $PackageName) {
  $pkg.dependencies.$PackageName = $depValue
} else {
  $pkg.dependencies | Add-Member -NotePropertyName $PackageName -NotePropertyValue $depValue -Force
}
Write-Ok "dependencies.$PackageName = $depValue"

# dsh.profile.bundles
if (-not $pkg.dsh) { $pkg | Add-Member -NotePropertyName dsh -NotePropertyValue ([PSCustomObject]@{}) -Force }
if (-not $pkg.dsh.profile) { $pkg.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([PSCustomObject]@{}) -Force }
if (-not $pkg.dsh.profile.bundles) {
  $pkg.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue @() -Force
}
if ($pkg.dsh.profile.bundles -notcontains $PackageName) {
  $pkg.dsh.profile.bundles = @($pkg.dsh.profile.bundles) + $PackageName
  Write-Ok "dsh.profile.bundles += $PackageName"
} else {
  Write-Ok "dsh.profile.bundles 已包含 $PackageName"
}

($pkg | ConvertTo-Json -Depth 20) | Set-Content $ProfilePkg -Encoding UTF8 -NoNewline
Write-Ok "已写入（备份：$ProfilePkg.bak-before-$PackageName）"

# --- 尝试用 dsh 校验配置组装 ---
Write-Host ''
Write-Step '校验配置组装'
$dshCmd = Get-Command dsh -ErrorAction SilentlyContinue
if ($dshCmd) {
  try {
    $dump = & dsh --profile $Profile --dump-config 2>&1 | Out-String
    if ($dump -match [regex]::Escape($PackageName)) {
      Write-Ok '配置树里已含本插件'
    } else {
      Write-Warn2 '配置树里没看到本插件，请检查 package.json'
    }
  } catch {
    Write-Warn2 "dsh --dump-config 校验失败（不影响安装）：$($_.Exception.Message)"
  }
} else {
  Write-Warn2 'PATH 里没有 dsh 命令，跳过配置校验（不影响安装）'
}

Write-Host ''
Write-Host '安装完成。' -ForegroundColor Green
Write-Host ''
Write-Host '下一步：' -ForegroundColor White
Write-Host '  1. 完全退出 DeepSeek Harness（包括托盘图标）'
Write-Host '  2. 重新打开'
Write-Host '  3. 在对话输入框右侧应能看到「上下文 xx / xx  |  等级」控件'
Write-Host ''
Write-Host "卸载：.\install.ps1 -Profile $Profile -Uninstall" -ForegroundColor DarkGray
