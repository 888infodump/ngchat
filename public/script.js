const socket = io();
const input = document.getElementById('input');
const chat = document.getElementById('chat');
const channelSelect = document.getElementById('channel-select');

let nickname = null;
let currentChannel = channelSelect.value;

// Update current channel
channelSelect.addEventListener('change', () => {
  currentChannel = channelSelect.value;
  chat.innerHTML = '';
  socket.emit('getMessages', currentChannel);
});

// Handle message sending
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = input.value.trim();
    if (!text) return;

    // Command: /nickname
    if (text.startsWith('/nickname ')) {
      const name = text.split(' ')[1];
      if (name) {
        nickname = name;
        addSystemMessage(`Nickname set to "${nickname}"`);
      } else {
        addSystemMessage('Usage: /nickname yourname');
      }
      input.value = '';
      return;
    }

    // Require nickname
    if (!nickname) {
      addSystemMessage('Set your nickname first: /nickname yourname');
      input.value = '';
      return;
    }

    // Check for pasted image
    if (text.startsWith('data:image')) {
      socket.emit('image', { nickname, data: text, channel: currentChannel });
    } else {
      socket.emit('message', { nickname, message: text, channel: currentChannel });
    }

    input.value = '';
  }
});

// Display messages
socket.on('message', (data) => {
  if (data.channel !== currentChannel) return;
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `<strong>[${data.nickname}]</strong>: ${escapeHtml(data.message)}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

// Display images
socket.on('image', (data) => {
  if (data.channel !== currentChannel) return;
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `<strong>[${data.nickname}]</strong>:<br><img src="${data.data}" class="image" />`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

// System message helper
function addSystemMessage(msg) {
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = msg;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// Security
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

// Paste image support
input.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image'));
  if (item) {
    const file = item.getAsFile();
    const reader = new FileReader();
    reader.onload = () => {
      input.value = reader.result;
    };
    reader.readAsDataURL(file);
  }
});

// Initial fetch of messages
socket.emit('getMessages', currentChannel);
