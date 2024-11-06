const socket = io();
    let logicalClock = Date.now();
    const offset = Math.floor(Math.random() * 1000) - 500; // Genera un desfase aleatorio

    // Función para incrementar el reloj lógico y actualizar en pantalla
    function updateLogicalClock() {
      logicalClock += 1000 + offset;
      document.getElementById('clock').textContent = new Date(logicalClock).toLocaleTimeString();
      socket.emit('updateTime', { offset }); // Envía el offset al coordinador
      setTimeout(updateLogicalClock, 1000); // Llama a la función cada segundo
    }

    // Llama a la función de actualización de reloj lógico al cargar la página
    updateLogicalClock();

    // Escuchar ajustes de tiempo del coordinador
    socket.on('adjustTime', (adjustment) => {
      logicalClock += adjustment;
      console.log(`Reloj ajustado por: ${adjustment} ms, nuevo reloj lógico: ${new Date(logicalClock).toLocaleTimeString()}`);
    });

    // Recibir y mostrar logs de sincronización en pantalla
    socket.on('updateLogs', (logs) => {
      const logsList = document.getElementById('logs');
      logsList.innerHTML = ''; // Limpia la lista antes de agregar nuevos logs
      logs.forEach(log => {
        const li = document.createElement('li');
        li.textContent = log;
        logsList.appendChild(li);
      });
    });