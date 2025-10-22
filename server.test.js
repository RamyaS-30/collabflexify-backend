const request = require('supertest');
const mongoose = require('mongoose');
require('dotenv').config();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('API route tests', () => {
  const baseUrl = 'http://localhost:5000';

  it('GET /api/whiteboard/:workspaceId should return default lines if not found', async () => {
    const res = await request(baseUrl).get('/api/whiteboard/test-workspace-id');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('lines');
    expect(Array.isArray(res.body.lines)).toBe(true);
  });

  it('POST /api/whiteboard/:workspaceId should save lines', async () => {
    const res = await request(baseUrl)
      .post('/api/whiteboard/test-workspace-id')
      .send({ lines: [{ x: 10, y: 20, color: '#000000' }] });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Whiteboard saved');
    expect(res.body).toHaveProperty('updated');
    expect(res.body.updated).toHaveProperty('workspaceId', 'test-workspace-id');
  });

  it('GET undefined route should return 404', async () => {
    const res = await request(baseUrl).get('/api/this-route-does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('message', 'Route not found');
  });
});