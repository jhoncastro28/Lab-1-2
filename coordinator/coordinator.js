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

app.use(express.static('.'));

io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);
  
  clients[socket.id] = { id: socket.id, offset: 0 };
  logs.push(`Cliente conectado: ${socket.id}`);
  
  io.emit('updateClients', clients);
  io.emit('updateLogs', logs);

  socket.on('updateTime', (data) => {
    clients[socket.id].offset = data.offset;
    logs.push(`Cliente ${socket.id} envió su tiempo con offset: ${data.offset}`);
    io.emit('updateLogs', logs);
  });

  socket.on('disconnect', () => {
    logs.push(`Cliente desconectado: ${socket.id}`);
    delete clients[socket.id];
    io.emit('updateClients', clients);
    io.emit('updateLogs', logs);
  });
});

async function syncTime() {
  try {
    const { data } = await axios.get('https://worldtimeapi.org/api/timezone/Etc/UTC');
    const externalTime = new Date(data.utc_datetime).getTime();
    let offsets = [];
    for (const clientId in clients) {
      offsets.push(clients[clientId].offset);
    }
    
    const averageOffset = offsets.reduce((acc, cur) => acc + cur, 0) / offsets.length;

    for (const clientId in clients) {
      const adjustment = averageOffset - clients[clientId].offset;
      io.to(clientId).emit('adjustTime', adjustment);
      logs.push(`Ajuste enviado al cliente ${clientId}: ${adjustment}`);
    }

    io.emit('updateLogs', logs);
  } catch (error) {
    console.error('Error al obtener la hora externa:', error);
  }
}

app.get('/sync', (req, res) => {
  syncTime();
  res.send('Sincronización ejecutada');
});

app.get('/create-client', async (req, res) => {
  try {
    const container = await docker.createContainer({
      Image: 'cliente-berkeley', // Imagen Docker del cliente
      ExposedPorts: { '4000/tcp': {} },
      HostConfig: {
        PortBindings: { '4000/tcp': [{ HostPort: '' }] } // Docker asigna un puerto dinámico
      }
    });
    await container.start();
    logs.push(`Nueva instancia de cliente creada: ${container.id}`);
    io.emit('updateLogs', logs);
    res.send('Cliente creado');
  } catch (error) {
    console.error('Error al crear el cliente:', error);
    res.status(500).send('Error al crear el cliente');
  }
});

server.listen(3000, () => {
  console.log('Coordinador ejecutándose en el puerto 3000');
});
