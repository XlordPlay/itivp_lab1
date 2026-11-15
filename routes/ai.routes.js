const express = require('express');
const { runAgent } = require('../ai/agent');
const { HttpError } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ configured: Boolean(process.env.OPENROUTER_API_KEY), model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini' });
});

// POST /ai/chat { messages: [{ role: 'user' | 'assistant', content }] }
router.post('/chat', async (req, res) => {
  const history = (req.body?.messages || [])
    .filter((m) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!history.length || history.at(-1).role !== 'user') {
    throw new HttpError(400, 'Последнее сообщение должно быть от пользователя');
  }
  res.json(await runAgent(req.user.id, history));
});

module.exports = router;
