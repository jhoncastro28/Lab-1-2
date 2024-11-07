let socket;
let logicalClock = Date.now();
let offset = Math.floor(Math.random() * 1000) - 500;
let previousOffset = offset; // Variable para almacenar el offset anterior

// Función para mostrar mensajes en la interfaz
function addLogMessage(message) {
  const logsList = document.getElementById('logs');
  const li = document.createElement('li');
  li.textContent = message;
  logsList.appendChild(li);
}

// Función para conectar manualmente al coordinador
function connectToCoordinator() {
  if (!socket || socket.disconnected) {
    socket = io('http://localhost:3000');
    addLogMessage('Conectado al coordinador');

    // Escuchar ajustes del coordinador
    socket.on('adjustTime', (adjustment) => {
      offset += adjustment;
      const logMessage = `Reloj ajustado por: ${adjustment} ms, nuevo offset: ${offset}`;
      addLogMessage(logMessage);
    });

    // Inicia el reloj lógico después de conectarse
    updateLogicalClock();
  } else {
    addLogMessage('Ya está conectado al coordinador');
  }
}

// Función para actualizar el reloj lógico y enviar el offset cuando cambia significativamente
function updateLogicalClock() {
  logicalClock += 1000; // Incrementa en 1 segundo (1000 ms)
  document.getElementById('clock').textContent = new Date(logicalClock).toLocaleTimeString(); // Muestra el tiempo actualizado

  // Solo enviar actualización si hay un cambio significativo
  const threshold = 100; // Umbral de cambio para enviar el offset
  if (socket && socket.connected && Math.abs(offset - previousOffset) > threshold) {
    socket.emit('updateTime', { offset }); // Envía el offset solo si hay un cambio significativo
    previousOffset = offset; // Actualiza el valor del offset previo
  }

  setTimeout(updateLogicalClock, 5000); // Llama de nuevo en 5 segundos (puedes ajustar este valor)
}

// Exportar la función al ámbito global para que el botón pueda accederla
window.connectToCoordinator = connectToCoordinator;
