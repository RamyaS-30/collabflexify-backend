const mongoose = require('mongoose');

const WhiteboardSchema = new mongoose.Schema({
  workspaceId: {
    type: String,
    required: true,
    unique: true,
  },
  lines: {
    type: Array,
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Whiteboard', WhiteboardSchema);