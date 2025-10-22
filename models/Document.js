const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  docId: { type: String, required: true, unique: true },
  workspace: { type: String, required: true },
  name: { type: String, default: 'Untitled Document' }, // Add name field
  data: { type: Buffer }, // Yjs encoded document stored as binary
  updatedAt: { type: Date, default: Date.now },
});

const Document = mongoose.model('Document', DocumentSchema);
module.exports = Document;