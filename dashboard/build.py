"""Builds public/index.html (and optionally a standalone artifact.html) from this folder's template + scripts.
Run from the dashboard/ folder:  python3 build.py            -> writes ../public/index.html
                                 python3 build.py --artifact -> also writes artifact.html (offline copy with engine + chart lib inlined)
Works in the flat repo layout (../public, ../replay) and in the older nested layout (../server/public, ../data)."""
import os, sys
here = os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
def first(*paths):
    for p in paths:
        if os.path.exists(p): return p
    raise SystemExit('missing: ' + ' or '.join(paths))
rd = lambda p: open(p, encoding='utf-8').read()
t = rd('template.html'); labui = rd('labui.js'); pro = rd('pro.js'); app = rd('app.js')
pub = first('../public', '../server/public')
want_artifact = '--artifact' in sys.argv
if want_artifact:
    eng = rd(first('../engine.js', '../server/engine.js'))
    lwc = rd(first(pub + '/vendor/lightweight-charts.js'))
    ind = rd(first('../replay/indices_replay.json', '../data/indices_replay.json'))
def build(server):
    s = t.replace('/*__LABUI__*/', labui if server else '')
    s = s.replace('/*__PRO__*/', pro if server else '')
    s = s.replace('/*__APP__*/', app if server else '')
    s = s.replace('/*__SERVER_FLAG__*/false', 'true' if server else 'false')
    s = s.replace('/*__ENGINE__*/', '' if server else eng.replace('</script>', '<\\/script>'))
    s = s.replace('<!--PWA-->', '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#1a1a19"><link rel="apple-touch-icon" href="icon-192.png"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">' if server else '')
    s = s.replace('<!--LWC-->', '<script src="vendor/lightweight-charts.js"></script>' if server else '<script>' + lwc.replace('</script>', '<\\/script>') + '</script>')
    s = s.replace('/*__INDIA__*/null', 'null' if server else ind)
    return s
out = build(True)
open(pub + '/index.html', 'w', encoding='utf-8').write(out)
print('built', pub + '/index.html', len(out))
if want_artifact:
    a = build(False); open('artifact.html', 'w', encoding='utf-8').write(a); print('built artifact.html', len(a))
