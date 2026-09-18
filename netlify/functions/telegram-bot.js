const FIREBASE_URL = 'https://oyoun-dashboard-default-rtdb.firebaseio.com/oyoun-dashboard-data.json';
const TEMPLATES_URL = 'https://oyoun-dashboard-default-rtdb.firebaseio.com/oyoun-dashboard-data/messageTemplates';
const BOT_STATE_URL = 'https://oyoun-dashboard-default-rtdb.firebaseio.com/oyoun-dashboard-bot-state';
const GROUPS_URL = 'https://oyoun-dashboard-default-rtdb.firebaseio.com/oyoun-dashboard-groups';

/* ===================== Editable template definitions ===================== */
const TEMPLATE_DEFS = {
  design: {
    label: '🎨 رسالة التصميم (تحديثات الأرباح)',
    placeholders: ['client', 'design_type', 'design_count', 'date', 'price', 'paid', 'remaining', 'today'],
    default: `🎨 عمل تصميم جديد

👤 اسم العميل: {client}
🎨 نوع التصميم: {design_type}
🔢 العدد: {design_count}
📅 تاريخ بدء العمل: {date}

💰 السعر: {price}
💵 المبلغ الواصل: {paid}
🧾 المبلغ المتبقي: {remaining}

📅 التاريخ: {today}`
  },

  promotion: {
    label: '📢 رسالة الترويج (قسم الترويج)',
    placeholders: ['client', 'budget_usd', 'price', 'paid', 'remaining', 'campaign_days', 'date', 'today'],
    default: `📢 حملة ترويج جديدة

👤 اسم العميل: {client}
💵 ميزانية الحملة: $ {budget_usd}
💰 سعر الحملة: {price}
💵 المبلغ الواصل: {paid}
🧾 المبلغ المتبقي: {remaining}
📆 مدة الحملة: {campaign_days} يوم
📅 تاريخ بدء الحملة: {date}

📅 التاريخ: {today}`
  },

  subscription: {
    label: '🔁 رسالة الاشتراك (تحديثات الأرباح)',
    placeholders: ['client', 'sub_type', 'price', 'paid', 'remaining', 'days', 'start_date', 'today'],
    default: `🔄 اشتراك جديد

👤 اسم العميل: {client}
📌 نوع الاشتراك: {sub_type}
💰 السعر: {price}
💵 المبلغ الواصل: {paid}
🧾 المبلغ المتبقي: {remaining}
📆 مدة الاشتراك: {days} يوم
📅 تاريخ بدء الاشتراك: {start_date}

📅 التاريخ: {today}`
  },

  service: {
    label: '🛠️ رسالة الخدمة (تحديثات الأرباح)',
    placeholders: ['client', 'service_type', 'price', 'paid', 'remaining', 'date', 'today'],
    default: `🛠️ خدمة جديدة

👤 اسم العميل: {client}
🛠️ نوع الخدمة: {service_type}
💰 السعر: {price}
💵 المبلغ الواصل: {paid}
🧾 المبلغ المتبقي: {remaining}
📅 التاريخ: {date}

📅 التاريخ: {today}`
  },

  all_work: {
    label: '🆕 رسالة العمل المضاف (المهام المضافة)',
    placeholders: ['section_label', 'client', 'details', 'date'],
    default: `🆕 عمل جديد تمت إضافته

👤 اسم العميل: {client}
📌 القسم: {section_label}

{details}

📅 التاريخ: {date}`
  },

  promoter: {
    label: '📋 تفاصيل الحملة (قسم الترويج)',
    placeholders: ['company_name', 'client', 'ad_content', 'goal', 'platform', 'date', 'campaign_days', 'budget_usd', 'budget_iqd'],
    default: `📋 تفاصيل حملة ترويج جديدة
{company_name}
━━━━━━━━━━━━━━━━

👤 اسم العميل:
{client}

📢 الإعلان المراد ترويجه:
{ad_content}

🎯 هدف الترويج:
{goal}

📱 المنصة:
{platform}

📅 تاريخ بدء الترويج:
{date}

⏳ مدة الترويج:
{campaign_days}

💵 ميزانية الحملة:
$ {budget_usd} = {budget_iqd} د.ع

━━━━━━━━━━━━━━━━
⏳ جاري العمل على الحملة، انتظروا بعد قليل سيتم إرسال صورة الحملة.

📢 {company_name}`
  }
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 200, body: 'OK' };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return { statusCode: 500, body: 'TELEGRAM_BOT_TOKEN is not configured' };
    }

    // Optional access control: set TELEGRAM_STATS_ALLOWED_USERS to a comma
    // separated list of Telegram user IDs (e.g. "111111,222222") in Netlify
    // env vars to restrict who can use this bot. Leave empty to allow anyone.
    const allowedUsers = (process.env.TELEGRAM_STATS_ALLOWED_USERS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    function isAllowed(userId) {
      if (allowedUsers.length === 0) return true;
      return allowedUsers.includes(String(userId));
    }

    const update = JSON.parse(event.body || '{}');

    // Auto-register any group/supergroup the bot sees activity from
    if (update.message && update.message.chat &&
        (update.message.chat.type === 'group' || update.message.chat.type === 'supergroup')) {
      await saveGroup(update.message.chat.id, update.message.chat.title || '');
    }

    // Track when the bot is added to / removed from a group
    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat;
      const newStatus = update.my_chat_member.new_chat_member && update.my_chat_member.new_chat_member.status;
      if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
        if (newStatus === 'member' || newStatus === 'administrator') {
          await saveGroup(chat.id, chat.title || '');
        } else if (newStatus === 'left' || newStatus === 'kicked') {
          await removeGroup(chat.id);
        }
      }
      return { statusCode: 200, body: 'ok' };
    }

    async function api(method, payload) {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res.json();
    }

    const mainMenu = {
      inline_keyboard: [
        [{ text: '🔄 تحديث الرصيد', callback_data: 'funds' }],
        [{ text: '📢 أرباح الترويج', callback_data: 'promo_profit' }, { text: '🎨 أرباح التصميم', callback_data: 'design_profit' }],
        [{ text: '🔁 أرباح الاشتراكات', callback_data: 'sub_profit' }],
        [{ text: '📋 ديون العملاء', callback_data: 'debts' }],
        [{ text: '💸 الصرف', callback_data: 'expenses' }, { text: '💰 القبض', callback_data: 'income' }],
        [{ text: '🔎 جرد عميل', callback_data: 'client_report' }],
        [{ text: '📤 رسالة لجميع الگروبات', callback_data: 'broadcast' }],
        [{ text: '✏️ تعديل رسائل الگروبات', callback_data: 'edit_templates' }]
      ]
    };
    const backMenu = {
      inline_keyboard: [
        ...mainMenu.inline_keyboard,
        [{ text: '⬅️ رجوع للقائمة الرئيسية', callback_data: 'menu' }]
      ]
    };
    const editTemplatesMenu = {
      inline_keyboard: [
        [{ text: TEMPLATE_DEFS.design.label, callback_data: 'tpl_design' }],
        [{ text: TEMPLATE_DEFS.promotion.label, callback_data: 'tpl_promotion' }],
        [{ text: TEMPLATE_DEFS.subscription.label, callback_data: 'tpl_subscription' }],
        [{ text: TEMPLATE_DEFS.service.label, callback_data: 'tpl_service' }],
        [{ text: TEMPLATE_DEFS.all_work.label, callback_data: 'tpl_all_work' }],
        [{ text: TEMPLATE_DEFS.promoter.label, callback_data: 'tpl_promoter' }],
        [{ text: '⬅️ رجوع للقائمة الرئيسية', callback_data: 'menu' }]
      ]
    };

    // ==================== Plain text messages ====================
    if (update.message && update.message.text) {
      const text = update.message.text.trim();
      const userId = update.message.from && update.message.from.id;
      const chatId = update.message.chat.id;

      if (!isAllowed(userId)) {
        await api('sendMessage', { chat_id: chatId, text: '🚫 غير مصرح لك باستخدام هذا البوت.' });
        return { statusCode: 200, body: 'ok' };
      }

      if (text === '/start') {
        await clearPendingState(userId);
        await api('sendMessage', {
          chat_id: chatId,
          text: '👋 أهلاً بك في بوت شركة العين للدعاية والإعلان\nاختر الإحصائية اللي تريد عرضها:',
          reply_markup: mainMenu
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (text === '/cancel') {
        await clearPendingState(userId);
        await api('sendMessage', { chat_id: chatId, text: '❌ تم الإلغاء.', reply_markup: mainMenu });
        return { statusCode: 200, body: 'ok' };
      }

      // Check if this user has a pending template edit
      const pending = await getPendingState(userId);
      if (pending && pending.pendingTemplateKey && TEMPLATE_DEFS[pending.pendingTemplateKey]) {
        const key = pending.pendingTemplateKey;
        await saveTemplate(key, update.message.text);
        await clearPendingState(userId);
        await api('sendMessage', {
          chat_id: chatId,
          text: `✅ تم حفظ الرسالة الجديدة لـ ${TEMPLATE_DEFS[key].label}`,
          reply_markup: mainMenu
        });
        return { statusCode: 200, body: 'ok' };
      }

      // ---- Client report (جرد عميل): step 1 - client name ----
      if (pending && pending.step === 'client_name') {
        await setPendingState(userId, null, { step: 'client_start', data: { clientName: text } });
        await api('sendMessage', {
          chat_id: chatId,
          text: '📅 من تاريخ (مثال: 2025-01-01)\nأو اكتب "الكل" لعرض كل السجلات بدون تحديد فترة.\n\nاكتب /cancel للإلغاء.'
        });
        return { statusCode: 200, body: 'ok' };
      }

      // ---- Client report: step 2 - start date (or "الكل") ----
      if (pending && pending.step === 'client_start') {
        if (text === 'الكل' || text === 'كل' || text.toLowerCase() === 'all') {
          const state = await fetchState();
          const report = buildClientReport(state, pending.data.clientName, null, null);
          await clearPendingState(userId);
          await api('sendMessage', { chat_id: chatId, text: report, reply_markup: mainMenu });
          return { statusCode: 200, body: 'ok' };
        }
        await setPendingState(userId, null, { step: 'client_end', data: { ...pending.data, startDate: text } });
        await api('sendMessage', { chat_id: chatId, text: '📅 الى تاريخ (مثال: 2025-12-31):\n\nاكتب /cancel للإلغاء.' });
        return { statusCode: 200, body: 'ok' };
      }

      // ---- Client report: step 3 - end date, then build report ----
      if (pending && pending.step === 'client_end') {
        const state = await fetchState();
        const report = buildClientReport(state, pending.data.clientName, pending.data.startDate, text);
        await clearPendingState(userId);
        await api('sendMessage', { chat_id: chatId, text: report, reply_markup: mainMenu });
        return { statusCode: 200, body: 'ok' };
      }

      // ---- Broadcast to groups: step 1 - message text, ask for confirmation ----
      if (pending && pending.step === 'broadcast_text') {
        const groups = await getGroups();
        const groupCount = Object.keys(groups || {}).length;
        await setPendingState(userId, null, { step: 'broadcast_confirm', data: { text: update.message.text } });
        await api('sendMessage', {
          chat_id: chatId,
          text: `📤 هذا نص الرسالة:\n\n${update.message.text}\n\n━━━━━━━━━━━━━━\nراح ترسل لـ ${groupCount} گروب. تأكيد الإرسال؟`,
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ تأكيد الإرسال', callback_data: 'broadcast_confirm' }],
              [{ text: '❌ إلغاء', callback_data: 'broadcast_cancel' }]
            ]
          }
        });
        return { statusCode: 200, body: 'ok' };
      }

      await api('sendMessage', { chat_id: chatId, text: 'اكتب /start لعرض القائمة.' });
      return { statusCode: 200, body: 'ok' };
    }

    // ==================== Button presses ====================
    if (update.callback_query) {
      const cq = update.callback_query;
      const userId = cq.from && cq.from.id;
      const chatId = cq.message.chat.id;
      const messageId = cq.message.message_id;
      const data = cq.data;

      if (!isAllowed(userId)) {
        await api('answerCallbackQuery', { callback_query_id: cq.id, text: '🚫 غير مصرح لك', show_alert: true });
        return { statusCode: 200, body: 'ok' };
      }

      await api('answerCallbackQuery', { callback_query_id: cq.id });

      if (data === 'menu') {
        await clearPendingState(userId);
        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: '👋 اختر الإحصائية اللي تريد عرضها:',
          reply_markup: mainMenu
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data === 'edit_templates') {
        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: '✏️ اختر الرسالة اللي تريد تعدلها:',
          reply_markup: editTemplatesMenu
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data.startsWith('tpl_')) {
        const key = data.slice(4);
        const def = TEMPLATE_DEFS[key];
        if (!def) return { statusCode: 200, body: 'ok' };

        const custom = await getStoredTemplate(key);
        const currentText = custom || def.default;
        const placeholdersText = def.placeholders.map(p => `{${p}}`).join('  ');

        await setPendingState(userId, key);

        const msgText = `✏️ تعديل: ${def.label}\n\n` +
          `📄 النص الحالي:\n\n${currentText}\n\n` +
          `━━━━━━━━━━━━━━\n` +
          `📌 المتغيرات المتاحة (انسخها بنصك الجديد بالضبط):\n${placeholdersText}\n\n` +
          `📩 ابعت النص الجديد الكامل هسه هنا وراح يتحفظ تلقائياً.\n` +
          `اكتب /cancel للإلغاء.`;

        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: msgText,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗑️ رجوع للنص الافتراضي', callback_data: 'reset_tpl_' + key }],
              [{ text: '⬅️ رجوع', callback_data: 'edit_templates' }]
            ]
          }
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data.startsWith('reset_tpl_')) {
        const key = data.slice('reset_tpl_'.length);
        const def = TEMPLATE_DEFS[key];
        await deleteStoredTemplate(key);
        await clearPendingState(userId);
        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: `✅ تم إرجاع النص الافتراضي لـ ${def ? def.label : key}`,
          reply_markup: editTemplatesMenu
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data === 'client_report') {
        await setPendingState(userId, null, { step: 'client_name', data: {} });
        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: '🔎 اكتب اسم العميل اللي تريد تسوي له جرد:\n\nاكتب /cancel للإلغاء.'
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data === 'broadcast') {
        const groups = await getGroups();
        const groupCount = Object.keys(groups || {}).length;
        await setPendingState(userId, null, { step: 'broadcast_text', data: {} });
        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: `📤 عدد الگروبات المسجلة حالياً: ${groupCount}\n\nاكتب النص اللي تريد إرساله لجميع الگروبات.\n\nاكتب /cancel للإلغاء.`
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data === 'broadcast_confirm') {
        const pendingBroadcast = await getPendingState(userId);
        if (!pendingBroadcast || pendingBroadcast.step !== 'broadcast_confirm' || !pendingBroadcast.data || !pendingBroadcast.data.text) {
          await api('editMessageText', {
            chat_id: chatId, message_id: messageId,
            text: '⚠️ ما فيه رسالة معلقة للإرسال. جرب من جديد.',
            reply_markup: mainMenu
          });
          return { statusCode: 200, body: 'ok' };
        }
        const groups = await getGroups();
        const groupIds = Object.keys(groups || {});
        let sent = 0, failed = 0;
        for (const gid of groupIds) {
          try {
            const res = await api('sendMessage', { chat_id: gid, text: pendingBroadcast.data.text });
            if (res && res.ok) sent++; else failed++;
          } catch (e) {
            failed++;
          }
        }
        await clearPendingState(userId);
        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: `✅ تم إرسال البث.\n📤 نجح: ${sent}\n❌ فشل: ${failed}\n📋 إجمالي الگروبات: ${groupIds.length}`,
          reply_markup: mainMenu
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data === 'broadcast_cancel') {
        await clearPendingState(userId);
        await api('editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: '❌ تم إلغاء الإرسال.',
          reply_markup: mainMenu
        });
        return { statusCode: 200, body: 'ok' };
      }

      if (data === 'expenses_detail' || data === 'income_detail') {
        const kind = data === 'expenses_detail' ? 'expenses' : 'income';
        const state = await fetchState();
        const text = buildOperationsDetail(state, kind);
        await api('editMessageText', { chat_id: chatId, message_id: messageId, text, reply_markup: backMenu });
        return { statusCode: 200, body: 'ok' };
      }

      const state = await fetchState();
      const text = buildStatsText(data, state);
      let markup = backMenu;
      if (data === 'expenses') {
        markup = { inline_keyboard: [[{ text: '📄 كل عمليات الصرف', callback_data: 'expenses_detail' }], ...backMenu.inline_keyboard] };
      } else if (data === 'income') {
        markup = { inline_keyboard: [[{ text: '📄 كل عمليات القبض', callback_data: 'income_detail' }], ...backMenu.inline_keyboard] };
      }
      await api('editMessageText', {
        chat_id: chatId, message_id: messageId,
        text, reply_markup: markup
      });
      return { statusCode: 200, body: 'ok' };
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};

/* ===================== Data fetching ===================== */
async function fetchState() {
  const res = await fetch(FIREBASE_URL);
  const data = await res.json();
  return data || {};
}

/* ===================== Template storage (Firebase) ===================== */
async function getStoredTemplate(key) {
  const res = await fetch(`${TEMPLATES_URL}/${key}.json`);
  const data = await res.json();
  return data || null;
}
async function saveTemplate(key, text) {
  await fetch(`${TEMPLATES_URL}/${key}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(text)
  });
}
async function deleteStoredTemplate(key) {
  await fetch(`${TEMPLATES_URL}/${key}.json`, { method: 'DELETE' });
}

/* ===================== Pending edit state (Firebase) ===================== */
async function getPendingState(userId) {
  const res = await fetch(`${BOT_STATE_URL}/${userId}.json`);
  const data = await res.json();
  return data || null;
}
async function setPendingState(userId, templateKey, extra) {
  const payload = { ts: Date.now() };
  if (templateKey) payload.pendingTemplateKey = templateKey;
  if (extra) Object.assign(payload, extra);
  await fetch(`${BOT_STATE_URL}/${userId}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
async function clearPendingState(userId) {
  await fetch(`${BOT_STATE_URL}/${userId}.json`, { method: 'DELETE' });
}

/* ===================== Registered groups (Firebase) ===================== */
async function getGroups() {
  const res = await fetch(`${GROUPS_URL}.json`);
  const data = await res.json();
  return data || {};
}
async function saveGroup(chatId, title) {
  await fetch(`${GROUPS_URL}/${chatId}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || '', updated: Date.now() })
  });
}
async function removeGroup(chatId) {
  await fetch(`${GROUPS_URL}/${chatId}.json`, { method: 'DELETE' });
}

/* ===================== Calculations (mirrors index.html logic) ===================== */
function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function normName(s) { return (s || '').toString().trim().replace(/\s+/g, ' '); }
function fmt(n) { return num(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function calcProfit(paid, due) { return Math.max(0, num(paid) - num(due)); }
function computeRemaining(row) { return num(row.price) - num(row.paid); }

function computeRowProfit(section, row) {
  if (section === 'designs') return calcProfit(row.paid, row.designer_due);
  if (section === 'promotion') {
    const rate = num(row.exchange_rate) || 1380;
    const budgetIqd = num(row.budget_usd) * rate;
    return calcProfit(row.paid, budgetIqd);
  }
  if (section === 'subscriptions') return calcProfit(row.paid, 0);
  if (section === 'services') return calcProfit(row.paid, row.service_due);
  return 0;
}

function sectionStats(state, section) {
  const rows = state[section] || [];
  const count = rows.length;
  const totalPrice = rows.reduce((a, r) => a + num(r.price), 0);
  const totalPaid = rows.reduce((a, r) => a + num(r.paid), 0);
  const totalRemaining = rows.reduce((a, r) => a + computeRemaining(r), 0);
  const totalProfit = rows.reduce((a, r) => a + computeRowProfit(section, r), 0);
  return { count, totalPrice, totalPaid, totalRemaining, totalProfit };
}

function computeDebtsAuto(state) {
  const order = [['designs', 'design_debt'], ['promotion', 'promo_debt'], ['subscriptions', 'sub_debt'], ['services', 'service_debt']];
  const map = {};
  order.forEach(([sec, key]) => {
    (state[sec] || []).forEach(row => {
      const name = normName(row.client);
      if (!name) return;
      const rem = computeRemaining(row);
      if (!map[name]) map[name] = { client: row.client, design_debt: 0, promo_debt: 0, sub_debt: 0, service_debt: 0 };
      map[name][key] += rem;
    });
  });
  return Object.values(map)
    .map(r => ({ ...r, total: r.design_debt + r.promo_debt + r.sub_debt + r.service_debt }))
    .filter(r => r.total > 0.001)
    .sort((a, b) => b.total - a.total);
}

function grandTotals(state) {
  const designStats = sectionStats(state, 'designs');
  const promoStats = sectionStats(state, 'promotion');
  const subStats = sectionStats(state, 'subscriptions');
  const serviceStats = sectionStats(state, 'services');
  const grossProfit = designStats.totalProfit + promoStats.totalProfit + subStats.totalProfit + serviceStats.totalProfit;

  const capitalIncome = (state.income || []).reduce((a, r) => r.income_type === 'رأس مال' ? a + num(r.amount) : a, 0);
  const totalExpense = (state.expenses || []).reduce((a, e) => a + num(e.amount), 0);
  const availableFunds = grossProfit + capitalIncome - totalExpense;

  const debts = computeDebtsAuto(state);
  const totalDebts = debts.reduce((a, r) => a + r.total, 0);

  return { grossProfit, capitalIncome, totalExpense, availableFunds, totalDebts };
}

/* ===================== Client statement (جرد عميل) ===================== */
function parseDateSafe(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function inDateRange(dateStr, start, end) {
  if (!start && !end) return true;
  const d = parseDateSafe(dateStr);
  if (!d) return true; // can't parse the row's date -> don't exclude it
  if (start) {
    const sd = parseDateSafe(start);
    if (sd && d < sd) return false;
  }
  if (end) {
    const ed = parseDateSafe(end);
    if (ed && d > ed) return false;
  }
  return true;
}

function addDaysLocal(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function subscriptionStatusLabel(row) {
  if (!row.start_date) return '';
  const days = num(row.days_count) || 30;
  const end = addDaysLocal(row.start_date, days);
  const endDate = new Date(end + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((endDate - today) / 86400000);
  return daysLeft <= 0 ? ` | ❌ منتهي (انتهى ${end})` : ` | ⏳ باقي ${daysLeft} يوم (ينتهي ${end})`;
}

function clientAvailableCredit(state, clientName) {
  const target = normName(clientName);
  if (!target) return 0;
  const totalIncome = (state.income || []).reduce((a, r) =>
    (r.income_type === 'قبض من عميل' && normName(r.client) === target) ? a + num(r.amount) : a, 0);
  const workSections = ['designs', 'promotion', 'subscriptions', 'services'];
  const totalPaidAcrossWork = workSections.reduce((a, sec) =>
    a + (state[sec] || []).reduce((b, row) => normName(row.client) === target ? b + num(row.paid) : b, 0), 0);
  return Math.max(0, totalIncome - totalPaidAcrossWork);
}

function buildClientReport(state, clientName, startDate, endDate) {
  const target = normName(clientName);
  const sections = [
    { key: 'designs', label: '🎨 تصاميم', dateField: 'date' },
    { key: 'promotion', label: '📢 ترويج', dateField: 'date' },
    { key: 'subscriptions', label: '🔁 اشتراكات', dateField: 'start_date' },
    { key: 'services', label: '🛠️ خدمات', dateField: 'date' }
  ];

  let totalPrice = 0, totalPaid = 0, totalRemaining = 0, found = 0;
  const blocks = [];

  sections.forEach(sec => {
    const rows = (state[sec.key] || []).filter(r =>
      normName(r.client) === target && inDateRange(r[sec.dateField], startDate, endDate)
    );
    if (rows.length === 0) return;
    found += rows.length;
    const lines = rows.map(r => {
      const remaining = computeRemaining(r);
      totalPrice += num(r.price);
      totalPaid += num(r.paid);
      totalRemaining += remaining;
      const statusLabel = sec.key === 'subscriptions' ? subscriptionStatusLabel(r) : '';
      return `📅 ${r[sec.dateField] || '-'} | 💰 ${fmt(r.price)} | 💵 ${fmt(r.paid)} | 🧾 ${fmt(remaining)}${statusLabel}`;
    });
    blocks.push(`${sec.label} (${rows.length})\n` + lines.join('\n'));
  });

  if (found === 0) {
    return `🔎 جرد العميل: ${clientName}\n\n❌ ما فيه أي سجلات مطابقة${startDate ? ' بهذي الفترة' : ''}.`;
  }

  const rangeLabel = startDate ? `من ${startDate} الى ${endDate || 'الآن'}` : 'كل الفترة';
  const availableCredit = clientAvailableCredit(state, clientName);
  const creditLine = availableCredit > 0.001 ? `\n💳 رصيد مقبوض غير مستخدم: ${fmt(availableCredit)} د.ع` : '';
  return `🔎 جرد العميل: ${clientName}\n📆 ${rangeLabel}\n\n` + blocks.join('\n\n') +
    `\n\n━━━━━━━━━━━━━━\n💰 إجمالي السعر: ${fmt(totalPrice)} د.ع\n💵 إجمالي الواصل: ${fmt(totalPaid)} د.ع\n🧾 إجمالي المتبقي: ${fmt(totalRemaining)} د.ع${creditLine}`;
}

/* ===================== Itemized operations (expenses/income) ===================== */
function buildOperationsDetail(state, kind) {
  const rows = state[kind] || [];
  const titleBase = kind === 'expenses' ? '💸 كل عمليات الصرف' : '💰 كل عمليات القبض';
  if (rows.length === 0) return `${titleBase}\n\n✅ لا توجد عمليات.`;

  const MAX = 30;
  const shown = rows.slice(0, MAX);
  const lines = shown.map(r => {
    const dateVal = r.date || '-';
    if (kind === 'expenses') {
      return `📅 ${dateVal} | 💸 ${fmt(r.amount)} د.ع | 📂 ${r.source || '-'}${r.note ? ' | 📝 ' + r.note : ''}`;
    }
    return `📅 ${dateVal} | 💰 ${fmt(r.amount)} د.ع | 📂 ${r.income_type || '-'}${r.note ? ' | 📝 ' + r.note : ''}`;
  });

  let text = `${titleBase} (${rows.length})\n\n` + lines.join('\n');
  if (rows.length > MAX) text += `\n\n... و${rows.length - MAX} عملية أخرى`;
  return text;
}

/* ===================== Message builders (stats buttons) ===================== */
function buildStatsText(kind, state) {
  if (kind === 'funds') {
    const t = grandTotals(state);
    const totalIncome = (state.income || []).reduce((a, r) => a + num(r.amount), 0);
    return `🔔 تحديث الرصيد - شركة العين\n\n` +
      `💰 المال المتبقي: ${fmt(t.availableFunds)} د.ع\n` +
      `📈 إجمالي الربح: ${fmt(t.grossProfit)} د.ع\n` +
      `💸 إجمالي الصرف: ${fmt(t.totalExpense)} د.ع\n` +
      `💵 إجمالي القبض: ${fmt(totalIncome)} د.ع\n` +
      `📋 إجمالي الديون: ${fmt(t.totalDebts)} د.ع`;
  }

  if (kind === 'promo_profit') {
    const s = sectionStats(state, 'promotion');
    return `📢 أرباح قسم الترويج\n\n` +
      `📊 عدد الحملات: ${s.count}\n` +
      `💰 إجمالي السعر: ${fmt(s.totalPrice)} د.ع\n` +
      `💵 إجمالي الواصل: ${fmt(s.totalPaid)} د.ع\n` +
      `🧾 إجمالي المتبقي: ${fmt(s.totalRemaining)} د.ع\n` +
      `📈 صافي الربح: ${fmt(s.totalProfit)} د.ع`;
  }

  if (kind === 'design_profit') {
    const s = sectionStats(state, 'designs');
    return `🎨 أرباح قسم التصميم\n\n` +
      `📊 عدد الأعمال: ${s.count}\n` +
      `💰 إجمالي السعر: ${fmt(s.totalPrice)} د.ع\n` +
      `💵 إجمالي الواصل: ${fmt(s.totalPaid)} د.ع\n` +
      `🧾 إجمالي المتبقي: ${fmt(s.totalRemaining)} د.ع\n` +
      `📈 صافي الربح: ${fmt(s.totalProfit)} د.ع`;
  }

  if (kind === 'sub_profit') {
    const s = sectionStats(state, 'subscriptions');
    return `🔁 أرباح قسم الاشتراكات\n\n` +
      `📊 عدد الاشتراكات: ${s.count}\n` +
      `💰 إجمالي السعر: ${fmt(s.totalPrice)} د.ع\n` +
      `💵 إجمالي الواصل: ${fmt(s.totalPaid)} د.ع\n` +
      `🧾 إجمالي المتبقي: ${fmt(s.totalRemaining)} د.ع\n` +
      `📈 صافي الربح: ${fmt(s.totalProfit)} د.ع`;
  }

  if (kind === 'debts') {
    const debts = computeDebtsAuto(state);
    if (debts.length === 0) return '📋 ديون العملاء\n\n✅ لا توجد ديون حالياً';
    const MAX = 25;
    const shown = debts.slice(0, MAX);
    const lines = shown.map(d => {
      const parts = [];
      if (d.design_debt > 0.001) parts.push(`تصميم: ${fmt(d.design_debt)}`);
      if (d.promo_debt > 0.001) parts.push(`ترويج: ${fmt(d.promo_debt)}`);
      if (d.sub_debt > 0.001) parts.push(`اشتراك: ${fmt(d.sub_debt)}`);
      if (d.service_debt > 0.001) parts.push(`خدمة: ${fmt(d.service_debt)}`);
      return `👤 ${d.client}\n${parts.join(' | ')}\n💳 الإجمالي: ${fmt(d.total)} د.ع`;
    });
    let text = `📋 ديون العملاء (${debts.length})\n\n` + lines.join('\n\n');
    if (debts.length > MAX) text += `\n\n... و${debts.length - MAX} عميل آخر`;
    text += `\n\n━━━━━━━━━━━━━━\n💳 إجمالي الديون: ${fmt(debts.reduce((a, r) => a + r.total, 0))} د.ع`;
    return text;
  }

  if (kind === 'expenses') {
    const rows = state.expenses || [];
    const total = rows.reduce((a, e) => a + num(e.amount), 0);
    const fromProfit = rows.filter(e => e.source === 'اجمالي الربح').reduce((a, e) => a + num(e.amount), 0);
    const fromCapital = rows.filter(e => e.source === 'رأس المال').reduce((a, e) => a + num(e.amount), 0);
    return `💸 المصاريف\n\n` +
      `📊 عدد العمليات: ${rows.length}\n` +
      `💰 إجمالي الصرف: ${fmt(total)} د.ع\n` +
      `📉 من إجمالي الربح: ${fmt(fromProfit)} د.ع\n` +
      `🏦 من رأس المال: ${fmt(fromCapital)} د.ع`;
  }

  if (kind === 'income') {
    const rows = state.income || [];
    const total = rows.reduce((a, r) => a + num(r.amount), 0);
    const capital = rows.filter(r => r.income_type === 'رأس مال').reduce((a, r) => a + num(r.amount), 0);
    const fromClients = total - capital;
    return `💰 المقبوضات\n\n` +
      `📊 عدد العمليات: ${rows.length}\n` +
      `💵 إجمالي القبض: ${fmt(total)} د.ع\n` +
      `🏦 رأس المال: ${fmt(capital)} د.ع\n` +
      `👤 من العملاء: ${fmt(fromClients)} د.ع`;
  }

  return 'غير معروف';
}
