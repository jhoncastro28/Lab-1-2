let socket;
let logicalClock = Date.now();
let offset = Math.floor(Math.random() * 1000) - 500;
let previousOffset = offset;

// Función para agregar mensajes en la tabla de logs
function addLogMessage(event, detail) {
  const logsTable = document.getElementById('logs');
  const row = document.createElement('tr');

  const timeCell = document.createElement('td');
  timeCell.textContent = new Date().toLocaleTimeString();

  const eventCell = document.createElement('td');
  eventCell.textContent = event;

  const detailCell = document.createElement('td');
  detailCell.textContent = detail;

  row.appendChild(timeCell);
  row.appendChild(eventCell);
  row.appendChild(detailCell);
  logsTable.appendChild(row);
}

// Función para conectar manualmente al coordinador
function connectToCoordinator() {
  if (!socket || socket.disconnected) {
    socket = io('http://localhost:3000');
    addLogMessage('Conexión', 'Conectado al coordinador');

    // Escuchar ajustes del coordinador
    socket.on('adjustTime', (adjustment) => {
      offset += adjustment;
      logicalClock = Date.now() + offset;
      const logMessage = `Reloj ajustado por: ${adjustment} ms, nuevo offset: ${offset}`;
      addLogMessage('Ajuste de Reloj', logMessage);
      updateLogicalClockDisplay();
    });

    // Inicia el reloj lógico después de conectarse
    updateLogicalClock();
  } else {
    addLogMessage('Conexión', 'Ya está conectado al coordinador');
  }
}

// Función para actualizar el reloj lógico y enviar el offset cuando cambia significativamente
function updateLogicalClock() {
  logicalClock += 1000;
  updateLogicalClockDisplay();

  const threshold = 100;
  if (socket && socket.connected && Math.abs(offset - previousOffset) > threshold) {
    socket.emit('updateTime', { offset });
    addLogMessage('Sincronización', `Offset enviado al coordinador: ${offset}`);
    previousOffset = offset;
  }

  setTimeout(updateLogicalClock, 1000);
}

// Función para actualizar la visualización del reloj lógico
function updateLogicalClockDisplay() {
  document.getElementById('clock').textContent = new Date(logicalClock).toLocaleTimeString();
}

window.connectToCoordinator = connectToCoordinator;
