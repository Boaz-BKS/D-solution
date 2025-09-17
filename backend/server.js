const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Order = require('./models/Order');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Basic route
app.get('/', (req, res) => {
 res.json({ message: 'D-solution CRM Backend' });
});

// Auth routes
app.post('/api/register', async (req, res) => {
 try {
   const { email, password } = req.body;
   if (!email || !password) {
     return res.status(400).json({ message: 'Email and password required' });
   }
   const existingUser = await User.findOne({ email });
   if (existingUser) {
     return res.status(400).json({ message: 'User already exists' });
   }
   const hashedPassword = await bcrypt.hash(password, 10);
   const user = new User({ email, password: hashedPassword });
   await user.save();
   const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
   res.status(201).json({ token, user: { id: user._id, email: user.email } });
 } catch (error) {
   res.status(500).json({ message: 'Server error' });
 }
});

app.post('/api/login', async (req, res) => {
 try {
   const { email, password } = req.body;
   if (!email || !password) {
     return res.status(400).json({ message: 'Email and password required' });
   }
   const user = await User.findOne({ email });
   if (!user || !await bcrypt.compare(password, user.password)) {
     return res.status(400).json({ message: 'Invalid credentials' });
   }
   const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
   res.json({ token, user: { id: user._id, email: user.email } });
 } catch (error) {
   res.status(500).json({ message: 'Server error' });
 }
});

// Service routes
const Service = require('./models/Service');

app.get('/api/services', async (req, res) => {
 try {
   let services = await Service.find();
   if (services.length === 0) {
     services = await Service.insertMany([
       { name: 'Web Development', description: 'Custom web applications and websites.' },
       { name: 'Consulting', description: 'Expert advice on digital solutions.' },
       { name: 'Digital Solutions', description: 'Tailored digital tools and services.' }
     ]);
   }
   res.json(services);
 } catch (error) {
   res.status(500).json({ message: 'Server error' });
 }
});

// Socket.io basic setup
const Message = require('./models/Message');

io.on('connection', (socket) => {
 console.log('User connected');
 socket.on('join', (userId) => {
   socket.join(userId);
 });
 socket.on('sendMessage', async (data) => {
   try {
     const { userId, message } = data;
     const newMessage = new Message({ userId, message });
     await newMessage.save();
     io.to(userId).emit('receiveMessage', newMessage);
   } catch (error) {
     socket.emit('error', 'Failed to send message');
   }
 });
 socket.on('disconnect', () => {
   console.log('User disconnected');
 });
});

// Route for chat history
app.get('/api/messages/:userId', async (req, res) => {
 try {
   const messages = await Message.find({ userId: req.params.userId }).sort({ createdAt: 1 });
   res.json(messages);
 } catch (error) {
   res.status(500).json({ message: 'Server error' });
 }
});


// DB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dsolution').then(() => {
 console.log('Connected to MongoDB');
}).catch(err => {
 console.error('MongoDB connection error:', err);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});