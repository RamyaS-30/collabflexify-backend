require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

const userRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspace');
const chatRoutes = require('./routes/chatRoutes');
const taskBoardRoutes = require('./routes/taskboard');
const TaskBoard = require('./models/TaskBoard');
const documentRoutes = require('./routes/document');
const Whiteboard = require('./models/WhiteBoard');
const notificationRoutes = require('./routes/notificationRoutes');
const sendNotification = require('./utils/sendNotification');
const emailRoutes = require('./routes/email');

const app = express();
const server = http.createServer(app);

const workspaceUsers = {}; 
const whiteboards = {};
const onlineUsers = new Map();      // userId -> socketId
const socketIdToUserId = new Map(); // socketId -> userId
const videoCallUsers = {};
const activeVideoCalls = new Map();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',                          // for local development
    'https://collabflexify-frontend.vercel.app'       // for deployed frontend
  ],
  credentials: true,
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(ClerkExpressWithAuth());

// API Routes
app.use('/api', userRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/taskboard', taskBoardRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/email', emailRoutes);

// Whiteboard routes (unchanged)
app.get('/api/whiteboard/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  try {
    const whiteboard = await Whiteboard.findOne({ workspaceId });
    if (!whiteboard) {
      return res.json({ lines: [] }); // default
    }
    res.json({ lines: whiteboard.lines });
  } catch (error) {
    console.error('Error loading whiteboard:', error);
    res.status(500).json({ error: 'Failed to load whiteboard' });
  }
});

app.post('/api/whiteboard/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  const { lines } = req.body;

  if (!Array.isArray(lines)) {
    return res.status(400).json({ error: 'Invalid lines data' });
  }

  try {
    const updated = await Whiteboard.findOneAndUpdate(
      { workspaceId },
      { lines },
      { upsert: true, new: true }
    );

    res.json({ message: 'Whiteboard saved', updated });
  } catch (error) {
    console.error('Error saving whiteboard:', error);
    res.status(500).json({ error: 'Failed to save whiteboard' });
  }
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: [
    'http://localhost:3000',
    'https://collabflexify-frontend.vercel.app'
  ],
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  const userId = socket.handshake.auth?.userId;

  if (userId) {
    onlineUsers.set(userId, socket.id);
    socketIdToUserId.set(socket.id, userId);
    console.log(`✅ User ${userId} connected with socket ID ${socket.id}`);
  }

  // Join workspace room
  socket.on('joinRoom', async ({ roomId, userName }) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined workspace room: ${roomId}`);

    if (!workspaceUsers[roomId]) workspaceUsers[roomId] = {};
    workspaceUsers[roomId][socket.id] = userName;

    // Notify existing users in the room about new user
    socket.to(roomId).emit('user-connected', { socketId: socket.id, userName });

    const callInfo = activeVideoCalls.get(roomId);
    if (callInfo){
      socket.emit('videoCall:started', {
        startedBy: callInfo.startedBy,
        timestamp: callInfo.startedAt,
      });
    }

    // Send notifications to all other users in the workspace
    for (const [sockId, name] of Object.entries(workspaceUsers[roomId])) {
      if (sockId !== socket.id) {
        const targetUserId = socketIdToUserId.get(sockId);
        if (targetUserId) {
          await sendNotification(io, onlineUsers, targetUserId, 'workspace_join', {
            message: `${userName} joined the workspace`,
            workspaceId: roomId,
            userName,
          });
        }
      }
    }

    // Send list of existing users back to the new user
    const otherUsers = Object.entries(workspaceUsers[roomId])
      .filter(([id]) => id !== socket.id)
      .map(([id, name]) => ({ socketId: id, userName: name }));

    socket.emit('all-users', otherUsers);
  });

  // Leave workspace room
  socket.on('leaveRoom', (workspaceId) => {
    console.log(`Socket ${socket.id} left room ${workspaceId}`);
    socket.leave(workspaceId);

    if (workspaceUsers[workspaceId]) {
      delete workspaceUsers[workspaceId][socket.id];
      socket.to(workspaceId).emit('user-disconnected', socket.id);

      if (Object.keys(workspaceUsers[workspaceId]).length === 0) {
        delete workspaceUsers[workspaceId];
      }
    }

    const callInfo = activeVideoCalls.get(workspaceId);
    if (callInfo && callInfo.startedBy === socket.id) {
      activeVideoCalls.delete(workspaceId);
      socket.to(workspaceId).emit('videoCall:ended');
    }
  });

  // Leave all rooms except own socket room
  socket.on('leaveAllRooms', () => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
        if (workspaceUsers[room]) {
          delete workspaceUsers[room][socket.id];
          socket.to(room).emit('user-disconnected', socket.id);
          if (Object.keys(workspaceUsers[room]).length === 0) {
            delete workspaceUsers[room];
          }
        }
        console.log(`Socket ${socket.id} left room ${room}`);
      }
    });
  });

  // 📞 Start Video Call
  socket.on('videoCall:start', ({ workspaceId }) => {
    if (!activeVideoCalls.has(workspaceId)) {
      activeVideoCalls.set(workspaceId, {
        startedBy: socket.id,
        startedAt: Date.now(),
      });
      io.to(workspaceId).emit('videoCall:started', {
        startedBy: socket.id,
        timestamp: Date.now(),
      });
      console.log(`📞 Call started in workspace ${workspaceId} by ${socket.id}`);
    }
  });

  // 📴 End Video Call
  socket.on('videoCall:end', ({ workspaceId }) => {
    const callInfo = activeVideoCalls.get(workspaceId);
    if (callInfo?.startedBy === socket.id) {
      activeVideoCalls.delete(workspaceId);
      io.to(workspaceId).emit('videoCall:ended');
      console.log(`📴 Call ended in workspace ${workspaceId} by ${socket.id}`);
    }
  });

  // Signal for WebRTC
  socket.on('signal', ({ to, from, signal }) => {
    io.to(to).emit('signal', { from, signal });
  });

  // Taskboard update
  socket.on('taskboard:update', async (data) => {
    const { workspaceId, lists } = data;
    try {
      await TaskBoard.findOneAndUpdate(
        { workspaceId },
        { lists },
        { new: true, upsert: true }
      );
      socket.to(workspaceId).emit('taskboard:update', lists);
    } catch (err) {
      console.error('Error updating taskboard:', err);
    }
  });

  // Chat message sending with notifications
  socket.on('sendMessage', async ({ workspaceId, message, senderId, senderName }) => {
    io.to(workspaceId).emit('receiveMessage', message);

    // Notify all other users in the workspace
    for (const [sockId, userName] of Object.entries(workspaceUsers[workspaceId] || {})) {
      const targetUserId = socketIdToUserId.get(sockId);
      if (targetUserId && targetUserId !== senderId) {
        await sendNotification(io, onlineUsers, targetUserId, 'new_message', {
          message: `${senderName} sent a message`,
          workspaceId,
          senderName,
          messagePreview: typeof message.text === 'string' ? message.text.slice(0, 50) : '',
        });
      }
    }
  });

  // Whiteboard events (unchanged)
  socket.on('whiteboard:new-line', ({ workspaceId, line }) => {
  if (!workspaceId) return;
  socket.to(workspaceId).emit('whiteboard:new-line', line);
});

socket.on('whiteboard:clear', ({ workspaceId }) => {
  if (!workspaceId) return;
  socket.to(workspaceId).emit('whiteboard:clear');
});

socket.on('whiteboard:undo', ({ workspaceId }) => {
  if (!workspaceId) return;
  socket.to(workspaceId).emit('whiteboard:undo');
});

  // Example video call invite notification
  socket.on('videoCall:invite', async ({ toUserId, fromUserName, workspaceId }) => {
    // Send notification to invited user
    await sendNotification(io, onlineUsers, toUserId, 'video_call_invite', {
      message: `${fromUserName} is calling you`,
      workspaceId,
      fromUserName,
    });

    // Optionally, emit event to invited user's socket if online (sendNotification handles this)
  });

  socket.on('disconnect', () => {
        if (userId) {
      onlineUsers.delete(userId);
      socketIdToUserId.delete(socket.id);
      console.log(`❌ User ${userId} disconnected`);
    }

    // Remove user from any workspaceUsers room they were in
    for (const workspaceId in workspaceUsers) {
      if (workspaceUsers[workspaceId][socket.id]) {
        delete workspaceUsers[workspaceId][socket.id];
        socket.to(workspaceId).emit('user-disconnected', socket.id);
        if (Object.keys(workspaceUsers[workspaceId]).length === 0) {
          delete workspaceUsers[workspaceId];
        }

        // End video call if this user started it
        const callInfo = activeVideoCalls.get(workspaceId);
        if (callInfo?.startedBy === socket.id) {
          activeVideoCalls.delete(workspaceId);
          socket.to(workspaceId).emit('videoCall:ended');
        }

        break;
      }
    }
  });
});

app.get('/', (req, res) => {
  res.send('✅ CollabFlexify Backend is running!');
});

// Catch-all 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Internal server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
