const express = require('express');
const router = express.Router();
const TaskBoard = require('../models/TaskBoard');
const mongoose = require('mongoose');

// Helper: generate random IDs for lists/tasks
const generateId = () => new mongoose.Types.ObjectId().toString();

// Get taskboard by workspaceId
router.get('/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;

  try {
    let board = await TaskBoard.findOne({ workspaceId });
    if (!board) {
      // Create new empty board if not found
      board = new TaskBoard({
        workspaceId,
        lists: [],
      });
      await board.save();
    }
    res.json(board);
  } catch (err) {
    console.error('GET taskboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new list to taskboard
router.post('/:workspaceId/lists', async (req, res) => {
  const { workspaceId } = req.params;
  const { title } = req.body;

  if (!title) return res.status(400).json({ message: 'List title required' });

  try {
    const board = await TaskBoard.findOne({ workspaceId });
    if (!board) return res.status(404).json({ message: 'TaskBoard not found' });

    const newList = {
      id: generateId(),
      title,
      tasks: [],
    };

    board.lists.push(newList);
    await board.save();
    res.status(201).json(newList);
  } catch (err) {
    console.error('POST add list error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a task to a specific list
router.post('/:workspaceId/lists/:listId/tasks', async (req, res) => {
  const { workspaceId, listId } = req.params;
  const { title, description, status, assignee, dueDate } = req.body;

  if (!title) return res.status(400).json({ message: 'Task title required' });

  try {
    const board = await TaskBoard.findOne({ workspaceId });
    if (!board) return res.status(404).json({ message: 'TaskBoard not found' });

    const list = board.lists.find((l) => l.id === listId);
    if (!list) return res.status(404).json({ message: 'List not found' });

    const newTask = {
      id: generateId(),
      title,
      description: description || '',
      status: status || 'todo',
      assignee: assignee || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: new Date(),
    };

    list.tasks.push(newTask);
    await board.save();

    res.status(201).json(newTask);
  } catch (err) {
    console.error('POST add task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update entire taskboard lists (useful for drag & drop reorder/move)
router.put('/:workspaceId', async (req, res) => {
  const { workspaceId } = req.params;
  const { lists } = req.body;

  if (!lists || !Array.isArray(lists)) {
    return res.status(400).json({ message: 'Lists array required' });
  }

  try {
    const board = await TaskBoard.findOneAndUpdate(
      { workspaceId },
      { lists },
      { new: true, upsert: true }
    );

    res.json(board);
  } catch (err) {
    console.error('PUT update taskboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a specific task by taskId (can update title, status, description, etc.)
router.put('/:workspaceId/tasks/:taskId', async (req, res) => {
  const { workspaceId, taskId } = req.params;
  const updates = req.body; // expected fields to update: title, status, assignee, etc.

  try {
    const board = await TaskBoard.findOne({ workspaceId });
    if (!board) return res.status(404).json({ message: 'TaskBoard not found' });

    let taskFound = false;
    board.lists.forEach((list) => {
      const task = list.tasks.find((t) => t.id === taskId);
      if (task) {
        Object.assign(task, updates);
        taskFound = true;
      }
    });

    if (!taskFound) return res.status(404).json({ message: 'Task not found' });

    await board.save();
    res.json({ message: 'Task updated' });
  } catch (err) {
    console.error('PUT update task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a task by taskId
router.delete('/:workspaceId/tasks/:taskId', async (req, res) => {
  const { workspaceId, taskId } = req.params;

  try {
    const board = await TaskBoard.findOne({ workspaceId });
    if (!board) return res.status(404).json({ message: 'TaskBoard not found' });

    let taskDeleted = false;
    board.lists.forEach((list) => {
      const taskIndex = list.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex > -1) {
        list.tasks.splice(taskIndex, 1);
        taskDeleted = true;
      }
    });

    if (!taskDeleted) return res.status(404).json({ message: 'Task not found' });

    await board.save();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('DELETE task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;