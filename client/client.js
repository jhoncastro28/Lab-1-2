const express = require('express');
const http = require('http');
const socketIo = require('socket.io-client');

const app = express();
const port = 4000;
let socket; // Inicializa sin conexión

let logicalClock = Date.now();
let offset = Math.floor(Math.random() * 1000) - 500;

app.use(express.static('public'));

// Función para conectar manualmente al coordinador
function connectToCoordinator() {
  socket = socketIo('http://localhost:3000'); // Conectar al coordinador manualmente

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
