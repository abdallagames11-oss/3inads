exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { ok: false, error: 'Method Not Allowed' });
    }

    const body = JSON.parse(event.body || '{}');
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return json(500, { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
    }

    const allowedChats = {
      earnings: '-5560797837',
      promotion: '-5595158989',
      allWork: '-5286462295',
      client: '-5558262474'
    };

    async function sendMessage(chatId, text) {
      if (!text) return { skipped: true };
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true
        })
      });
      const data = await response.json();
      return { ok: response.ok && data.ok === true, data };
    }

    if (body.type === 'funds_update') {
      const current = Number(body.currentFunds || 0);
      const previous = Number(body.previousFunds || 0);
      const message =
        `🔔 تحديث مالي - شركة العين\n\n` +
        `💰 المال المتبقي: ${current.toLocaleString('en-US')} د.ع\n` +
        `📊 السابق: ${previous.toLocaleString('en-US')} د.ع`;

      const result = await sendMessage('7633080929', message);
      return json(result.ok ? 200 : 500, result.data);
    }

    if (body.type === 'work_notifications') {
      const results = {};

      // Every newly added work goes to the all-work group.
      results.allWork = await sendMessage(allowedChats.allWork, body.allWorkText);

      // Work with a financial profit goes to the earnings group.
      if (['designs', 'promotion', 'subscriptions', 'services'].includes(body.section)) {
        results.earnings = await sendMessage(allowedChats.earnings, body.profitText);
      }

      // Promotion campaigns get their dedicated group update.
      if (body.section === 'promotion') {
        results.promotion = await sendMessage(allowedChats.promotion, body.promotionText);
      }

      // Client-ready message goes to the client-message group.
      if (body.clientText) {
        results.client = await sendMessage(allowedChats.client, body.clientText);
      }

      const failed = Object.entries(results).some(([_, r]) => r && r.ok === false);
      return json(failed ? 500 : 200, { ok: !failed, results });
    }

    return json(400, { ok: false, error: 'Invalid request type' });
  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
};
