require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io-client');

const app = express();
const CLIENT_PORT = process.env.CLIENT_PORT || 4000;
const COORDINATOR_URL = `http://localhost:${process.env.COORDINATOR_PORT || 3000}`;
const socket = socketIo(COORDINATOR_URL); 

let logicalClock = Date.now();
let offset = Math.floor(Math.random() * 1000) - 500;

app.use(express.static('public'));

function updateLogicalClock() {
  logicalClock += 1000 + offset;
  socket.emit('updateTime', { offset });
  setTimeout(updateLogicalClock, 1000);
}

socket.on('adjustTime', (adjustment) => {
  offset += adjustment;
  console.log(`Reloj ajustado por: ${adjustment} ms, nuevo offset: ${offset}`);
});

updateLogicalClock();

app.listen(CLIENT_PORT, () => {
  console.log(`Cliente ejecutándose en el puerto ${CLIENT_PORT}`);
});
