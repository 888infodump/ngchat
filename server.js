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

let channels = {}; // { channelName: [socket.id, ...] }

// ==== Message Logging ====
function logMessage(channel, entry) {
  const filePath = path.join(logsDir, `${channel}.txt`);
  fs.appendFile(filePath, entry + '\n', () => {});
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // ==== Chat: message handling ====
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
              if (!isImage) {
                socket.emit('message', { nickname, message: msg, channel: ch });
              }
            }
          }
        }
      });
    }
  });

  // ==== WebRTC signaling ====
  socket.on('join', (channel) => {
    socket.join(channel);
    socket.to(channel).emit('user-joined', socket.id);
  });

  socket.on('signal', ({ to, from, signal }) => {
    io.to(to).emit('signal', { from, signal });
  });

  socket.on('disconnect', () => {
    for (const channel in channels) {
      channels[channel] = channels[channel].filter(id => id !== socket.id);
      socket.to(channel).emit('user-left', socket.id);
    }
    socket.broadcast.emit('user-left', socket.id);
  });
});


// ==== Server Start ====
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
