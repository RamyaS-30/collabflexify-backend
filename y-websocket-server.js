const http = require('http');
const WebSocket = require('ws');
const Y = require('yjs');
const mongoose = require('mongoose');
const { setupWSConnection } = require('y-websocket/bin/utils');
// Map from docName to workspaceId
const docWorkspaceMap = new Map();


// --- Mongoose Document model ---
const DocumentSchema = new mongoose.Schema({
  docId: { type: String, required: true, unique: true },
  workspace: { type: String, required: true },
  data: { type: Buffer },
  updatedAt: { type: Date, default: Date.now },
});

const Document = mongoose.model('Document', DocumentSchema);

// --- MongoDB connection ---
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yjs-collab';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// --- Server Setup ---
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Y-WebSocket server running');
});

const wss = new WebSocket.Server({ server });

// In-memory docs map: docName => Y.Doc
const docs = new Map();

// --- Load document from MongoDB or create new ---
async function loadDocument(docName) {
  const existingDoc = await Document.findOne({ docId: docName });
  const ydoc = new Y.Doc();

  if (existingDoc?.data) {
    Y.applyUpdate(ydoc, existingDoc.data);
    console.log(`📄 Loaded document snapshot for ${docName}`);
  } else {
    console.log(`🆕 Creating new document for ${docName}`);
  }

  return ydoc;
}

// Helper to get Y.Doc for a docName, loading from DB if needed
async function getYDoc(docName) {
  if (!docs.has(docName)) {
    const ydoc = await loadDocument(docName);
    docs.set(docName, ydoc);
  }
  return docs.get(docName);
}

function getWorkspaceIdFromUrl(req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const wsId = url.searchParams.get('workspaceId');
    if (!wsId) return null;
    return wsId.split('/')[0];  // strip anything after first '/'
  } catch (err) {
    console.error('Failed to parse workspaceId from URL:', err);
    return null;
  }
}

// --- WebSocket connection handling ---
wss.on('connection', async (conn, req) => {
  try {
    const docName = req.url.slice(1).split('?')[0];
    const workspaceId = getWorkspaceIdFromUrl(req);

    if (!workspaceId) {
      console.warn(`⚠️ Missing workspaceId for doc: ${docName}`);
    } else {
      docWorkspaceMap.set(docName, workspaceId);
    }

    const ydoc = await getYDoc(docName);
    setupWSConnection(conn, req, { docMap: new Map([[docName, ydoc]]) });
  } catch (error) {
    console.error('❌ Error during connection setup:', error);
    conn.close();
  }
});

// --- Periodically save docs to MongoDB ---
setInterval(async () => {
  for (const [docName, ydoc] of docs.entries()) {
    try {
      const encodedState = Buffer.from(Y.encodeStateAsUpdate(ydoc));
      const workspaceId = docWorkspaceMap.get(docName);

      if (!workspaceId) {
        console.warn(`⚠️ Skipping save: Could not extract workspaceId from docName: ${docName}`);
        continue;
      }

      const existingDoc = await Document.findOne({ docId: docName });

      if (existingDoc) {
        existingDoc.data = encodedState;
        existingDoc.workspace = workspaceId;
        existingDoc.updatedAt = new Date();
        await existingDoc.save();
      } else {
        await Document.findOneAndUpdate(
        { docId: docName },
        {
          docId: docName,
          workspace: workspaceId,
          data: encodedState,
          updatedAt: new Date(),
        },
        { upsert: true }
      );
      }
      console.log(`✅ Saved document snapshot: ${docName} (workspace: ${workspaceId})`);
    } catch (err) {
      console.error(`❌ Error saving document ${docName}:`, err);
    }
  }
}, 30000); // every 30 seconds

// --- Start HTTP & WebSocket server ---
const PORT = process.env.Y_WEBSOCKET_PORT || 1234;
server.listen(PORT, () => {
  console.log(`🚀 Y-WebSocket server running on port ${PORT}`);
});