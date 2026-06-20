const pageType = document.body.dataset.page;
const chatWindow = document.querySelector('.chat-window');
const messageInput = document.getElementById('messageInput');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutButton = document.getElementById('logoutButton');
const contactListEl = document.getElementById('contactList');
const contactSearch = document.getElementById('contactSearch');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const agentContact = document.getElementById('agentContact');

const SESSION_KEY = 'chatBotSession';
const AGENT = { id: -1, name: 'Nova', isAgent: true };
let activeContact = null;
let contacts = [];

if (pageType === 'login' && loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (pageType === 'register' && registerForm) {
  registerForm.addEventListener('submit', handleRegister);
}

if (pageType === 'chat') {
  initializeChatPage();
  const chatForm = document.getElementById('chatForm');
  if (chatForm) {
    chatForm.addEventListener('submit', sendMessage);
  }
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }
  if (contactSearch) {
    contactSearch.addEventListener('input', () => filterContacts(contactSearch.value));
  }
  if (agentContact) {
    agentContact.addEventListener('click', selectAgent);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const error = document.getElementById('loginError');

  error.textContent = '';
  if (!email || !password) {
    error.textContent = 'Please enter both email and password.';
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      error.textContent = data.error || 'Login failed.';
      return;
    }

    saveSession(data.user);
    window.location.href = 'chat.html';
  } catch (err) {
    error.textContent = 'Unable to connect to the server.';
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  const error = document.getElementById('registerError');

  error.textContent = '';
  if (!name || !phone || !email || !password || !confirmPassword) {
    error.textContent = 'Fill in all fields to register.';
    return;
  }

  if (password !== confirmPassword) {
    error.textContent = 'Passwords do not match.';
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      error.textContent = data.error || 'Registration failed.';
      return;
    }

    saveSession(data.user);
    window.location.href = 'chat.html';
  } catch (err) {
    error.textContent = 'Unable to connect to the server.';
  }
}

async function initializeChatPage() {
  const user = getSession();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  // default General chat available without contacts
  if (chatSubtitle) {
    chatSubtitle.textContent = `Signed in as ${user.name || user.email}`;
  }

  activeContact = AGENT;
  if (chatTitle) chatTitle.textContent = activeContact.name;
  if (chatSubtitle) chatSubtitle.textContent = 'Online - AI chat agent';

  if (messageInput) {
    messageInput.disabled = false;
    messageInput.placeholder = `Message ${activeContact.name}`;
  }

  const addContactForm = document.getElementById('addContactForm');
  if (addContactForm) {
    addContactForm.addEventListener('submit', handleAddContact);
  }

  await loadContacts();

  await loadMessages(AGENT.id);
}

function handleLogout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

async function loadContacts() {
  const user = getSession();
  if (!user || !contactListEl) {
    return;
  }

  try {
    const url = `/api/contacts?userId=${encodeURIComponent(user.id)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      return;
    }

    contacts = data;
    renderContacts(contacts);
    const contactNote = document.getElementById('contactNote');
    if (contactNote) {
      contactNote.textContent = contacts.length ? '' : 'Add a contact to start messaging.';
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleAddContact(event) {
  event.preventDefault();
  const user = getSession();
  const errorNote = document.getElementById('contactNote');
  if (!user || !errorNote) return;

  const name = document.getElementById('newContactName').value.trim();
  const phone = document.getElementById('newContactPhone').value.trim();
  if (!name || !phone) {
    errorNote.textContent = 'Enter both a name and phone number.';
    return;
  }

  try {
    const response = await fetch('/api/add-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, contactName: name, contactPhone: phone }),
    });

    const data = await response.json();
    if (!response.ok) {
      errorNote.textContent = data.error || 'Could not add contact.';
      return;
    }

    document.getElementById('newContactName').value = '';
    document.getElementById('newContactPhone').value = '';
    errorNote.textContent = 'Contact added successfully.';
    await loadContacts();
  } catch (err) {
    console.error(err);
    errorNote.textContent = 'Unable to connect to the server.';
  }
}

async function sendMessage(event) {
  event.preventDefault();
  const user = getSession();
  if (!messageInput || !chatWindow || !activeContact || !user) return;

  const text = messageInput.value.trim();
  if (!text) return;

  appendMessage('You', text, 'outgoing');
  messageInput.value = '';
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    if (activeContact.isAgent) {
      setAgentTyping(true);
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content: text }),
      });
      const data = await response.json();
      setAgentTyping(false);
      if (!response.ok) {
        appendMessage('Nova', data.error || 'I could not answer just now.', 'incoming');
        return;
      }
      await loadMessages(AGENT.id);
      return;
    }

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: user.id, receiverId: activeContact.id, content: text }),
    });
    await loadMessages(activeContact.id);
  } catch (err) {
    setAgentTyping(false);
    console.error(err);
  }
}

function setAgentTyping(isTyping) {
  const existing = document.getElementById('agentTyping');
  if (!isTyping) {
    if (existing) existing.remove();
    return;
  }
  if (!chatWindow || existing) return;

  const typing = document.createElement('div');
  typing.id = 'agentTyping';
  typing.className = 'message incoming typing-message';
  typing.innerHTML = '<span class="message-meta">Nova</span><div class="typing-dots"><i></i><i></i><i></i></div>';
  chatWindow.appendChild(typing);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function selectAgent() {
  activeContact = AGENT;
  if (chatTitle) chatTitle.textContent = 'Nova';
  if (chatSubtitle) chatSubtitle.textContent = 'Online - AI chat agent';
  if (messageInput) {
    messageInput.disabled = false;
    messageInput.placeholder = 'Ask Nova anything';
  }
  if (agentContact) agentContact.classList.add('active');
  await loadMessages(AGENT.id);
  renderContacts(contacts);
}

function appendMessage(author, text, type) {
  if (!chatWindow) return;
  const message = document.createElement('div');
  message.className = `message ${type}`;
  const meta = document.createElement('span');
  meta.className = 'message-meta';
  meta.textContent = author;
  const body = document.createElement('p');
  body.textContent = text;
  message.appendChild(meta);
  message.appendChild(body);
  // allow quick-reply by clicking a message (prefill @author)
  message.addEventListener('click', () => {
    if (!messageInput) return;
    if (author && author !== 'You') {
      messageInput.value = `@${author} `;
      messageInput.focus();
    }
  });
  chatWindow.appendChild(message);
}

function renderContacts(list) {
  if (!contactListEl) return;
  contactListEl.innerHTML = '';

  list.forEach(contact => {
    const card = document.createElement('div');
    card.className = 'contact-card';
    if (activeContact && activeContact.id === contact.id) {
      card.classList.add('active');
    }

    card.innerHTML = `
      <button type="button" class="contact-main-button">
        <div class="contact-avatar">${contact.name.charAt(0)}</div>
        <div class="contact-info">
          <h3>${contact.name}</h3>
          <p>${contact.phone}</p>
        </div>
      </button>
      <button type="button" class="contact-delete-button" data-contact-id="${contact.id}">Delete</button>
    `;

    const mainButton = card.querySelector('.contact-main-button');
    const deleteButton = card.querySelector('.contact-delete-button');

    if (mainButton) {
      mainButton.addEventListener('click', () => selectContact(contact.id));
    }

    if (deleteButton) {
      deleteButton.addEventListener('click', () => deleteContact(contact.id));
    }

    contactListEl.appendChild(card);
  });
}

async function selectContact(contactId) {
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return;

  activeContact = contact;
  if (agentContact) agentContact.classList.remove('active');

  if (chatTitle) {
    chatTitle.textContent = activeContact.name;
  }
  if (chatSubtitle) {
    chatSubtitle.textContent = 'Online';
  }

  if (messageInput) {
    messageInput.disabled = false;
    messageInput.placeholder = `Message ${activeContact.name}`;
  }

  await loadMessages(contactId);
  renderContacts(contacts);
}

async function loadMessages(peerId) {
  const user = getSession();
  if (!user || !chatWindow) return;

  try {
    const url = `/api/messages?userId=${encodeURIComponent(user.id)}&peerId=${encodeURIComponent(peerId)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      return;
    }

    chatWindow.innerHTML = '';
    data.forEach(message => {
      const type = message.sender_id === user.id ? 'outgoing' : 'incoming';
      appendMessage(message.sender_name, message.content, type);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (err) {
    console.error(err);
  }
}

async function deleteContact(contactId) {
  const user = getSession();
  if (!user) return;

  try {
    const response = await fetch('/api/delete-contact', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, contactId }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(data.error || 'Failed to delete contact.');
      return;
    }

    if (activeContact && activeContact.id === contactId) {
      activeContact = null;
      if (chatTitle) chatTitle.textContent = 'Chat Bot';
      if (chatSubtitle) chatSubtitle.textContent = `Signed in as ${user.name || user.email}`;
      if (messageInput) {
        messageInput.disabled = true;
        messageInput.placeholder = 'Select a contact to message';
      }
      if (chatWindow) chatWindow.innerHTML = '';
    }

    await loadContacts();
  } catch (err) {
    console.error(err);
  }
}

function filterContacts(term) {
  const filtered = contacts.filter(contact =>
    contact.name.toLowerCase().includes(term.toLowerCase()) ||
    contact.phone.toLowerCase().includes(term.toLowerCase())
  );
  renderContacts(filtered);
}
