// Barras Battle: página de avance. Beats, visor de capturas y lista de correo.
// La lista de correo usa la misma API que dukkhaoverflow.com (/publico/formulario, tipo "correo"),
// marcada con datos.canal = "barras-battle" para separarla de la de Dukkha en el panel.
const API = 'https://api.dukkhaoverflow.com';

// --- Beats: uno sonando a la vez ---
(() => {
  const audio = new Audio();
  audio.preload = 'none';
  let actual = null;
  const parar = () => {
    if (!actual) return;
    actual.classList.remove('sonando');
    actual.setAttribute('aria-pressed', 'false');
    const barra = actual.querySelector('.progreso');
    if (barra) barra.style.width = '0';
    actual = null;
  };
  document.querySelectorAll('.beat').forEach(boton => {
    boton.setAttribute('aria-pressed', 'false');
    boton.insertAdjacentHTML('beforeend', '<span class="progreso"></span>');
    boton.addEventListener('click', () => {
      if (actual === boton) { audio.pause(); parar(); return; }
      parar();
      actual = boton;
      boton.classList.add('sonando');
      boton.setAttribute('aria-pressed', 'true');
      audio.src = boton.dataset.audio;
      audio.play().catch(parar);
    });
  });
  audio.addEventListener('timeupdate', () => {
    if (actual && audio.duration) actual.querySelector('.progreso').style.width = (audio.currentTime / audio.duration * 100) + '%';
  });
  audio.addEventListener('ended', parar);
})();

// --- Visor de capturas ---
(() => {
  const visor = document.getElementById('visor');
  if (!visor || !visor.showModal) return;
  const img = visor.querySelector('img');
  document.querySelectorAll('.foto').forEach(f => f.addEventListener('click', () => {
    img.src = f.dataset.grande;
    img.alt = f.querySelector('img').alt;
    visor.showModal();
  }));
  visor.addEventListener('click', () => visor.close());
})();

// --- Lista de correo ---
(() => {
  const form = document.getElementById('form-aviso');
  if (!form) return;
  const respuesta = form.querySelector('.respuesta');
  const boton = form.querySelector('button[type=submit]');
  let widget;
  const decir = (texto, clase) => { respuesta.textContent = texto; respuesta.className = 'respuesta ' + (clase || ''); };

  // Si el servidor pide Turnstile (anti bots), se carga solo
  fetch(API + '/publico/config').then(r => r.json()).then(c => {
    const clave = c && (c.turnstile_sitekey || (c.config && c.config.turnstile_sitekey));
    if (!clave) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = () => { widget = window.turnstile.render(form.querySelector('.turnstile'), { sitekey: clave, theme: 'dark' }); };
    document.head.appendChild(s);
  }).catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = form.correo.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { decir('Revisa tu correo.', 'error'); form.correo.focus(); return; }
    if (!form.acepto.checked) { decir('Marca la casilla para recibir correos.', 'error'); return; }
    const cuerpo = { tipo: 'correo', correo, acepto: true, idioma: 'es', sitio_web: form.sitio_web.value, datos: { canal: 'barras-battle' } };
    if (widget !== undefined && window.turnstile) cuerpo.turnstile = window.turnstile.getResponse(widget);
    boton.disabled = true;
    decir('Enviando…');
    try {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), 12000);
      const r = await fetch(API + '/publico/formulario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: control.signal });
      clearTimeout(reloj);
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) { form.reset(); decir('Listo: te avisaremos. Revisa que el correo no caiga en spam.', 'ok'); }
      else decir(d.error || 'No se pudo enviar. Prueba más tarde.', 'error');
    } catch (_) {
      decir('No se pudo enviar. Prueba más tarde.', 'error');
    } finally {
      boton.disabled = false;
      if (widget !== undefined && window.turnstile) window.turnstile.reset(widget);
    }
  });
})();
