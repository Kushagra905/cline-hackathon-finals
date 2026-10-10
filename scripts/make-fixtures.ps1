# Generates two clearly labelled SYNTHETIC loan screenshots (PNG) for the Milestone 0 SDK spike.
# No real lender, person or account is depicted. Usage: npm run fixtures:make
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'fixtures'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-Fixture([string]$path, [string[]]$lines, [string]$banner) {
  $bmp = New-Object System.Drawing.Bitmap 900, 560
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::White)
  $bannerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 200, 40, 40))
  $g.FillRectangle($bannerBrush, 0, 0, 900, 44)
  $white = [System.Drawing.Brushes]::White
  $black = [System.Drawing.Brushes]::Black
  $bannerFont = New-Object System.Drawing.Font 'Arial', 15, ([System.Drawing.FontStyle]::Bold)
  $titleFont = New-Object System.Drawing.Font 'Arial', 24, ([System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font 'Arial', 20
  $g.DrawString($banner, $bannerFont, $white, 16, 10)
  $y = 70
  $first = $true
  foreach ($line in $lines) {
    if ($first) { $g.DrawString($line, $titleFont, $black, 24, $y); $y += 56; $first = $false }
    else { $g.DrawString($line, $bodyFont, $black, 24, $y); $y += 44 }
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$rupee = [string][char]0x20B9

New-Fixture (Join-Path $outDir 'offer-synthetic.png') @(
  'QuickCash Demo - Loan Offer',
  "Get an instant loan. We credit $($rupee)9,500 to your bank account.",
  'Repayment: single payment at the end of the term.',
  'Apply now. Terms apply.'
) 'SYNTHETIC TEST FIXTURE - NOT A REAL LENDER - OFFER'

New-Fixture (Join-Path $outDir 'final-terms-synthetic.png') @(
  'QuickCash Demo - Key Facts Statement',
  "Loan principal: $($rupee)10,000",
  "Charges withheld at disbursal: $($rupee)2,000",
  "Net amount credited to your account: $($rupee)8,000",
  "Total repayment: $($rupee)10,500",
  'Repayment: one payment, 30 days after disbursal.'
) 'SYNTHETIC TEST FIXTURE - NOT A REAL LENDER - FINAL TERMS'

New-Fixture (Join-Path $outDir 'final-terms-missing-net-synthetic.png') @(
  'QuickCash Demo - Key Facts Statement',
  "Loan amount: $($rupee)10,000",
  "Total repayment: $($rupee)10,500",
  'Repayment: one payment, 30 days after disbursal.',
  'Net amount credited: not stated in this document.'
) 'SYNTHETIC TEST FIXTURE - NOT A REAL LENDER - FINAL TERMS (NET CREDIT NOT STATED)'

Write-Output "Wrote fixtures to $outDir"
