require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const Docker = require('dockerode');
const cors = require('cors'); // Importa el paquete cors

const app = express();
app.use(cors()); // Habilita CORS para todos los orígenes

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Permite todas las conexiones de origen
    methods: ['GET', 'POST']
  }
});
const docker = new Docker();

const TIME_API_URL = process.env.TIME_API_URL;
const COORDINATOR_PORT = process.env.COORDINATOR_PORT || 3000;
const DOCKER_IMAGE = process.env.DOCKER_IMAGE;

let clients = {}; // Guardar datos de cada cliente conectado
let logs = []; // Guardar los logs de eventos

app.use(express.static('public'));

// Manejo de la conexión de clientes
io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);
  clients[socket.id] = { id: socket.id, offset: 0 };
  logEvent(`Cliente conectado: ${socket.id}`);

  io.emit('updateClients', clients);
  io.emit('updateLogs', logs);

  // Escuchar tiempos de los clientes
  socket.on('updateTime', (data) => {
    clients[socket.id].offset = data.offset;
    logEvent(`Cliente ${socket.id} envió su tiempo con offset: ${data.offset}`);
    io.emit('updateLogs', logs);
  });

  // Cuando un cliente se desconecta
  socket.on('disconnect', () => {
    logEvent(`Cliente desconectado: ${socket.id}`);
    delete clients[socket.id];
    io.emit('updateClients', clients);
    io.emit('updateLogs', logs);
  });
});

// Sincronización de tiempo manual
app.get('/sync', async (req, res) => {
  try {
    const { data } = await axios.get(TIME_API_URL);
    const externalTime = new Date(data.dateTime).getTime();

    // Calcular promedio de tiempos (coordinador + clientes)
    let totalOffsets = externalTime;
    let clientCount = 1;

    for (const clientId in clients) {
      totalOffsets += clients[clientId].offset;
      clientCount++;
    }

    const averageOffset = totalOffsets / clientCount;

    // Ajuste del tiempo en cada cliente
    for (const clientId in clients) {
      const clientOffset = clients[clientId].offset;
      const adjustment = averageOffset - clientOffset;
      io.to(clientId).emit('adjustTime', adjustment);
      logEvent(`Ajuste enviado al cliente ${clientId}: ${adjustment}`);
    }

    res.send('Sincronización de tiempo ejecutada');
  } catch (error) {
    logEvent(`Error al obtener la hora externa: ${error.message}`);
    res.status(500).send('Error al sincronizar el tiempo');
  }
});

// Crear contenedor de cliente manualmente
app.get('/create-client', async (req, res) => {
  try {
    const container = await docker.createContainer({
      Image: DOCKER_IMAGE,
      ExposedPorts: { '4000/tcp': {} },
      HostConfig: {
        PortBindings: { '4000/tcp': [{ HostPort: '0' }] }
      }
    });
    await container.start();

    const containerInfo = await container.inspect();
    const hostPort = containerInfo.NetworkSettings.Ports['4000/tcp'][0].HostPort;

    logEvent(`Nueva instancia de cliente creada: ${container.id} en el puerto ${hostPort}`);
    io.emit('updateLogs', logs);

    res.send(`Cliente creado con ID: ${container.id} en el puerto ${hostPort}`);
  } catch (error) {
    logEvent(`Error al crear el cliente: ${error.message}`);
    res.status(500).send('Error al crear el cliente');
  }
});

function logEvent(eventTitle, message) {
  const timestamp = new Date().toLocaleTimeString();
  logs.push({ time: timestamp, event: eventTitle, detail: message });
  io.emit('updateLogs', logs); // Envía los logs actualizados a los clientes
}

// Llama a logEvent dentro del evento 'connection'
io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);
  clients[socket.id] = { id: socket.id, offset: 0 };
  
  // Pasa los detalles como parámetros
  logEvent("Conexión de cliente", `Cliente conectado: ${socket.id}`);
  
  io.emit('updateClients', clients);
  io.emit('updateLogs', logs);

  // Escuchar tiempos de los clientes
  socket.on('updateTime', (data) => {
    clients[socket.id].offset = data.offset;
    logEvent("Actualización de tiempo", `Cliente ${socket.id} envió su tiempo con offset: ${data.offset}`);
    io.emit('updateLogs', logs);
  });

  // Cuando un cliente se desconecta
  socket.on('disconnect', () => {
    logEvent("Desconexión de cliente", `Cliente desconectado: ${socket.id}`);
    delete clients[socket.id];
    io.emit('updateClients', clients);
    io.emit('updateLogs', logs);
  });
});


// Iniciar servidor del coordinador
server.listen(COORDINATOR_PORT, () => {
  console.log(`Coordinador ejecutándose en el puerto ${COORDINATOR_PORT}`);
});