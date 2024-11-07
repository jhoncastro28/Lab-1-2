let socket;
let logicalClock = Date.now();
let offset = Math.floor(Math.random() * 1000) - 500;

// Función para conectar manualmente al coordinador
function connectToCoordinator() {
  if (!socket || socket.disconnected) {
    socket = io('http://localhost:3000');
    console.log('Conectado al coordinador');

    // Escuchar ajustes del coordinador
    socket.on('adjustTime', (adjustment) => {
      offset += adjustment;
      console.log(`Reloj ajustado por: ${adjustment} ms, nuevo offset: ${offset}`);
    });

    // Inicia el reloj lógico después de conectarse
    updateLogicalClock();
  } else {
    console.log('Ya está conectado al coordinador');
  }
}

// Función para actualizar el reloj lógico y enviar el offset
function updateLogicalClock() {
  logicalClock += 1000; // Incrementa en 1 segundo (1000 ms)
  socket.emit('updateTime', { offset }); // Envía el offset correctamente
  setTimeout(updateLogicalClock, 1000); // Llama de nuevo en un segundo
}

// Exportar la función al ámbito global para que el botón pueda accederla
window.connectToCoordinator = connectToCoordinator;