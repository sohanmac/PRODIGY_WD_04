const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'chatapp.json');

const readDb = () => {
  try {
    if (!fs.existsSync(dbPath)) {
      saveDb({ users: [], messages: [], contacts: [] });
    }
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw || '{"users":[],"messages":[],"contacts":[]}');
  } catch (error) {
    saveDb({ users: [], messages: [], contacts: [] });
    return { users: [], messages: [], contacts: [] };
  }
};

const saveDb = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
};

const findUserByEmail = (email) => {
  const db = readDb();
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
};

const createUser = (name, email, phone, password) => {
  const db = readDb();
  const id = db.users.length ? Math.max(...db.users.map((user) => user.id)) + 1 : 1;
  const user = { id, name, email, phone, password, created_at: new Date().toISOString() };
  db.users.push(user);
  saveDb(db);
  return user;
};

const addContact = (userId, contactId) => {
  const db = readDb();
  if (!db.contacts) {
    db.contacts = [];
  }

  const exists = db.contacts.some(
    (relation) => relation.userId === userId && relation.contactId === contactId
  );
  if (exists) {
    return false;
  }

  db.contacts.push({ userId, contactId });
  saveDb(db);
  return true;
};

const removeContact = (userId, contactId) => {
  const db = readDb();
  if (!db.contacts) {
    db.contacts = [];
  }

  const index = db.contacts.findIndex(
    (relation) => relation.userId === userId && relation.contactId === contactId
  );
  if (index === -1) {
    return false;
  }

  db.contacts.splice(index, 1);
  saveDb(db);
  return true;
};

const getUsers = () => {
  const db = readDb();
  return db.users
    .map(({ id, name, email, phone }) => ({ id, name, email, phone }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const findUserByPhone = (phone) => {
  const db = readDb();
  return db.users.find((user) => user.phone === phone) || null;
};

const findUserByNameAndPhone = (name, phone) => {
  const db = readDb();
  return (
    db.users.find(
      (user) => user.name.toLowerCase() === name.toLowerCase() && user.phone === phone
    ) || null
  );
};

const getContactsForUser = (userId) => {
  const db = readDb();
  if (!db.contacts) {
    db.contacts = [];
  }

  const contactRelations = db.contacts.filter((relation) => relation.userId === userId);
  const contacts = contactRelations
    .map((relation) => db.users.find((user) => user.id === relation.contactId))
    .filter(Boolean)
    .map(({ id, name, email, phone }) => ({ id, name, email, phone }));

  return contacts.sort((a, b) => a.name.localeCompare(b.name));
};

const saveMessage = (senderId, receiverId, content) => {
  const db = readDb();
  const id = db.messages.length ? Math.max(...db.messages.map((message) => message.id)) + 1 : 1;
  const message = {
    id,
    sender_id: senderId,
    receiver_id: receiverId,
    content,
    created_at: new Date().toISOString(),
  };
  db.messages.push(message);
  saveDb(db);
  return message;
};

const getMessagesBetween = (userA, userB) => {
  const db = readDb();
  let messages = [];

  // Special case: peerId === 0 represents the default "General" room.
  if (userB === 0) {
    messages = db.messages.filter((message) => message.receiver_id === 0);
  } else {
    messages = db.messages.filter(
      (message) =>
        (message.sender_id === userA && message.receiver_id === userB) ||
        (message.sender_id === userB && message.receiver_id === userA)
    );
  }

  return messages
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((message) => {
      const sender = db.users.find((user) => user.id === message.sender_id);
      return {
        ...message,
        sender_name: sender ? sender.name : 'Unknown',
      };
    });
};

module.exports = {
  findUserByEmail,
  findUserByPhone,
  findUserByNameAndPhone,
  createUser,
  getUsers,
  getContactsForUser,
  addContact,
  removeContact,
  saveMessage,
  getMessagesBetween,
};
