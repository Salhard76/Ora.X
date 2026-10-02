#!/bin/sh
# Ora X · 𝑺𝒂𝒍𝑯𝒂𝒓𝒅
# Sorgente unica della versione: version.txt. Uso: ./sync-www.sh
# Richiede python3. Se node e' installato controlla anche la sintassi dei JS (service worker incluso).
set -eu
cd "$(dirname "$0")"
VERSION=$(tr -d '[:space:]' < version.txt)
case "$VERSION" in ''|*[!0-9.]*|.*|*.|*..*) echo "ERRORE: version.txt non valido: '$VERSION'" >&2; exit 1;; esac
VF=$(printf '%s' "$VERSION" | tr . -)
D=android/app/src/main/assets/www
mkdir -p "$D"
# Icone: la scritta "v<versione>" viene riscritta in tutte le icone (serve Pillow + numpy + font DejaVu Sans Mono Bold).
if [ -f genera-icone.py ]; then
  python3 genera-icone.py "$VERSION" || echo "AVVISO: icone non rigenerate" >&2
fi
python3 - "$VERSION" <<'PY'
from pathlib import Path
import json, re, sys
v=sys.argv[1]; vf=v.replace('.', '-')
SIG='𝑺𝒂𝒍𝑯𝒂𝒓𝒅'
root=Path('.')
D=root/'android/app/src/main/assets/www'
J=root/'android/app/src/main/java/com/orax/app/MainActivity.java'
G=root/'android/build.gradle'; GA=root/'android/app/build.gradle'
def source(pattern, current):
    current_path=root/current
    if current_path.exists(): return current_path
    files=sorted(root.glob(pattern), key=lambda p:p.stat().st_mtime)
    if not files: raise SystemExit(f'ERRORE: sorgente mancante: {pattern}')
    return files[-1]
def sub(text, pattern, repl, count=0):
    return re.sub(pattern, repl, text, count=count, flags=re.M)

app_src=source('app-*.js', f'app-{vf}.js')
style_src=source('style-*.css', f'style-{vf}.css')
manifest_src=source('manifest-*.json', f'manifest-{vf}.json')

# --- JS applicativo
app=app_src.read_text(encoding='utf-8')
app=re.sub(r'(\|\| ")\d+(?:\.\d+)*("; \} catch \{ return ")\d+(?:\.\d+)*(";? \})', lambda m: m.group(1)+v+m.group(2)+v+m.group(3), app, count=1)
app=re.sub(r'Ora X [0-9]+(?:\.[0-9]+)*', 'Ora X '+v, app)
(root/f'app-{vf}.js').write_text(app, encoding='utf-8')
(root/f'style-{vf}.css').write_text(sub(style_src.read_text(encoding='utf-8'), r'(/\* Ora X )\d+(?:\.\d+)*( · )', lambda m: m.group(1)+v+m.group(2)), encoding='utf-8')
mtext=manifest_src.read_text(encoding='utf-8'); json.loads(mtext)   # manifest valido o si ferma qui
(root/f'manifest-{vf}.json').write_text(mtext, encoding='utf-8')

# --- index.html
index=(root/'index.html').read_text(encoding='utf-8')
index=re.sub(r'app-[0-9-]+\.js', f'app-{vf}.js', index)
index=re.sub(r'style-[0-9-]+\.css', f'style-{vf}.css', index)
index=re.sub(r'manifest-[0-9-]+\.json', f'manifest-{vf}.json', index)
index=re.sub(r'Ora X · v[0-9.]+', f'Ora X · v{v}', index)
index=re.sub(r'(<strong id="infoVersione">)[0-9.]+(</strong>)', lambda m: m.group(1)+v+m.group(2), index)
index=re.sub(r'(<!-- Ora X )\d+(?:\.\d+)*( · )', lambda m: m.group(1)+v+m.group(2), index)
index=re.sub(r'(icon-192\.png\?v=)[0-9.]+', lambda m: m.group(1)+v, index)
(root/'index.html').write_text(index, encoding='utf-8')

# --- service worker
sw=(root/'service-worker.js').read_text(encoding='utf-8')
sw=re.sub(r'const CACHE = "orax-[0-9.-]+";', f'const CACHE = "orax-{v}";', sw)
sw=re.sub(r'app-[0-9-]+\.js', f'app-{vf}.js', sw)
sw=re.sub(r'style-[0-9-]+\.css', f'style-{vf}.css', sw)
sw=re.sub(r'manifest-[0-9-]+\.json', f'manifest-{vf}.json', sw)
sw=re.sub(r'(/\* Ora X )\d+(?:\.\d+)*( · )', lambda m: m.group(1)+v+m.group(2), sw)
(root/'service-worker.js').write_text(sw, encoding='utf-8')

# --- Android: fallback di versione e commenti di firma (Java, Gradle, risorse)
if J.exists():
    t=J.read_text(encoding='utf-8')
    t=re.sub(r'(catch \(Exception e\) \{ return ")\d+(?:\.\d+)*(";)', lambda m: m.group(1)+v+m.group(2), t)
    t=re.sub(r'(// Ora X )\d+(?:\.\d+)*( · )', lambda m: m.group(1)+v+m.group(2), t)
    J.write_text(t, encoding='utf-8')
if GA.exists():
    t=GA.read_text(encoding='utf-8')
    t=re.sub(r"(\.trim\(\) : ')\d+(?:\.\d+)*(')", lambda m: m.group(1)+v+m.group(2), t)
    t=re.sub(r"(appVersion = ')\d+(?:\.\d+)*(')", lambda m: m.group(1)+v+m.group(2), t)
    t=re.sub(r'(// Ora X )\d+(?:\.\d+)*( · )', lambda m: m.group(1)+v+m.group(2), t)
    GA.write_text(t, encoding='utf-8')
wb=root/'android/app/src/main/res/drawable/window_bg.xml'
if wb.exists():
    wb.write_text(re.sub(r'(Ora X )\d+(?:\.\d+)*( · )', lambda m: m.group(1)+v+m.group(2), wb.read_text(encoding='utf-8')), encoding='utf-8')
readmes=sorted(root.glob('README-*.txt'))
if len(readmes)==1 and readmes[0].name!=f'README-{v}.txt':
    readmes[0]=readmes[0].rename(root/f'README-{v}.txt')
for r in root.glob('README-*.txt'):
    t=r.read_text(encoding='utf-8')
    t=re.sub(r'^(Versione: )\d+(?:\.\d+)*', lambda m: m.group(1)+v, t, flags=re.M)
    r.write_text(t, encoding='utf-8')

# --- rimuove versioni vecchie dalla root e rigenera gli asset Android
keep={f'app-{vf}.js',f'style-{vf}.css',f'manifest-{vf}.json'}
for pattern in ('app-*.js','style-*.css','manifest-*.json'):
    for f in root.glob(pattern):
        if f.name not in keep: f.unlink()
copy=[f'app-{vf}.js',f'style-{vf}.css',f'manifest-{vf}.json','index.html','service-worker.js','icon-192.png','icon-512.png','icon-192-maskable.png','icon-512-maskable.png']
for name in copy:
    if not (root/name).is_file(): raise SystemExit(f'ERRORE: file mancante: {name}')
for f in D.iterdir():
    if f.is_file(): f.unlink()
for name in copy:
    (D/name).write_bytes((root/name).read_bytes())

# --- controlli di coerenza (fermano lo script se qualcosa non torna)
errs=[]
cache=re.findall(r'"\./([^"]+)"', re.search(r'const FILES = \[(.*?)\];', sw, re.S).group(1))
for name in cache:
    if name and not (root/name).is_file(): errs.append(f'service worker: file in cache inesistente: {name}')
for a,b in [('index.html', f'app-{vf}.js'), ('index.html', f'style-{vf}.css'), ('index.html', f'manifest-{vf}.json'), ('service-worker.js', f'app-{vf}.js')]:
    if b not in (root/a).read_text(encoding='utf-8'): errs.append(f'{a} non riferisce {b}')
if f'orax-{v}' not in sw: errs.append('service worker: nome cache non allineato')
if errs:
    raise SystemExit('ERRORE:\n  '+'\n  '.join(errs))
# la firma deve restare nei file principali (solo avviso)
for f in [root/f'app-{vf}.js', root/'service-worker.js', root/'index.html', root/f'style-{vf}.css', J] + list(root.glob('README-*.txt')):
    if f.exists() and SIG not in f.read_text(encoding='utf-8'):
        print(f'AVVISO: firma {SIG} assente in {f}')
PY
if command -v node >/dev/null 2>&1; then
  node --check service-worker.js || { echo "ERRORE: service-worker.js non valido" >&2; exit 1; }
  node --check "app-$VF.js"      || { echo "ERRORE: app-$VF.js non valido" >&2; exit 1; }
  echo "OK: sintassi JS verificata (node)"
else
  echo "AVVISO: node non trovato, sintassi JS non verificata" >&2
fi
echo "OK: Ora X v$VERSION sincronizzata"
