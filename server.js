const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const LOG_FILE = path.join(__dirname, 'log.txt');

// Helper: Append a message to log.txt
function saveMessage(username, message) {
  const line = `[${new Date().toISOString()}] ${username}: ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

// Helper: Read all messages from log.txt
function readMessages() {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.map(line => {
    const match = line.match(/^\[(.+?)\] (.*?): (.*)$/);
    if (!match) return null;
    const [, timestamp, username, message] = match;
    return { timestamp, username, message };
  }).filter(Boolean);
}

// POST /api/message – Save a message
app.post('/api/message', (req, res) => {
  const { username, message } = req.body;
  if (!username || !message) {
    return res.status(400).send({ success: false, error: 'Missing username or message' });
  }
  saveMessage(username, message);
  res.status(200).send({ success: true });
});

// GET /api/messages – Return all messages
app.get('/api/messages', (req, res) => {
  const messages = readMessages();
  res.json(messages);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
