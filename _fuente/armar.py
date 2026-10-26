# =====================================================================
# _fuente/armar.py: arma las páginas de dukkhaoverflow.com
# =====================================================================
# Cada página está en _fuente/paginas/<ruta>.html (sin cabecera ni pie) y empieza con una línea de datos:
#   <!--{"titulo": "Clasificación", "descripcion": "...", "menu": "clasificacion"}-->
# Este script le pone la cabecera, la barra, el pie y los recursos comunes, y la deja en <ruta>/index.html
# ("inicio" va a index.html y "404" a 404.html). GitHub Pages no publica las carpetas que empiezan con "_".
#
#   python3 _fuente/armar.py
#
# El Códice (_fuente/paginas/codice.html) y la página legal se generan aparte desde el repositorio del juego
# (herramientas/web_codice.py y herramientas/web_legal.py).
import json, os, re, html

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINAS = os.path.join(RAIZ, "_fuente", "paginas")
SITIO = "https://dukkhaoverflow.com"
VERSION_RECURSOS = "20261027b"

MENU = [
    ("inicio", "/", "Inicio"),
    ("clasificacion", "/clasificacion/", "Clasificación", True),
    ("caidos", "/caidos/", "Muro de caídos", True),
    ("trajes", "/trajes/", "Trajes"),
    ("codice", "/codice/", "Códice"),
    ("novedades", "/novedades/", "Novedades"),
    ("soporte", "/soporte/", "Soporte"),
    ("prensa", "/prensa/", "Prensa"),
]


def barra(activa):
    enlaces = []
    for item in MENU:
        clave, href, texto = item[0], item[1], item[2]
        requiere = len(item) > 3 and item[3]
        actual = ' aria-current="page"' if clave == activa else ""
        extra = " data-requiere-api hidden" if requiere else ""
        enlaces.append(f'<a href="{href}"{actual}{extra}>{texto}</a>')
    return f"""<nav class="barra" aria-label="Principal">
  <div class="envoltura">
    <a class="marca" href="/">DUKKHA <b>OVERFLOW</b></a>
    <div class="menu">{''.join(enlaces)}</div>
    <a class="estado-pildora" href="/estado/" data-requiere-api hidden title="Estado de los servidores"><i></i><span>Servidores…</span></a>
  </div>
</nav>"""


PIE = """<footer class="envoltura pie">
  <div class="filas">
    <span>Contacto: <span class="correo">contacto@dukkhaoverflow.com</span></span>
    <a href="/soporte/">Soporte</a>
    <a href="/prensa/">Prensa y creadores</a>
    <a href="/estado/">Estado de los servidores</a>
    <a href="/legal/">Privacidad y términos</a>
  </div>
  <p>© 2026 Dukkha Overflow. Steam y su logo son marcas de Valve Corporation.</p>
</footer>"""


def pagina(datos, cuerpo, ruta):
    titulo = datos["titulo"]
    titulo_completo = "Dukkha Overflow" if ruta == "inicio" else f"{titulo} · Dukkha Overflow"
    url = SITIO + ("/" if ruta == "inicio" else f"/{ruta}/")
    imagen = SITIO + datos.get("imagen", "/img/hero.jpg")
    robots = '\n<meta name="robots" content="noindex">' if datos.get("noindex") else ""
    scripts = "".join(f'\n<script src="{s}?v={VERSION_RECURSOS}" defer></script>' for s in datos.get("scripts", []))
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(titulo_completo)}</title>
<meta name="description" content="{html.escape(datos['descripcion'])}">
<meta property="og:title" content="{html.escape(titulo_completo)}">
<meta property="og:description" content="{html.escape(datos['descripcion'])}">
<meta property="og:image" content="{imagen}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{url}">{robots}
<link rel="icon" href="/img/icono.png">
<link rel="apple-touch-icon" href="/img/icono-apple.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/recursos/sitio.css?v={VERSION_RECURSOS}">
<script src="/recursos/sitio.js?v={VERSION_RECURSOS}" defer></script>{scripts}
</head>
<body>
{barra(datos.get('menu', ''))}
{cuerpo.strip()}

{PIE}
</body>
</html>
"""


def main():
    rutas = []
    for nombre in sorted(os.listdir(PAGINAS)):
        if not nombre.endswith(".html"):
            continue
        ruta = nombre[:-5]
        with open(os.path.join(PAGINAS, nombre), encoding="utf-8") as f:
            texto = f.read()
        m = re.match(r"\s*<!--(\{.*?\})-->\s*\n", texto, re.S)
        if not m:
            raise SystemExit(f"{nombre}: falta la línea de datos")
        datos = json.loads(m.group(1))
        if ruta == "inicio":
            destino = os.path.join(RAIZ, "index.html")
        elif ruta == "404":
            destino = os.path.join(RAIZ, "404.html")  # GitHub Pages la muestra para toda dirección que no existe
        else:
            destino = os.path.join(RAIZ, ruta, "index.html")
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, "w", encoding="utf-8") as f:
            f.write(pagina(datos, texto[m.end():], ruta))
        if not datos.get("noindex"):
            rutas.append("/" if ruta == "inicio" else f"/{ruta}/")
        print("ok", destino[len(RAIZ) + 1:])
    rutas.append("/legal/")
    with open(os.path.join(RAIZ, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for r in rutas:
            f.write(f"  <url><loc>{SITIO}{r}</loc></url>\n")
        f.write("</urlset>\n")


if __name__ == "__main__":
    main()
