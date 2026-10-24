# Vyrobí ikonu (mipmap) a banner pro Android TV z loga rozhraní. Spustit jednou po změně loga.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$images = Join-Path $root '..\stremio-web\assets\images'
$res = Join-Path $root 'app\src\main\res'

function New-Canvas([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 18, 24, 38)), ([System.Drawing.Color]::FromArgb(255, 6, 8, 14)), 90
    $g.FillRectangle($brush, $rect)
    return @($bmp, $g)
}

# banner 320x180 (xhdpi): logo s nápisem uprostřed
$logo = [System.Drawing.Image]::FromFile((Join-Path $images 'logo.png'))
$bmp, $g = New-Canvas 320 180
$lw = 250; $lh = [int]($logo.Height * $lw / $logo.Width)
$g.DrawImage($logo, [int]((320 - $lw) / 2), [int]((180 - $lh) / 2), $lw, $lh)
New-Item -ItemType Directory -Force (Join-Path $res 'drawable-xhdpi') | Out-Null
$bmp.Save((Join-Path $res 'drawable-xhdpi\banner.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $logo.Dispose()

# ikona: koule na tmavém pozadí
$icon = [System.Drawing.Image]::FromFile((Join-Path $images 'icon.png'))
foreach ($d in @(@('mipmap-mdpi', 48), @('mipmap-hdpi', 72), @('mipmap-xhdpi', 96), @('mipmap-xxhdpi', 144), @('mipmap-xxxhdpi', 192))) {
    $size = $d[1]
    $bmp, $g = New-Canvas $size $size
    $g.DrawImage($icon, 0, 0, $size, $size)
    New-Item -ItemType Directory -Force (Join-Path $res $d[0]) | Out-Null
    $bmp.Save((Join-Path $res "$($d[0])\ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
$icon.Dispose()
'icons ok'
