$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$tectonic = Join-Path $env:LOCALAPPDATA 'Programs\tectonic\tectonic.exe'
$pandoc = Join-Path $env:LOCALAPPDATA 'Programs\pandoc-3.11\pandoc.exe'
$source = 'panduan-penggunaan-pos-soswir.tex'

& $tectonic -X compile $source

if (Test-Path $pandoc) {
  & $pandoc $source --from latex --to docx `
    --lua-filter docx.lua `
    --reference-doc reference.docx `
    --resource-path . `
    --toc --toc-depth=2 --number-sections `
    -M title='Panduan Penggunaan POS Soswir' `
    -M subtitle='Cara memakai aplikasi kasir Soswir untuk pemilik toko dan kasir.' `
    -M date='Versi November 2026' `
    -M toc-title='Daftar isi' `
    -M lang=id-ID `
    -o panduan-penggunaan-pos-soswir.docx
}

Write-Output 'Selesai: panduan-penggunaan-pos-soswir.pdf dan panduan-penggunaan-pos-soswir.docx'
