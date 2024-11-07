const socket = io();

// Actualizar lista de clientes en la interfaz
socket.on('updateClients', (clients) => {
  const clientsList = document.getElementById('clients');
  clientsList.innerHTML = '';
  for (const id in clients) {
    const li = document.createElement('li');
    li.textContent = `Cliente ${id} - Offset: ${clients[id].offset}`;
    clientsList.appendChild(li);
  }
});

// Actualizar logs en la interfaz
socket.on('connect', () => {
  console.log("Conectado al servidor");
});

socket.on('updateLogs', (logs) => {
  console.log("Evento updateLogs recibido", logs); // Verifica que los logs llegan al cliente
  const logsList = document.getElementById('logs');

  // Limpia la tabla antes de actualizar
  logsList.innerHTML = '';

  logs.forEach(log => {
    const row = document.createElement('tr');

    const timeCell = document.createElement('td');
    timeCell.textContent = log.time;
    row.appendChild(timeCell);

    const eventCell = document.createElement('td');
    eventCell.textContent = log.event;
    row.appendChild(eventCell);

    const detailCell = document.createElement('td');
    detailCell.textContent = log.detail;
    row.appendChild(detailCell);

    logsList.appendChild(row);
  });
});


// Crear cliente al hacer clic en el botón
function createClient() {
  fetch('/create-client')
    .then(response => response.text())
    .then(data => {
      console.log(data);
      alert(data); // Muestra el ID del cliente y el puerto en una alerta
    })
    .catch(error => console.error('Error creando cliente:', error));
}

// Ejecutar sincronización de tiempo al hacer clic en el botón
function syncTime() {
  fetch('/sync')
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al sincronizar');
      }
      return response.text();
    })
    .then(data => {
      console.log('Sincronización exitosa:', data);
    })
    .catch(error => console.error('Error sincronizando:', error));
}
