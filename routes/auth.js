const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @route POST /api/create-user
router.post('/create-user', async (req, res) => {
  try {
    const { clerkUserId, username, email } = req.body;

    if (!clerkUserId || !username || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prevent duplicate entries
    const existing = await User.findOne({ clerkUserId });
    if (existing) {
      return res.status(200).json({ message: 'User already exists' });
    }

    const newUser = new User({ clerkUserId, username, email });
    await newUser.save();

    res.status(201).json({ message: 'User saved in DB' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/user/:clerkUserId', async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const user = await User.findOne({ clerkUserId }).populate('workspaces');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create user if not exists
router.post('/user/init', async (req, res) => {
  const { clerkUserId, username, email } = req.body;

  if (!clerkUserId) return res.status(400).json({ message: "Missing clerkUserId" });

  try {
    let user = await User.findOne({ clerkUserId });

    if (!user) {
      user = await User.create({
        clerkUserId,
        username,
        email,
        workspaces: [],
      });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;