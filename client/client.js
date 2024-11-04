const express = require('express');
const http = require('http');
const socketIo = require('socket.io-client');

const app = express();
const port = 4000;
const socket = socketIo('http://localhost:3000'); // Conectar al coordinador

let logicalClock = Date.now();
let offset = Math.floor(Math.random() * 1000) - 500;

app.use(express.static('.'));

// Incrementa el reloj lógico y envía el tiempo al coordinador
function updateLogicalClock() {
  logicalClock += 1000 + offset;
  socket.emit('updateTime', { offset });
  setTimeout(updateLogicalClock, 1000);
}

// Escuchar ajustes del coordinador
socket.on('adjustTime', (adjustment) => {
  offset += adjustment;
  console.log(`Reloj ajustado por: ${adjustment} ms, nuevo offset: ${offset}`);
});

// Iniciar el reloj lógico
updateLogicalClock();

app.listen(port, () => {
  console.log(`Cliente ejecutándose en el puerto ${port}`);
});
