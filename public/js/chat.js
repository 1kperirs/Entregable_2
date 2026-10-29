// Front del chat: envía con socket.io y pinta lo que llega (propio y de los demás)
const socket = io();

const form = document.getElementById('formChat');
const inputNombre = document.getElementById('nombre');
const inputPublicidad = document.getElementById('publicidad');
const inputMensaje = document.getElementById('mensaje');
const btnEnviar = document.getElementById('btnEnviar');
const lista = document.getElementById('listaMensajes');
const contador = document.getElementById('contador');
const escribiendo = document.getElementById('escribiendo');
const escribiendoTexto = document.getElementById('escribiendoTexto');
const btnBajar = document.getElementById('btnBajar');
const nuevos = document.getElementById('nuevos');
const btnEmoji = document.getElementById('btnEmoji');
const panelEmojis = document.getElementById('panelEmojis');
const btnTema = document.getElementById('btnTema');
const plantilla = Handlebars.compile(document.getElementById('tplMensaje').innerHTML);

const LIMITE = Number(inputMensaje.maxLength);
const EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '😢', '👍', '👏', '🙏', '🔥', '🎉', '❤️', '✨', '💯', '🚀', '👀', '✅', '☕'];

// localStorage puede fallar (modo privado), así que lo envolvemos
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch {} };
const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };

// Recordar el nombre del usuario
inputNombre.value = leer('chatNombre') || '';

// ---------- Tema claro / oscuro ----------
btnTema.addEventListener('click', () => {
  const actual = document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nuevo = actual === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  guardar('chatTema', nuevo);
});

// ---------- Helpers de mensajes ----------
// Color estable por nombre: el mismo usuario siempre tiene el mismo tono
const tonoDe = (nombre) => {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
};

const estaAbajo = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
const irAbajo = () => { lista.scrollTop = lista.scrollHeight; };

// Da color, marca propios y agrupa mensajes seguidos del mismo autor
const decorar = (li) => {
  const autor = li.dataset.autor;
  li.style.setProperty('--hue', tonoDe(autor));
  if (autor === inputNombre.value.trim()) li.classList.add('msg--propio');
  const anterior = li.previousElementSibling;
  if (anterior?.classList.contains('msg') && anterior.dataset.autor === autor) {
    li.classList.add('msg--seguido');
  }
};

// Mensajes que vinieron renderizados del servidor
lista.querySelectorAll('.msg[data-autor]').forEach(decorar);
irAbajo();

const horaActual = () =>
  new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

let sinLeer = 0;
const pintarMensaje = (data) => {
  document.getElementById('vacio')?.remove();
  const propio = data.id === socket.id;
  const seguirAbajo = propio || estaAbajo();

  lista.insertAdjacentHTML('beforeend', plantilla({
    ...data,
    propio,
    inicial: data.nombre.charAt(0).toUpperCase()
  }));
  decorar(lista.lastElementChild);

  if (seguirAbajo) {
    irAbajo();
  } else {
    sinLeer++;
    nuevos.textContent = sinLeer;
    nuevos.hidden = false;
    btnBajar.hidden = false;
  }
  if (!propio) ocultarEscribiendo();
};

// ---------- Botón "ir abajo" ----------
lista.addEventListener('scroll', () => {
  if (estaAbajo()) {
    btnBajar.hidden = true;
    sinLeer = 0;
    nuevos.hidden = true;
  } else {
    btnBajar.hidden = false;
  }
});
btnBajar.addEventListener('click', irAbajo);

// ---------- Caja de texto ----------
const actualizarCaja = () => {
  // Crece con el contenido hasta el max-height del CSS
  inputMensaje.style.height = 'auto';
  inputMensaje.style.height = inputMensaje.scrollHeight + 'px';

  const largo = inputMensaje.value.length;
  contador.textContent = largo > LIMITE * 0.8 ? `${largo}/${LIMITE}` : '';
  contador.classList.toggle('chat__contador--limite', largo >= LIMITE);

  btnEnviar.disabled = !inputMensaje.value.trim() || !inputNombre.value.trim();
};
inputMensaje.addEventListener('input', actualizarCaja);
inputNombre.addEventListener('input', actualizarCaja);
actualizarCaja();

// Avisar a los demás que estoy escribiendo (como mucho cada 1,5 s)
let ultimoAviso = 0;
inputMensaje.addEventListener('input', () => {
  const nombre = inputNombre.value.trim();
  if (!nombre || Date.now() - ultimoAviso < 1500) return;
  ultimoAviso = Date.now();
  socket.emit('chat:escribiendo', nombre);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = inputNombre.value.trim();
  const mensaje = inputMensaje.value.trim();
  if (!nombre || !mensaje) {
    (nombre ? inputMensaje : inputNombre).focus();
    return;
  }

  guardar('chatNombre', nombre);

  socket.emit('chat:mensaje', {
    nombre,
    publicidad: inputPublicidad.value.trim(),
    mensaje,
    hora: horaActual()
  });

  inputMensaje.value = '';
  ultimoAviso = 0;
  actualizarCaja();
  inputMensaje.focus();
});

// Enter envía, Shift+Enter hace salto de línea
inputMensaje.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// ---------- Emojis ----------
panelEmojis.innerHTML = EMOJIS.map(em => `<button type="button">${em}</button>`).join('');

const mostrarEmojis = (abrir) => {
  panelEmojis.hidden = !abrir;
  btnEmoji.setAttribute('aria-expanded', abrir);
};
btnEmoji.addEventListener('click', () => mostrarEmojis(panelEmojis.hidden));

panelEmojis.addEventListener('click', (e) => {
  const boton = e.target.closest('button');
  if (!boton) return;
  const { selectionStart: ini, selectionEnd: fin, value } = inputMensaje;
  inputMensaje.value = value.slice(0, ini) + boton.textContent + value.slice(fin);
  inputMensaje.selectionStart = inputMensaje.selectionEnd = ini + boton.textContent.length;
  actualizarCaja();
  inputMensaje.focus();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.emojis')) mostrarEmojis(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') mostrarEmojis(false);
});

// ---------- "Fulano está escribiendo..." ----------
let temporizador;
const ocultarEscribiendo = () => {
  clearTimeout(temporizador);
  escribiendo.hidden = true;
};
socket.on('chat:escribiendo', (nombre) => {
  const abajo = estaAbajo();
  escribiendoTexto.textContent = `${nombre} está escribiendo…`;
  escribiendo.hidden = false;
  if (abajo) irAbajo();
  clearTimeout(temporizador);
  temporizador = setTimeout(ocultarEscribiendo, 2500);
});

// ---------- Socket ----------
// El servidor reenvía a TODOS (incluido quien lo escribió)
socket.on('chat:mensaje', pintarMensaje);
socket.on('chat:conectados', (n) => {
  document.getElementById('conectados').textContent = n;
});

// Estado de la conexión en el header
const estado = document.getElementById('estado');
const punto = document.getElementById('punto');
const textoEstado = estado.textContent;
socket.on('connect', () => {
  estado.textContent = textoEstado;
  punto.classList.remove('punto--off');
});
socket.on('disconnect', () => {
  estado.textContent = 'Sin conexión · reconectando…';
  punto.classList.add('punto--off');
});
