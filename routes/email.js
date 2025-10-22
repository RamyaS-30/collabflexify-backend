// routes/email.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.post('/send-invite', async (req, res) => {
  const { to, inviteLink } = req.body;

  if (!to || !inviteLink) {
    return res.status(400).json({ message: "Missing email or invite link." });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
  user: process.env.GMAIL_USER,
  pass: process.env.GMAIL_PASS,
},
  });

  const mailOptions = {
    from: 'Your App <your-gmail@gmail.com>',
    to,
    subject: 'You are invited to join a workspace!',
    text: `Hi there!\n\nYou've been invited to join a workspace. Click the link below:\n\n${inviteLink}\n\nCheers!`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "Invite email sent successfully!" });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ message: "Failed to send email." });
  }
});

module.exports = router;