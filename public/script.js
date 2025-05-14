const socket = io();
const input = document.getElementById('input');
const chat = document.getElementById('chat');
const channelSelect = document.getElementById('channel-select');
const joinVoiceBtn = document.getElementById('join-voice');
const leaveVoiceBtn = document.getElementById('leave-voice');

let nickname = null;
let currentChannel = channelSelect.value;
let voiceStream = null;
let peers = {}; // Mapping of socket.id -> RTCPeerConnection

// ==== Channel switching ====
channelSelect.addEventListener('change', () => {
  currentChannel = channelSelect.value;
  chat.innerHTML = '';
  socket.emit('getMessages', currentChannel);
});

// ==== Message sending ====
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = input.value.trim();
    if (!text) return;

    // Handle nickname command
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

    if (!nickname) {
      addSystemMessage('Set your nickname first: /nickname yourname');
      input.value = '';
      return;
    }

    // Check for image data
    if (text.startsWith('data:image')) {
      socket.emit('image', { nickname, data: text, channel: currentChannel });
    } else {
      socket.emit('message', { nickname, message: text, channel: currentChannel });
    }

    input.value = '';
  }
});

// ==== Display text messages ====
socket.on('message', (data) => {
  if (data.channel !== currentChannel) return;
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `<strong>[${data.nickname}]</strong>: ${escapeHtml(data.message)}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

// ==== Display image messages ====
socket.on('image', (data) => {
  if (data.channel !== currentChannel) return;
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `<strong>[${data.nickname}]</strong>:<br><img src="${data.data}" class="image" />`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

// ==== Paste image support ====
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

// ==== Join voice ====
joinVoiceBtn.addEventListener('click', async () => {
  if (!nickname) {
    addSystemMessage('Set your nickname first: /nickname yourname');
    return;
  }

  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    addSystemMessage('🎤 Joined voice channel.');

    socket.emit('join-voice', currentChannel);

    // Create peer connections
    socket.on('user-joined', (id) => {
      const pc = createPeerConnection(id);
      peers[id] = pc;
      voiceStream.getTracks().forEach(track => pc.addTrack(track, voiceStream));
    });

    socket.on('user-left', (id) => {
      if (peers[id]) {
        peers[id].close();
        delete peers[id];
        addSystemMessage(`👋 User left voice: ${id}`);
      }
    });

    socket.on('signal', async ({ from, data }) => {
      let pc = peers[from];
      if (!pc) {
        pc = createPeerConnection(from);
        peers[from] = pc;
        voiceStream.getTracks().forEach(track => pc.addTrack(track, voiceStream));
      }

      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, from: socket.id, data: pc.localDescription });
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });

  } catch (err) {
    console.error('Mic access denied:', err);
    addSystemMessage('❌ Mic permission denied.');
  }
});

// ==== Leave voice ====
leaveVoiceBtn.addEventListener('click', () => {
  leaveVoice();
});

function leaveVoice() {
  if (voiceStream) {
    voiceStream.getTracks().forEach(track => track.stop());
    voiceStream = null;
  }
  for (const id in peers) {
    peers[id].close();
  }
  peers = {};
  socket.emit('leave-voice', currentChannel);
  addSystemMessage('🛑 Left voice channel.');
}

function createPeerConnection(id) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // Send ICE candidates to the other peer
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', { to: id, from: socket.id, data: e.candidate });
    }
  };

  // Receive and play incoming audio
  pc.ontrack = (e) => {
    const audio = document.createElement('audio');
    audio.srcObject = e.streams[0];
    audio.autoplay = true;
    audio.controls = true; // helpful for debugging
    audio.style.display = 'none'; // or make visible for testing
    document.body.appendChild(audio);
    audio.play().catch(err => {
      console.error('Audio playback failed:', err);
      addSystemMessage('⚠️ Unable to play incoming audio. User interaction may be required.');
    });
  };

  // Clean up on disconnect
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      pc.close();
      delete peers[id];
    }
  };

  // Create and send offer
  pc.createOffer().then(offer => {
    pc.setLocalDescription(offer);
    socket.emit('signal', { to: id, from: socket.id, data: offer });
  });

  return pc;
}


// ==== System messages ====
function addSystemMessage(msg) {
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = msg;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ==== Escape HTML ====
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

// ==== Load messages ====
socket.emit('getMessages', currentChannel);