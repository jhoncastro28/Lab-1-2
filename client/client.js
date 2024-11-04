const io = require('socket.io-client');
const socket = io('http://localhost:3000'); // Conectar al coordinador

let logicalClock = Date.now(); // Reloj lógico inicial
let offset = Math.floor(Math.random() * 1000) - 500; // Desfase aleatorio (positivo o negativo)

// Función para incrementar el reloj lógico con desfase
function updateLogicalClock() {
  logicalClock += 1000 + offset; // Incrementar cada segundo con desfase
  socket.emit('updateTime', { offset });
  setTimeout(updateLogicalClock, 1000);
}

// Actualizar el reloj con el ajuste recibido
socket.on('adjustTime', (adjustment) => {
  offset += adjustment;
  console.log(`Reloj ajustado por: ${adjustment} ms, nuevo offset: ${offset}`);
});

// Iniciar el reloj lógico
updateLogicalClock();
