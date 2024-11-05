const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const Docker = require('dockerode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const docker = new Docker(); // Inicializa Docker para crear contenedores

let clients = {};
let logs = [];

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);

  clients[socket.id] = { id: socket.id, offset: 0 };
  logEvent(`Cliente conectado: ${socket.id}`);

  io.emit('updateClients', clients);
  io.emit('updateLogs', logs);

  socket.on('updateTime', (data) => {
    clients[socket.id].offset = data.offset;
    logEvent(`Cliente ${socket.id} envió su tiempo con offset: ${data.offset}`);
    io.emit('updateLogs', logs);
  });

  socket.on('disconnect', () => {
    logEvent(`Cliente desconectado: ${socket.id}`);
    delete clients[socket.id];
    io.emit('updateClients', clients);
    io.emit('updateLogs', logs);
  });
});

async function syncTime() {
  try {
    const { data } = await axios.get(process.env.TIME_API_URL); // Asegúrate de tener TIME_API_URL en tu .env
    const externalTime = new Date(data.datetime).getTime();

    let offsets = [];
    for (const clientId in clients) {
      offsets.push(clients[clientId].offset);
    }

    const averageOffset = offsets.reduce((acc, cur) => acc + cur, externalTime) / (offsets.length + 1);

    for (const clientId in clients) {
      const adjustment = averageOffset - clients[clientId].offset;
      io.to(clientId).emit('adjustTime', adjustment);
      logEvent(`Ajuste enviado al cliente ${clientId}: ${adjustment}`);
    }
  } catch (error) {
    logEvent(`Error al obtener la hora externa: ${error.message}`);
  }
}

app.get('/sync', (req, res) => {
  syncTime();
  res.send('Sincronización ejecutada');
});

app.get('/create-client', async (req, res) => {
  try {
    const container = await docker.createContainer({
      Image: 'cliente-berkeley',
      ExposedPorts: { '4000/tcp': {} },
      HostConfig: {
        PortBindings: { '4000/tcp': [{ HostPort: '' }] } // Asignación de puerto dinámica
      }
    });
    await container.start();

    logEvent(`Nueva instancia de cliente creada: ${container.id}`);
    io.emit('updateLogs', logs); // Actualización en tiempo real
    res.send(`Cliente creado con ID: ${container.id}`);
  } catch (error) {
    console.error('Error al crear el cliente:', error);
    logEvent(`Error al crear el cliente: ${error.message}`);
    io.emit('updateLogs', logs);
    res.status(500).send('Error al crear el cliente');
  }
});

function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  logs.push(`[${timestamp}] ${message}`);
  io.emit('updateLogs', logs);
}

server.listen(3000, () => {
  console.log('Coordinador ejecutándose en el puerto 3000');
});
