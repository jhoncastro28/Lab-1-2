require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const Docker = require('dockerode');
const cors = require('cors'); // Importa el paquete cors

const { Client } = require('ssh2');
const usedPorts = []; // Para evitar puertos duplicados

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

function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  logs.push(`[${timestamp}] ${message}`);
  io.emit('updateLogs', logs);
}

function getRandomPort(min, max, usedPorts) {
  let port;
  do {
    port = Math.floor(Math.random() * (max - min + 1)) + min;
  } while (usedPorts.includes(port));
  return port;
}

app.post('/launch', (req, res) => {
  const { SSH_HOST, SSH_USER, SSH_PASSWORD } = process.env;
  const connection = new Client();

  connection.on('ready', () => {
    console.log("Cliente SSH conectado");
    const randomPort = getRandomPort(5000, 6000, usedPorts);
    const dockerCommand = `sudo docker run -d -p ${randomPort}:${randomPort} --name client_${randomPort} -e PORT=${randomPort} imagen`;

    connection.exec(dockerCommand, (err, stream) => {
      if (err) {
        console.error(`Error ejecutando el comando Docker: ${err.message}`);
        connection.end();
        return res.status(500).send('Error ejecutando el comando Docker');
      }

      stream.on('close', (code, signal) => {
        console.log(`Instancia lanzada en puerto: ${randomPort}`);
        usedPorts.push(randomPort);
        connection.end();
        res.status(200).send(`Instancia lanzada en puerto: ${randomPort}`);
      }).on('data', (data) => {
        console.log(`STDOUT: ${data}`);
      }).stderr.on('data', (data) => {
        console.error(`STDERR: ${data}`);
      });
    });
  }).on('error', (err) => {
    console.error(`Error de conexión: ${err.message}`);
    res.status(500).send('Error de conexión SSH');
  }).connect({
    host: SSH_HOST,
    port: 22,
    username: SSH_USER,
    password: SSH_PASSWORD,
  });
});

// Iniciar servidor del coordinador
server.listen(COORDINATOR_PORT, () => {
  console.log(`Coordinador ejecutándose en el puerto ${COORDINATOR_PORT}`);
});