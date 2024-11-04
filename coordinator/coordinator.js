const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios'); // Para obtener la hora de la API

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let clients = {}; // Guardará los clientes conectados y sus tiempos de desfase
let logs = []; // Almacenará los eventos del sistema

app.use(express.static('public'));

// Conexión con clientes
io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);
  
  // Guardar cliente
  clients[socket.id] = { id: socket.id, offset: 0 };
  logs.push(`Cliente conectado: ${socket.id}`);
  
  // Enviar lista de clientes y logs
  io.emit('updateClients', clients);
  io.emit('updateLogs', logs);

  // Escuchar mensajes de clientes para actualización de tiempos
  socket.on('updateTime', (data) => {
    clients[socket.id].offset = data.offset;
    logs.push(`Cliente ${socket.id} envió su tiempo con offset: ${data.offset}`);
    io.emit('updateLogs', logs);
  });

  // Desconexión de cliente
  socket.on('disconnect', () => {
    logs.push(`Cliente desconectado: ${socket.id}`);
    delete clients[socket.id];
    io.emit('updateClients', clients);
    io.emit('updateLogs', logs);
  });
});

// Método para ejecutar el Algoritmo de Berkeley
async function syncTime() {
  try {
    const { data } = await axios.get('https://worldtimeapi.org/api/timezone/Etc/UTC');
    const externalTime = new Date(data.utc_datetime).getTime();

    // Solicitar la hora de cada cliente
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

server.listen(3000, () => {
  console.log('Coordinador ejecutándose en el puerto 3000');
});
