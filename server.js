const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const port = parseInt(process.argv[2], 10) || process.env.PORT || 8000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone, email, and password are required.' });
  }

  const existingUser = db.findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'This email is already registered.' });
  }

  const existingPhone = db.findUserByPhone(phone);
  if (existingPhone) {
    return res.status(409).json({ error: 'This phone number is already registered.' });
  }

  db.createUser(name, email, phone, password);
  const user = db.findUserByEmail(email);
  res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.findUserByEmail(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/contacts', (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const contacts = db.getContactsForUser(userId);
  res.json(contacts);
});

app.post('/api/add-contact', (req, res) => {
  const { userId, contactName, contactPhone } = req.body;
  if (!userId || !contactName || !contactPhone) {
    return res.status(400).json({ error: 'userId, contactName, and contactPhone are required.' });
  }

  const contact = db.findUserByNameAndPhone(contactName, contactPhone);
  if (!contact) {
    return res.status(404).json({ error: 'Contact not found. Please register the user first.' });
  }

  if (contact.id === userId) {
    return res.status(400).json({ error: 'You cannot add yourself as a contact.' });
  }

  const added = db.addContact(userId, contact.id);
  if (!added) {
    return res.status(409).json({ error: 'Contact already added.' });
  }

  res.json({ success: true, contact: { id: contact.id, name: contact.name, phone: contact.phone } });
});

app.delete('/api/delete-contact', (req, res) => {
  const { userId, contactId } = req.body;
  if (!userId || !contactId) {
    return res.status(400).json({ error: 'userId and contactId are required.' });
  }

  const removed = db.removeContact(userId, contactId);
  if (!removed) {
    return res.status(404).json({ error: 'Contact not found or already removed.' });
  }

  res.json({ success: true });
});

app.get('/api/messages', (req, res) => {
  const userId = parseInt(req.query.userId, 10);
  const peerId = parseInt(req.query.peerId, 10);
  if (!userId || !peerId) {
    return res.status(400).json({ error: 'userId and peerId are required.' });
  }

  const messages = db.getMessagesBetween(userId, peerId);
  res.json(messages);
});

app.post('/api/messages', (req, res) => {
  const { senderId, receiverId, content } = req.body;
  if (!senderId || !receiverId || !content) {
    return res.status(400).json({ error: 'senderId, receiverId, and content are required.' });
  }

  db.saveMessage(senderId, receiverId, content);
  res.json({ success: true });
});

app.post('/api/agent', (req, res) => {
  const { userId, content } = req.body;
  if (!userId || !content || !content.trim()) {
    return res.status(400).json({ error: 'userId and content are required.' });
  }

  const message = content.trim();
  db.saveMessage(userId, -1, message);

  const normalized = message.toLowerCase();
  let reply;

  if (/\b(hello|hi|hey|good morning|good evening)\b/.test(normalized)) {
    reply = 'Hello! I am Nova, your chat assistant. How can I help you today?';
  } else if (/\b(who are you|your name|what are you)\b/.test(normalized)) {
    reply = 'I am Nova, the built-in assistant for this chat app. I can answer questions, help you draft messages, and guide you around the app.';
  } else if (/\b(add|create).*(contact)\b|\bcontact.*(add|create)\b/.test(normalized)) {
    reply = 'To add a contact, enter their registered name and phone number in the Contacts panel, then select Add.';
  } else if (/\b(delete|remove).*(contact|message)\b/.test(normalized)) {
    reply = 'You can remove a saved contact with the Delete button beside their name. Message deletion is not available yet.';
  } else if (/\b(login|register|account|password)\b/.test(normalized)) {
    reply = 'You can register from the welcome page, then sign in with your email and password. Use Logout in the top-right corner when you are finished.';
  } else if (/\b(thank|thanks)\b/.test(normalized)) {
    reply = 'You are welcome! Send me another message whenever you need a hand.';
  } else if (/\b(help|what can you do)\b/.test(normalized)) {
    reply = 'I can explain how this app works, help draft a reply, suggest conversation starters, and answer general questions. Try asking me to write a friendly message.';
  } else if (/\b(write|draft|compose).*(message|reply)\b/.test(normalized)) {
    reply = 'Of course. Tell me who the message is for, what you want to say, and whether you want it friendly, formal, or casual.';
  } else if (normalized.endsWith('?')) {
    reply = 'That is a good question. I am currently a lightweight offline assistant, so give me a little more context and I will do my best to help.';
  } else {
    reply = `I hear you. You said: "${message.slice(0, 140)}${message.length > 140 ? '...' : ''}" What would you like to do next?`;
  }

  const agentMessage = db.saveMessage(-1, userId, reply);
  res.json({
    message: {
      ...agentMessage,
      sender_name: 'Nova',
    },
  });
});

app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
