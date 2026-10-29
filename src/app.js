import express from 'express';
import { engine } from 'express-handlebars';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(__dirname, '..');

const app = express();
const server = createServer(app);
const io = new Server(server);
const PORT = 8080;

// Handlebars
app.engine('handlebars', engine({ partialsDir: path.join(raiz, 'views', 'partials') }));
app.set('view engine', 'handlebars');
app.set('views', path.join(raiz, 'views'));

app.use(express.static(path.join(raiz, 'public')));

// Mensajes en memoria (solo para probar el front)
const mensajes = [];

app.get('/', (req, res) => {
  res.render('chat', {
    title: 'Chat en vivo',
    conectados: io.engine.clientsCount,
    mensajes: mensajes.map(m => ({ ...m, inicial: m.nombre[0].toUpperCase() }))
  });
});

io.on('connection', (socket) => {
  io.emit('chat:conectados', io.engine.clientsCount);

  socket.on('chat:mensaje', (data) => {
    const msg = { ...data, id: socket.id };
    mensajes.push(msg);
    io.emit('chat:mensaje', msg); // a TODOS, incluido quien lo escribe
  });

  // "Fulano está escribiendo..." a todos menos a quien escribe
  socket.on('chat:escribiendo', (nombre) => socket.broadcast.emit('chat:escribiendo', nombre));

  socket.on('disconnect', () => io.emit('chat:conectados', io.engine.clientsCount));
});

server.listen(PORT, () => console.log(`Chat en http://localhost:${PORT}`));
