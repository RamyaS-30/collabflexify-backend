const sendNotification = require("../utils/sendNotification");

const createTask = async (req, res) => {
  const { workspaceId, taskData } = req.body;

  const newTask = await Task.create(taskData);

  const workspace = await Workspace.findById(workspaceId).populate("members");

  workspace.members.forEach((member) => {
    if (member._id.toString() !== req.user.id) {
      sendNotification(req.io, req.onlineUsers, member._id.toString(), "task-created", {
        taskId: newTask._id,
        title: newTask.title,
      });
    }
  });

  res.status(201).json(newTask);
};