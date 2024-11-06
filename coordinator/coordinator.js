require('dotenv').config()
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
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const { data } = await axios.get(process.env.TIME_API_URL, { timeout: 5000 });
      const externalTime = new Date(data.dateTime).getTime(); // timeapi.io utiliza 'dateTime'

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
      return; // Éxito, salir de la función
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        logEvent(`Error al obtener la hora externa después de ${attempts} intentos: ${error.message}`);
      } else {
        logEvent(`Intento ${attempts} fallido. Reintentando...`);
      }
    }
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
        PortBindings: { '4000/tcp': [{ HostPort: '0' }] } // Asignación de puerto dinámica
      }
    });
    await container.start();

    // Obtener el puerto asignado dinámicamente
    const containerInfo = await container.inspect();
    const hostPort = containerInfo.NetworkSettings.Ports['4000/tcp'][0].HostPort;

    logEvent(`Nueva instancia de cliente creada: ${container.id} en el puerto ${hostPort}`);
    io.emit('updateLogs', logs); // Actualización en tiempo real

    res.send(`Cliente creado con ID: ${container.id} en el puerto ${hostPort}`);
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
