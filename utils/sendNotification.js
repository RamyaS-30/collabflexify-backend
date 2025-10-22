const Notification = require("../models/Notification");

const sendNotification = async (io, onlineUsers, userId, type, payload) => {
  // Save in DB
  const saved = await Notification.create({
    user: userId,
    type,
    data: payload,
  });

  // Send real-time if user is online
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit("notification", {
      id: saved._id,
      type,
      data: payload,
      createdAt: saved.createdAt,
    });
  }
};

module.exports = sendNotification;