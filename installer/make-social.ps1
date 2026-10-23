param([string]$Out)
Add-Type -AssemblyName System.Drawing
$W = 1280; $H = 640
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
$g.Clear([System.Drawing.Color]::FromArgb(255, 6, 6, 9))

function Glow($cx, $cy, $rx, $ry, $a, $r, $gr, $b) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $p.AddEllipse($cx - $rx, $cy - $ry, $rx * 2, $ry * 2)
  $br = New-Object System.Drawing.Drawing2D.PathGradientBrush $p
  $br.CenterColor = [System.Drawing.Color]::FromArgb($a, $r, $gr, $b)
  $br.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $r, $gr, $b))
  $g.FillPath($br, $p)
}
Glow 260 120 700 420 120 10 132 255
Glow 1100 600 760 380 90 120 70 230

$res = "E:\mpc-be-titulky\stremio-mod\installer\res"
$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile("$res\Inter-Regular.ttf"); $pfc.AddFontFile("$res\Inter-SemiBold.ttf")
$semi = $pfc.Families | Where-Object { $_.Name -like '*Semi*' } | Select-Object -First 1
$reg = $pfc.Families | Where-Object { $_.Name -notlike '*Semi*' } | Select-Object -First 1
if (-not $semi) { $semi = $reg }
function Txt($s, $fam, $size, $x, $y, $color) {
  $f = New-Object System.Drawing.Font $fam, $size, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $b = New-Object System.Drawing.SolidBrush $color
  $g.DrawString($s, $f, $b, $x, $y)
}
function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90); $p.CloseFigure(); $p
}

# glass card
$card = RoundRect 70 70 1140 500 36
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(26, 255, 255, 255))), $card)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(48, 255, 255, 255)), 2), $card)

# icon
$ico = [System.Drawing.Image]::FromFile("E:\mpc-be-titulky\stremio-mod\stremio-web\assets\images\icon_512x512.png")
$g.DrawImage($ico, 130, 150, 190, 190)

Txt 'Lumen' $semi 150 340 120 ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
Txt 'A dark, glassy movie & series player' $reg 38 346 310 ([System.Drawing.Color]::FromArgb(190, 255, 255, 255))
Txt 'for Windows with automatic HDR.' $reg 38 346 358 ([System.Drawing.Color]::FromArgb(190, 255, 255, 255))

# pills
$x = 130
foreach ($t in @('Automatic HDR', 'Torrents + direct links', 'No accounts, no telemetry')) {
  $f = New-Object System.Drawing.Font $semi, 24, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $w = [int]$g.MeasureString($t, $f).Width + 44
  $pill = RoundRect $x 460 $w 60 30
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(36, 255, 255, 255))), $pill)
  $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 255, 255, 255)), 2), $pill)
  Txt $t $semi 24 ($x + 22) 474 ([System.Drawing.Color]::FromArgb(255, 235, 235, 245))
  $x += $w + 16
}
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
