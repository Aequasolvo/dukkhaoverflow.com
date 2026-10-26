// =====================================================================
// dukkhaoverflow.com: lo común a todas las páginas (estado del servidor, cuenta regresiva, formularios) y ayudantes
// para las páginas que leen la API pública del juego (/publico/*, sin cuenta).
// Lo que depende de la API ([data-requiere-api]) queda escondido hasta que la API responde: así, si el backend no
// está o se cae, la web no muestra secciones rotas.
// =====================================================================
const API = 'https://api.dukkhaoverflow.com';

const Dukkha = {
  // fetch con tiempo límite. Devuelve el JSON o lanza un error
  async api(ruta, opciones = {}) {
    const control = new AbortController();
    const t = setTimeout(() => control.abort(), opciones.tiempo || 9000);
    try {
      const r = await fetch(API + ruta, Object.assign({ signal: control.signal }, opciones));
      const datos = await r.json().catch(() => null);
      if (!r.ok && !(datos && datos.error)) throw new Error('HTTP ' + r.status);
      return Object.assign({ _status: r.status }, datos || {});
    } finally { clearTimeout(t); }
  },
  esc(t) {
    return String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  num(n) { return Number(n || 0).toLocaleString('es-CL'); },
  // 754 -> "12:34"; 3725 -> "1:02:05"
  duracion(seg) {
    seg = Math.max(0, Math.round(Number(seg) || 0));
    const h = Math.floor(seg / 3600), m = Math.floor(seg % 3600 / 60), s = seg % 60;
    const dos = (x) => String(x).padStart(2, '0');
    return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
  },
  hace(fecha) {
    const min = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} días`;
  },
  nombre(n) {
    return n ? `<a href="/perfil/?n=${encodeURIComponent(n)}">${Dukkha.esc(n)}</a>` : '<span class="anonimo">Alma anónima</span>';
  },
  parametro(clave) { return new URLSearchParams(location.search).get(clave); },
  apiLista: null
};

// --- ¿Responde la API? Muestra lo que depende de ella ---
Dukkha.apiLista = Dukkha.api('/publico/config', { tiempo: 6000 }).then((c) => {
  document.documentElement.classList.add('api-ok');
  document.querySelectorAll('[data-requiere-api]').forEach(e => { e.hidden = false; });
  document.querySelectorAll('[data-sin-api]').forEach(e => { e.hidden = true; });
  return c;
}).catch(() => null);

// --- Estado del servidor en la barra ---
async function pintarEstado() {
  const pildoras = document.querySelectorAll('.estado-pildora');
  if (!pildoras.length) return;
  try {
    const e = await Dukkha.api('/publico/estado', { tiempo: 6000 });
    const total = (e.jugadores ? (e.jugadores.lobby || 0) + (e.jugadores.arenas || 0) : 0);
    pildoras.forEach(p => {
      p.classList.toggle('en-linea', !!e.en_linea);
      p.classList.toggle('caido', !e.en_linea);
      p.querySelector('span').textContent = e.en_linea ? (total > 0 ? `En línea · ${total} jugando` : 'Servidores en línea') : 'Servidores caídos';
    });
  } catch (err) {
    pildoras.forEach(p => { p.hidden = true; });
  }
}

// --- Cuenta regresiva: <span data-cuenta-regresiva="2027-12-01T00:00:00-03:00"> ---
function pintarCuentas() {
  document.querySelectorAll('[data-cuenta-regresiva]').forEach(e => {
    const meta = new Date(e.dataset.cuentaRegresiva).getTime();
    const dias = Math.ceil((meta - Date.now()) / 86400000);
    e.textContent = dias > 1 ? `${Dukkha.num(dias)} días` : dias === 1 ? '1 día' : 'ya';
  });
}

// --- Formularios: <form data-formulario="bug"> con campos name="correo|nombre|texto|acepto|datos.xxx" ---
let turnstileCargado = null;
async function prepararTurnstile(form, sitekey) {
  const caja = form.querySelector('.turnstile');
  if (!caja || !sitekey) return;
  if (!turnstileCargado) {
    turnstileCargado = new Promise((ok) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.onload = ok; document.head.appendChild(s);
    });
  }
  await turnstileCargado;
  form._turnstile = window.turnstile.render(caja, { sitekey, theme: 'dark' });
}
function prepararFormularios() {
  document.querySelectorAll('form[data-formulario]').forEach(form => {
    Dukkha.apiLista.then(c => { if (c) prepararTurnstile(form, c.turnstile_sitekey); });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const salida = form.querySelector('.respuesta');
      const boton = form.querySelector('button[type=submit]');
      const cuerpo = { tipo: form.dataset.formulario, idioma: document.documentElement.lang === 'pt' ? 'pt_BR' : (document.documentElement.lang || 'es'), datos: {} };
      for (const el of form.elements) {
        if (!el.name) continue;
        const v = el.type === 'checkbox' ? el.checked : el.value.trim();
        if (el.name.startsWith('datos.')) { if (v !== '') cuerpo.datos[el.name.slice(6)] = v; }
        else cuerpo[el.name] = v;
      }
      if (form._turnstile !== undefined && window.turnstile) cuerpo.turnstile = window.turnstile.getResponse(form._turnstile);
      boton.disabled = true;
      salida.className = 'respuesta'; salida.textContent = 'Enviando…';
      try {
        const r = await Dukkha.api('/publico/formulario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
        if (r.success) {
          salida.className = 'respuesta ok';
          salida.textContent = form.dataset.gracias || 'Recibido. ¡Gracias!';
          form.reset();
        } else {
          salida.className = 'respuesta mal';
          salida.textContent = r.error || 'No se pudo enviar.';
        }
      } catch (err) {
        salida.className = 'respuesta mal';
        salida.textContent = 'No pudimos conectar con el servidor. Prueba más tarde o escríbenos a contacto@dukkhaoverflow.com.';
      } finally {
        boton.disabled = false;
        if (form._turnstile !== undefined && window.turnstile) window.turnstile.reset(form._turnstile);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  pintarEstado();
  pintarCuentas();
  prepararFormularios();
  setInterval(pintarEstado, 60000);
});
