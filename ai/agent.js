const { HttpError } = require('../middleware/errorHandler');
const { catalog } = require('../mongo/categories');
const { definitions, handlers, describeAction } = require('./tools');
const { today: todayLocal } = require('../mongo/services');

const MAX_STEPS = 6;

function systemPrompt() {
  const today = todayLocal();
  return [
    'Ты финансовый ассистент в приложении учета личных финансов. Пользователь живет в Беларуси, валюта — белорусский рубль (Br).',
    `Сегодня ${today}. Текущий месяц ${today.slice(0, 7)}.`,
    `Категории расходов: ${catalog.expense.map((c) => c.name).join(', ')}. Категории доходов: ${catalog.income.map((c) => c.name).join(', ')}.`,
    'Любые цифры о деньгах пользователя бери только из инструментов, не придумывай. Не пересчитывай сам то, что инструмент уже посчитал (status, remaining, percent).',
    'Если пользователь просит записать трату или доход, сразу вызывай add_transaction, подобрав категорию. Покупки из списка передавай в items.',
    'Отвечай по-русски, коротко и по делу: 1–4 предложения или короткий список. Суммы пиши в формате «1 234,50 Br».',
  ].join('\n');
}

async function callModel(messages) {
  const base = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Finance Lab',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      messages,
      tools: definitions.map((fn) => ({ type: 'function', function: fn })),
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(502, `OpenRouter: ${data.error?.message || res.statusText}`);
  }
  const message = data.choices?.[0]?.message;
  if (!message) throw new HttpError(502, 'OpenRouter вернул пустой ответ');
  return message;
}

// Цикл агента: модель вызывает инструменты, пока не даст финальный ответ
async function runAgent(userId, history) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new HttpError(503, 'Ассистент не настроен: добавьте OPENROUTER_API_KEY в .env и перезапустите сервер');
  }

  const messages = [{ role: 'system', content: systemPrompt() }, ...history];
  const actions = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const message = await callModel(messages);
    const calls = message.tool_calls || [];
    if (!calls.length) return { reply: message.content || '', actions };

    messages.push({ role: 'assistant', content: message.content || null, tool_calls: calls });
    for (const call of calls) {
      const name = call.function?.name;
      let result;
      try {
        const args = JSON.parse(call.function?.arguments || '{}');
        if (!handlers[name]) throw new Error(`Неизвестный инструмент ${name}`);
        result = await handlers[name](userId, args);
        const action = describeAction(name, args, result);
        if (action) actions.push(action);
      } catch (err) {
        result = { error: err.message };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return { reply: 'Не удалось завершить запрос за отведенное число шагов. Попробуйте сформулировать проще.', actions };
}

module.exports = { runAgent };
