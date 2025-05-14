async function sendMessage() {
  const username = document.getElementById('username').value;
  const message = document.getElementById('message').value;

  await fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, message })
  });

  document.getElementById('message').value = '';
  loadMessages();
}

async function loadMessages() {
  const res = await fetch('/api/messages');
  const messages = await res.json();
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  messages.forEach(msg => {
    const li = document.createElement('li');
    li.textContent = `[${msg.timestamp}] ${msg.username}: ${msg.message}`;
    chat.appendChild(li);
  });
}

setInterval(loadMessages, 3000); // Refresh every 3 seconds
