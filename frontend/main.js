const API_BASE = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

let currentUser = null;
let socket = null;

// Utility functions
function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function removeToken() {
  localStorage.removeItem('token');
}

function apiCall(endpoint, options = {}) {
  const token = getToken();
  options.headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };
  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${endpoint}`, options).then(res => res.json());
}

function handleAuthResponse(data, redirectTo) {
  if (data.token) {
    setToken(data.token);
    currentUser = data.user;
    window.location.href = redirectTo || 'dashboard.html';
  } else {
    alert(data.message || 'Error');
  }
}

// Auth forms
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const data = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      handleAuthResponse(data, 'dashboard.html');
    });
  }

  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      const data = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      handleAuthResponse(data, 'dashboard.html');
    });
  }

  // Logout
  const logoutBtns = document.querySelectorAll('#logoutBtn');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      removeToken();
      currentUser = null;
      window.location.href = 'index.html';
    });
  });

  // Dashboard - load services
  if (window.location.pathname.endsWith('dashboard.html')) {
    loadServices();
  }

  // Order form
  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    loadServicesForOrder();
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const serviceId = document.getElementById('serviceSelect').value;
      const specs = document.getElementById('specs').value;
      const file = document.getElementById('orderFile').files[0];
      const formData = new FormData();
      formData.append('userId', currentUser.id);
      formData.append('serviceId', serviceId);
      formData.append('specs', specs);
      if (file) formData.append('file', file);
      const data = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        body: formData
      }).then(res => res.json());
      if (data._id) {
        alert('Order placed successfully!');
        window.location.href = 'dashboard.html';
      } else {
        alert(data.message || 'Error');
      }
    });
  }

  // Chat
  if (window.location.pathname.endsWith('chat.html')) {
    initChat();
  }

  // Check auth on load for protected pages
  if (['dashboard.html', 'order.html', 'chat.html'].some(path => window.location.pathname.endsWith(path))) {
    if (!getToken()) {
      window.location.href = 'login.html';
    }
  }
});

async function loadServices() {
  const data = await apiCall('/services');
  const servicesList = document.getElementById('servicesList');
  servicesList.innerHTML = data.map(service => `
    <div class="service-item" onclick="selectService('${service._id}')">
      <h3>${service.name}</h3>
      <p>${service.description}</p>
    </div>
  `).join('');
}

function selectService(serviceId) {
  window.location.href = `order.html?service=${serviceId}`;
}

async function loadServicesForOrder() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselected = urlParams.get('service');
  const data = await apiCall('/services');
  const select = document.getElementById('serviceSelect');
  select.innerHTML = '<option value="">Select Service</option>' + data.map(service => `
    <option value="${service._id}" ${service._id === preselected ? 'selected' : ''}>${service.name}</option>
  `).join('');
}

async function initChat() {
  socket = io(SOCKET_URL);
  socket.emit('join', currentUser.id);
  loadMessages();
  const chatForm = document.getElementById('chatForm');
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = document.getElementById('messageInput').value;
    if (message.trim()) {
      socket.emit('sendMessage', { userId: currentUser.id, message });
      document.getElementById('messageInput').value = '';
    }
  });
  socket.on('receiveMessage', (msg) => {
    addMessageToUI(msg);
  });
}

async function loadMessages() {
  const data = await apiCall(`/messages/${currentUser.id}`);
  const messagesList = document.getElementById('messagesList');
  messagesList.innerHTML = data.map(msg => `
    <div class="message">
      <small>${new Date(msg.createdAt).toLocaleTimeString()}</small>
      <p>${msg.message}</p>
    </div>
  `).join('');
}

function addMessageToUI(msg) {
  const messagesList = document.getElementById('messagesList');
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `
    <small>${new Date().toLocaleTimeString()}</small>
    <p>${msg.message}</p>
  `;
  messagesList.appendChild(div);
  messagesList.scrollTop = messagesList.scrollHeight;
}

// Language toggle (basic)
let currentLang = 'en';
function toggleLang() {
  currentLang = currentLang === 'en' ? 'fr' : 'en';
  // Update text based on lang (placeholder - implement full translation)
  document.querySelectorAll('[data-lang]').forEach(el => {
    el.textContent = el.dataset.lang[currentLang];
  });
  localStorage.setItem('lang', currentLang);
}

// Load lang on start
currentLang = localStorage.getItem('lang') || 'en';
if (document.getElementById('langToggle')) {
  document.getElementById('langToggle').addEventListener('click', toggleLang);
}