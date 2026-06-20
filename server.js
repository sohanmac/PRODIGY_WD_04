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

app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
