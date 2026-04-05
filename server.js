import { WebSocketServer } from 'ws';
import http from 'http';

const pingTimeout = 30000;
const port = process.env.PORT || 4444;
const wss = new WebSocketServer({ noServer: true });

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Realtime Board Signaling Server is running');
});

/** @type {Map<string, Set<any>>} */
const topics = new Map();

/**
 * @param {any} conn
 * @param {object} message
 */
const send = (conn, message) => {
  if (conn.readyState !== 1) return;
  try {
    conn.send(JSON.stringify(message));
  } catch (e) {
    conn.close();
  }
};

const onconnection = (conn) => {
  const subscribedTopics = new Set();
  let closed = false;
  let pongReceived = true;

  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      conn.close();
      clearInterval(pingInterval);
    } else {
      pongReceived = false;
      try { conn.ping(); } catch (e) { conn.close(); }
    }
  }, pingTimeout);

  conn.on('pong', () => { pongReceived = true; });

  conn.on('close', () => {
    subscribedTopics.forEach((topicName) => {
      const subs = topics.get(topicName) || new Set();
      subs.delete(conn);
      if (subs.size === 0) topics.delete(topicName);
    });
    subscribedTopics.clear();
    closed = true;
    clearInterval(pingInterval);
  });

  conn.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      if (parsedMessage && parsedMessage.type && !closed) {
        switch (parsedMessage.type) {
          case 'subscribe':
            (parsedMessage.topics || []).forEach((topicName) => {
              if (typeof topicName === 'string') {
                if (!topics.has(topicName)) topics.set(topicName, new Set());
                topics.get(topicName).add(conn);
                subscribedTopics.add(topicName);
              }
            });
            break;
          case 'unsubscribe':
            (parsedMessage.topics || []).forEach((topicName) => {
              const subs = topics.get(topicName);
              if (subs) {
                subs.delete(conn);
                if (subs.size === 0) topics.delete(topicName);
              }
            });
            break;
          case 'publish':
            if (parsedMessage.topic) {
              const receivers = topics.get(parsedMessage.topic);
              if (receivers) {
                parsedMessage.clients = receivers.size;
                receivers.forEach((receiver) => {
                  send(receiver, parsedMessage);
                });
              }
            }
            break;
          case 'ping':
            send(conn, { type: 'pong' });
            break;
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  });
};

wss.on('connection', onconnection);

server.on('upgrade', (request, socket, head) => {
  const handleAuth = (ws) => {
    wss.emit('connection', ws, request);
  };
  wss.handleUpgrade(request, socket, head, handleAuth);
});

server.listen(port, () => {
  console.log(`Signaling server running on port ${port}`);
});
