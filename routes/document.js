const express = require('express');
const router = express.Router();
const Document = require('../models/Document');

// Get all documents for a workspace
router.get('/workspace/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;

  try {
    const documents = await Document.find({ workspace: workspaceId });
    res.json(documents || []);
  } catch (err) {
    console.error('Error fetching documents for workspace:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single document by docId
router.get('/:docId', async (req, res) => {
  const { docId } = req.params;

  try {
    const document = await Document.findOne({ docId });
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      docId: document.docId,
      workspace: document.workspace,
      name: document.name,
      data: document.data?.toString('base64') || null,
      updatedAt: document.updatedAt,
    });
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new document
router.post('/create', async (req, res) => {
  const { docId, workspace, name, data } = req.body;

  try {
    const existing = await Document.findOne({ docId });
    if (existing) {
      return res.status(409).json({ error: 'Document already exists' });
    }

    const newDoc = new Document({
      docId,
      workspace,
      name: name || 'Untitled Document',
      data: data ? Buffer.from(data, 'base64') : Buffer.alloc(0),
    });

    await newDoc.save();

    res.status(201).json({
      docId: newDoc.docId,
      workspace: newDoc.workspace,
      name: newDoc.name,
      _id: newDoc._id.toString(),
    });
  } catch (err) {
    console.error('Error creating document:', err);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Update/save document (name + Yjs state)
router.put('/:docId', async (req, res) => {
  const { docId } = req.params;
  const { data, name } = req.body;

  try {
    const document = await Document.findOne({ docId });
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (data) document.data = Buffer.from(data, 'base64');
    if (name) document.name = name;

    document.updatedAt = new Date();
    await document.save();

    res.json({ success: true, updatedAt: document.updatedAt });
  } catch (err) {
    console.error('Error saving document:', err);
    res.status(500).json({ error: 'Failed to save document' });
  }
});

module.exports = router;