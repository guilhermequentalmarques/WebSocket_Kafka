let socket;

function conectarWebSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log("WebSocket já está conectado.");
    return;
  }

  socket = new WebSocket("ws://localhost:8081");

  socket.onopen = () => {
    console.log("Conectado ao servidor WebSocket");
  };

  socket.onmessage = (event) => {
    const data = event.data;
    console.log("Mensagem do servidor:", data);

    if (data.startsWith("users:")) {
      const usuarios = data.substring(6).split(",");
      exibirUsuarios(usuarios);
    } else {
      exibirMensagemNormal(data);
    }
  };

  socket.onclose = () => {
    console.log("Desconectado do servidor WebSocket");
    setTimeout(conectarWebSocket, 5000);
  };

  socket.onerror = (error) => {
    console.error("Erro no WebSocket:", error);
  };
}

function enviarNomeUsuario(event) {
  event.preventDefault(); 
  const nomeUsuario = document.getElementById('nomeUsuario').value.trim();
  if (nomeUsuario) {
    socket.send(nomeUsuario);
    console.log("Nome de usuário enviado:", nomeUsuario);
  } else {
    console.log("Nome de usuário não pode ser vazio.");
  }
}

function enviarMensagem(event) {
  event.preventDefault(); 
  const message = document.getElementById('message').value.trim();
  
  if (message !== '') {
    socket.send(message); 
    console.log("Mensagem enviada:", message);
    document.getElementById('message').value = '';
  } else {
    console.log("A mensagem não pode ser vazia.");
  }
}


function exibirUsuarios(usuarios) {
  const userList = document.getElementById("user-list");
  userList.innerHTML = "";
  usuarios.forEach(user => {
    const li = document.createElement("li");
    li.textContent = user;
    userList.appendChild(li);
  });
}

function exibirMensagemNormal(message) {
  const messagesDiv = document.getElementById("messages");
  const newMessage = document.createElement("p");
  newMessage.textContent = message;
  messagesDiv.appendChild(newMessage);
}

conectarWebSocket();
