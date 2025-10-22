const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");

// Middleware to check if user is authenticated
function requireUser(req, res, next) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(requireUser);

// GET all notifications for the logged-in user
router.get("/", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /:id/read - Mark one notification as read
router.put("/:id/read", async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// PUT /read-all - Mark all notifications as read
router.put("/read-all", async (req, res) => {
  try {
    const userId = req.auth.userId;
    await Notification.updateMany({ user: userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    console.error("Error marking all as read:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

module.exports = router;