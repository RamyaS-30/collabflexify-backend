const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Workspace = require('../models/Workspace');

// Utility to generate an 8-char alphanumeric invite code
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 10); // e.g., 'abc123xy'
};

// Create a workspace
router.post('/create', async (req, res) => {
  try {
    const { clerkUserId, name } = req.body;

    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ message: "User not found" });

    let inviteCode;
    let isUnique = false;

    // Ensure inviteCode is unique
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const exists = await Workspace.findOne({ inviteCode });
      if (!exists) isUnique = true;
    }

    const workspace = await Workspace.create({
      name,
      members: [user._id],
      inviteCode,
    });

    user.workspaces.push(workspace._id);
    await user.save();

    res.status(201).json(workspace);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Join a workspace (by ID, name, or inviteCode)
router.post('/join', async (req, res) => {
  try {
    const { clerkUserId, workspaceId, workspaceName, inviteCode } = req.body;

    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ message: "User not found" });

    let workspace = null;

    if (inviteCode) {
      workspace = await Workspace.findOne({ inviteCode });
    }

    if (!workspace && workspaceId && workspaceId.match(/^[0-9a-fA-F]{24}$/)) {
      workspace = await Workspace.findById(workspaceId);
    }

    if (!workspace && workspaceName) {
      workspace = await Workspace.findOne({ name: workspaceName });
    }

    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    if (!workspace.members.includes(user._id)) {
      workspace.members.push(user._id);
      await workspace.save();
    }

    if (!user.workspaces.includes(workspace._id)) {
      user.workspaces.push(workspace._id);
      await user.save();
    }

    res.json({ message: "Joined workspace successfully", workspace });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// Get all workspaces for a user
router.get('/user/:clerkUserId', async (req, res) => {
  try {
    const user = await User.findOne({ clerkUserId: req.params.clerkUserId }).populate("workspaces");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.workspaces);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get workspace by invite code
router.get('/invite/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const workspace = await Workspace.findOne({ inviteCode: code });

    if (!workspace) {
      return res.status(404).json({ message: "Invalid invite code" });
    }

    res.json(workspace);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;