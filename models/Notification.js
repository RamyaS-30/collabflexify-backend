const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: String, required: true }, // <-- change from ObjectId to String
  type: { type: String, required: true },
  data: { type: Object },
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);