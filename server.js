const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { Kafka, Partitioners } = require('kafkajs');

const server = new WebSocket.Server({ port: 8081 });
const clientes = new Map();
const historico = path.join(__dirname, 'historico.txt');

function carregarHistorico() {
  if (fs.existsSync(historico)) {
    return fs.readFileSync(his, 'utf-8')
      .split('\n')
      .filter(line => line.trim());
  }
  return []
}

function salvarHistorico(mensagem) {
  fs.appendFileSync(historico, mensagem + '\n');
}

const kafka = new Kafka({
  clientId: 'websocket-server',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

async function enviarMensagemKafka(mensagem) {
  try {
    await producer.send({
      topic: 'chat-messages',
      messages: [{ value: mensagem }],
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem para o Kafka:", error);
  }
}

async function startKafka() {
  try {
    await producer.connect();
    console.log("Conectado ao Kafka com sucesso.");
  } catch (error) {
    console.error("Erro ao conectar ao Kafka:", error);
    setTimeout(startKafka, 5000);
  }
}

startKafka().catch(console.error);

function enviarMensagemParaTodos(mensagem, exceptWs = null) {
  clientes.forEach(({ ws }) => {
    if (ws !== exceptWs && ws.readyState === WebSocket.OPEN) {
      ws.send(mensagem);
    }
  });
}

server.on('connection', (ws) => {
  console.log("Novo cliente conectado!");

  const mensagensHistoricas = carregarHistorico();
  ws.send("Histórico de mensagens: \n" + mensagensHistoricas.join('\n'));

  let nomeUsuarioDefinido = false;

  ws.on('message', (message) => {
    const mensagem = message.toString().trim();

    if (!nomeUsuarioDefinido) {
      if (clientes.has(mensagem)) {
        ws.send('Nome de usuário já está em uso, tente outro.');
        return;
      }

      clientes.set(mensagem, { ws, status: 'conectado' });
      nomeUsuarioDefinido = true;

      ws.send(`Bem-vindo, ${mensagem}! Você entrou no chat.`);
      
      enviarMensagemParaTodos(`${mensagem} entrou no chat!`, ws);
      console.log(`Novo usuário: ${mensagem}`);
      return;
    }

    if (mensagem.startsWith('/private')) {
      const [_, username, ...privateMessage] = mensagem.split(' ');
      const usuarioAlvo = clientes.get(username);
      if (usuarioAlvo && usuarioAlvo.ws.readyState === WebSocket.OPEN) {
        usuarioAlvo.ws.send(`Mensagem privada de ${[...clientes].find(([key, value]) => value.ws === ws)[0]}: ${privateMessage.join(' ')}`);
        ws.send(`Mensagem privada enviada para ${username}: ${privateMessage.join(' ')}`);
      } else {
        ws.send('Usuário não encontrado ou offline.');
      }
    } else {
      const nomeUsuario = [...clientes].find(([key, value]) => value.ws === ws)?.[0];
      enviarMensagemParaTodos(`${nomeUsuario}: ${mensagem}`);
      salvarHistorico(`${nomeUsuario}: ${mensagem}`);
      enviarMensagemKafka(`${nomeUsuario}: ${mensagem}`);
    }
  });

  ws.on('close', () => {
    const nomeUsuario = [...clientes].find(([key, value]) => value.ws === ws)?.[0];
    if (nomeUsuario) {
      clientes.get(nomeUsuario).status = 'desconectado';
      console.log(`Usuário ${nomeUsuario} desconectado.`);
      enviarMensagemParaTodos(`${nomeUsuario} saiu do chat.`);
    }
  });
});
