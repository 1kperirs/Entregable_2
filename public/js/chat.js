// Front del chat: envía con socket.io y pinta lo que llega (propio y de los demás)
const socket = io();

const form = document.getElementById('formChat');
const inputNombre = document.getElementById('nombre');
const inputPublicidad = document.getElementById('publicidad');
const inputMensaje = document.getElementById('mensaje');
const lista = document.getElementById('listaMensajes');
const plantilla = Handlebars.compile(document.getElementById('tplMensaje').innerHTML);

// Recordar el nombre del usuario
inputNombre.value = localStorage.getItem('chatNombre') || '';

// Marcar como propios los mensajes que vinieron renderizados del servidor
const marcarPropios = () => {
  lista.querySelectorAll('.msg[data-autor]').forEach(li => {
    if (li.dataset.autor === inputNombre.value.trim()) li.classList.add('msg--propio');
  });
};
marcarPropios();
lista.scrollTop = lista.scrollHeight;

const horaActual = () =>
  new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

const pintarMensaje = (data) => {
  document.getElementById('vacio')?.remove();
  const propio = data.id === socket.id;
  lista.insertAdjacentHTML('beforeend', plantilla({
    ...data,
    propio,
    inicial: data.nombre.charAt(0).toUpperCase()
  }));
  lista.scrollTop = lista.scrollHeight;
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = inputNombre.value.trim();
  const mensaje = inputMensaje.value.trim();
  if (!nombre || !mensaje) return;

  localStorage.setItem('chatNombre', nombre);

  socket.emit('chat:mensaje', {
    nombre,
    publicidad: inputPublicidad.value.trim(),
    mensaje,
    hora: horaActual()
  });

  inputMensaje.value = '';
  inputMensaje.focus();
});

// Enter envía, Shift+Enter hace salto de línea
inputMensaje.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// El servidor reenvía a TODOS (incluido quien lo escribió)
socket.on('chat:mensaje', pintarMensaje);
socket.on('chat:conectados', (n) => {
  document.getElementById('conectados').textContent = n;
});
