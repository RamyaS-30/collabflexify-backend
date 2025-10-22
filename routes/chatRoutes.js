const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get all messages in a workspace
router.get('/:workspaceId', async (req, res) => {
  try {
    const messages = await Message.find({ workspaceId: req.params.workspaceId }).sort('timestamp');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Save message (optional for persistence)
router.post('/', async (req, res) => {
  const { workspaceId, sender, content } = req.body;
  try {
    const newMsg = await Message.create({ workspaceId, sender, content });
    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save message' });
  }
});

module.exports = router;