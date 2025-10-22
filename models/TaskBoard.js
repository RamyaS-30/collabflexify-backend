const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  id: String, // unique id for task
  title: String,
  description: String,
  status: String, // e.g. "todo", "in-progress", "done"
  assignee: String, // userId or name
  dueDate: Date,
  createdAt: { type: Date, default: Date.now },
});

const ListSchema = new mongoose.Schema({
  id: String, // unique id for list
  title: String,
  tasks: [TaskSchema],
});

const TaskBoardSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  lists: [ListSchema],
});

TaskBoardSchema.index({ workspaceId: 1 }, { unique: true });

module.exports = mongoose.model('TaskBoard', TaskBoardSchema);