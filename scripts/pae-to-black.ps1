Add-Type -AssemblyName System.Drawing
$inputPath = Join-Path $PSScriptRoot '..\apps\web\public\logos\operators\pae.png'
$bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $inputPath))
$out = New-Object System.Drawing.Bitmap $bitmap.Width, $bitmap.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($out)
$graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$dark = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
for ($y = 0; $y -lt $bitmap.Height; $y++) {
  for ($x = 0; $x -lt $bitmap.Width; $x++) {
    $pixel = $bitmap.GetPixel($x, $y)
    $luminance = 0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B
    if ($luminance -gt 40) {
      $out.SetPixel($x, $y, $dark)
    }
  }
}
$graphics.Dispose()
$bitmap.Dispose()
$out.Save($inputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()
Write-Host 'PAE converted to black on transparent'
