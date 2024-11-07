const express = require('express');
const http = require('http');
const socketIo = require('socket.io-client');
require('dotenv').config();

const app = express();
const port = 4000;
let socket;

let logicalClock = Date.now();
let offset = process.env.INITIAL_OFFSET ? parseInt(process.env.INITIAL_OFFSET) : Math.floor(Math.random() * 1000) - 500;

const coordinatorHost = process.env.COORDINATOR_HOST || 'localhost';
const coordinatorPort = process.env.COORDINATOR_PORT || '3000';

app.use(express.static('public'));

// Función para conectar manualmente al coordinador
function connectToCoordinator() {
  if (!socket || socket.disconnected) {
    socket = socketIo(`http://${coordinatorHost}:${coordinatorPort}`);

    // Escuchar ajustes del coordinador
    socket.on('adjustTime', (adjustment) => {
      offset += adjustment;
      console.log(`Reloj ajustado por: ${adjustment} ms, nuevo offset: ${offset}`);
    });

    console.log('Conectado al coordinador');

    // Inicia el reloj lógico
    updateLogicalClock();
  }
}

// Incrementa el reloj lógico y envía el offset al coordinador
function updateLogicalClock() {
  logicalClock += 1000;
  socket.emit('updateTime', { offset }); // Envía el offset correctamente
  setTimeout(updateLogicalClock, 1000); // Llama de nuevo en un segundo
}

// Ruta para conectar manualmente
app.get('/connect', (req, res) => {
  if (!socket || socket.disconnected) {
    connectToCoordinator();
    res.send('Conectado al coordinador');
  } else {
    res.send('Ya está conectado al coordinador');
  }
});

app.listen(port, () => {
  console.log(`Cliente ejecutándose en el puerto ${port}`);
});