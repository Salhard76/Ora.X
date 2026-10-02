#!/usr/bin/env python3
# Ora X · 𝑺𝒂𝒍𝑯𝒂𝒓𝒅
# Rigenera tutte le icone con la scritta "v<versione>" partendo da icon-512.png.
# Uso: python3 genera-icone.py [versione]   (default: contenuto di version.txt)
# Richiede Pillow e numpy. Se mancano (o manca il font) avvisa ed esce senza toccare nulla.
import sys, os, math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RES = ROOT / "android/app/src/main/res"
BG = (27, 79, 167, 255)
FONTS = [
    os.environ.get("ORAX_FONT", ""),
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSansMono-Bold.ttf",
    "/Library/Fonts/DejaVuSansMono-Bold.ttf",
    "C:/Windows/Fonts/DejaVuSansMono-Bold.ttf",
]


def main():
    version = (sys.argv[1] if len(sys.argv) > 1 else (ROOT / "version.txt").read_text()).strip()
    try:
        from PIL import Image, ImageDraw, ImageFont
        import numpy as np
    except ImportError:
        print("AVVISO: Pillow/numpy non installati, icone non rigenerate (pip install pillow numpy)")
        return 0
    font_path = next((f for f in FONTS if f and Path(f).is_file()), None)
    if not font_path:
        print("AVVISO: font DejaVuSansMono-Bold non trovato (variabile ORAX_FONT), icone non rigenerate")
        return 0

    txt = "v" + version
    base = Image.open(ROOT / "icon-512.png").convert("RGBA")

    # 1) icon-512: copre la scritta precedente e scrive quella nuova (stessa posizione e dimensione)
    im = base.copy()
    ImageDraw.Draw(im).rectangle([100, 40, 412, 112], fill=BG)
    size = 53
    f = ImageFont.truetype(font_path, size)
    bb = f.getbbox(txt)
    w = bb[2] - bb[0]
    while w > 300 and size > 20:               # versioni lunghe: riduce il corpo per restare nel riquadro
        size -= 1
        f = ImageFont.truetype(font_path, size)
        bb = f.getbbox(txt)
        w = bb[2] - bb[0]
    ImageDraw.Draw(im).text((256 - w // 2 - bb[0], 56 - bb[1]), txt, font=f, fill=(255, 255, 255, 255))
    im.save(ROOT / "icon-512.png")

    # 2) 192 e maskable (contenuto all'80%: zona sicura PWA)
    im.resize((192, 192), Image.LANCZOS).save(ROOT / "icon-192.png")

    def maskable(n):
        canvas = Image.new("RGBA", (n, n), BG)
        k = int(n * 0.80)
        canvas.alpha_composite(im.resize((k, k), Image.LANCZOS), ((n - k) // 2, (n - k) // 2))
        return canvas

    maskable(512).save(ROOT / "icon-512-maskable.png")
    maskable(192).save(ROOT / "icon-192-maskable.png")

    # 3) mipmap legacy (Android < 8; su 8+ vale l'icona adattiva)
    for dpi, n in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        r = im.resize((n, n), Image.LANCZOS)
        r.save(RES / f"mipmap-{dpi}/ic_launcher.png")
        r.save(RES / f"mipmap-{dpi}/ic_launcher_round.png")

    # 4) foreground adattivo 432x432: quadrante+fulmine+tricolore estratti dall'icona + testo nuovo
    bgc = np.array(BG[:3], dtype=float)
    grp = np.array(im.convert("RGB").crop((107, 131, 404, 422))).astype(float)
    a = np.clip((np.abs(grp - bgc).sum(axis=2) - 12) / 45.0, 0, 1)
    col = np.zeros_like(grp)
    nz = a > 0
    col[nz] = (grp[nz] - (1 - a[nz, None]) * bgc) / a[nz, None]
    g = Image.fromarray(np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8), "RGBA")
    g = g.resize((round(g.width * 0.56), round(g.height * 0.56)), Image.LANCZOS)
    fs = 1
    while True:
        b2 = ImageFont.truetype(font_path, fs + 1).getbbox(txt)
        if b2[2] - b2[0] > 150:
            break
        fs += 1
    ft = ImageFont.truetype(font_path, fs)
    tb = ft.getbbox(txt)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    gap = 4
    top = (432 - (th + gap + g.height)) // 2
    fg = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
    ImageDraw.Draw(fg).text((216 - tw // 2 - tb[0], top - tb[1]), txt, font=ft, fill=(255, 255, 255, 255))
    fg.alpha_composite(g, (216 - g.width // 2, top + th + gap))
    fg.save(RES / "drawable-nodpi/icon_foreground.png")

    # 5) sagoma monocromatica (icone a tema Android 13+)
    al = np.array(fg.split()[3]).astype(float)
    m = np.clip((al - 120) * 3, 0, 255).astype(np.uint8)
    mono = np.zeros((432, 432, 4), dtype=np.uint8)
    mono[:, :, :3] = 255
    mono[:, :, 3] = m
    Image.fromarray(mono, "RGBA").save(RES / "drawable-nodpi/icon_monochrome.png")

    ys, xs = np.where(m > 8)
    dist = max(math.hypot(x - 216, y - 216) for y, x in zip(ys[::5], xs[::5]))
    if dist > 132:
        print(f"AVVISO: contenuto icona oltre la zona sicura ({dist:.0f} > 132)")
    print(f"OK: icone rigenerate con '{txt}'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
