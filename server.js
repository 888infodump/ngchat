const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

app.use(express.static('public'));

let messageStore = {};

function logMessage(channel, entry) {
  const filePath = path.join(logsDir, `${channel}.txt`);
  fs.appendFile(filePath, entry + '\n', () => {});
}

io.on('connection', (socket) => {
  socket.on('message', ({ nickname, message, channel }) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${nickname} (${channel}): ${message}`;
    logMessage(channel, entry);
    io.emit('message', { nickname, message, channel });
  });

  socket.on('image', ({ nickname, data, channel }) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${nickname} (${channel}): [Image]`;
    logMessage(channel, entry);
    io.emit('image', { nickname, data, channel });
  });

  socket.on('getMessages', (channel) => {
    const filePath = path.join(logsDir, `${channel}.txt`);
    if (fs.existsSync(filePath)) {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (!err) {
          const lines = data.trim().split('\n');
          for (let line of lines) {
            const match = line.match(/\[(.*?)\] (.*?) \((.*?)\): (.*)/);
            if (match) {
              const [_, time, nickname, ch, msg] = match;
              const isImage = msg === '[Image]';
              if (isImage) {
                // Skip actual image body in logs for now
              } else {
                socket.emit('message', { nickname, message: msg, channel: ch });
              }
            }
          }
        }
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
