// Runs daily (see netlify.toml schedule) to check promotion campaigns and
// client subscriptions for upcoming/actual expirations, and posts alerts to
// the dedicated alerts group so the admin can forward the ready-made client
// message when something ends.

const FIREBASE_DATA_URL = 'https://oyoun-dashboard-default-rtdb.firebaseio.com/oyoun-dashboard-data.json';
const FIREBASE_ALERTS_URL = 'https://oyoun-dashboard-default-rtdb.firebaseio.com/oyoun-dashboard-alerts-sent.json';

// گروب التنبيهات (الترويج + الاشتراكات معاً)
const ALERTS_CHAT_ID = '-5307264710';

// كم يوم قبل انتهاء الاشتراك نسوي تنبيه مسبق
const SUBSCRIPTION_WARN_DAYS = [10, 5, 3, 1];

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmt(n) { return num(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function fmtDate(d) {
  if (!d) return '—';
  const parts = String(d).split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
// عدد الأيام من اليوم لغاية dateStr (موجب = بالمستقبل، صفر أو أقل = اليوم أو مضى)
function daysUntil(dateStr) {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

exports.handler = async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { statusCode: 500, body: 'TELEGRAM_BOT_TOKEN is not configured' };
  }

  async function sendAlert(text) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ALERTS_CHAT_ID, text, disable_web_page_preview: true })
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.ok === true;
    } catch (e) {
      return false;
    }
  }

  let state, sent;
  try {
    const [stateRes, sentRes] = await Promise.all([
      fetch(FIREBASE_DATA_URL),
      fetch(FIREBASE_ALERTS_URL)
    ]);
    state = (await stateRes.json()) || {};
    sent = (await sentRes.json()) || {};
  } catch (e) {
    return { statusCode: 500, body: 'Failed to read Firebase data: ' + e.message };
  }

  let changed = false;
  function markSent(key) {
    if (!sent[key]) { sent[key] = true; changed = true; }
  }

  // ==================== حملات الترويج ====================
  const promotions = state.promotion || [];
  for (const row of promotions) {
    if (!row.id || !row.date || !num(row.campaign_days)) continue;
    const endDate = addDays(row.date, num(row.campaign_days));
    const daysLeft = daysUntil(endDate);

    const beforeKey = `promo_before1_${row.id}`;
    if (daysLeft === 1 && !sent[beforeKey]) {
      const ok = await sendAlert(
        `⏰ تنبيه: حملة ترويج تنتهي غداً\n\n` +
        `👤 العميل: ${row.client || '—'}\n` +
        `📅 تاريخ البدء: ${fmtDate(row.date)}\n` +
        `📅 تاريخ الانتهاء: ${fmtDate(endDate)}\n` +
        `💵 الميزانية: $ ${fmt(row.budget_usd)}\n` +
        `💰 السعر: ${fmt(row.price)} د.ع`
      );
      if (ok) markSent(beforeKey);
    }

    const endedKey = `promo_ended_${row.id}`;
    if (daysLeft <= 0 && !sent[endedKey]) {
      const ok = await sendAlert(
        `🔴 انتهت حملة ترويج\n\n` +
        `👤 العميل: ${row.client || '—'}\n` +
        `📅 تاريخ البدء: ${fmtDate(row.date)}\n` +
        `📅 تاريخ الانتهاء: ${fmtDate(endDate)}\n` +
        `📆 المدة: ${row.campaign_days} يوم\n` +
        `💵 الميزانية: $ ${fmt(row.budget_usd)}\n` +
        `💰 السعر: ${fmt(row.price)} د.ع\n\n` +
        `✉️ رسالة جاهزة للإرسال للزبون:\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `انتهت مدة حملتكم الإعلانية بتاريخ ${fmtDate(endDate)}. نتمنى نكون حققنا نتائج جيدة، وبانتظار تواصلكم بخصوص تجديد الحملة 🌟`
      );
      if (ok) markSent(endedKey);
    }
  }

  // ==================== اشتراكات العملاء ====================
  const subscriptions = state.subscriptions || [];
  for (const row of subscriptions) {
    if (!row.id || !row.start_date) continue;
    const days = num(row.days_count) || 30;
    const endDate = addDays(row.start_date, days);
    const daysLeft = daysUntil(endDate);

    for (const warnDays of SUBSCRIPTION_WARN_DAYS) {
      const key = `sub_before${warnDays}_${row.id}`;
      if (daysLeft === warnDays && !sent[key]) {
        const ok = await sendAlert(
          `⏰ تنبيه: اشتراك عميل باقيله ${warnDays} ${warnDays === 1 ? 'يوم' : 'أيام'} على الانتهاء\n\n` +
          `👤 العميل: ${row.client || '—'}\n` +
          `📌 نوع الاشتراك: ${row.sub_type || '—'}\n` +
          `📅 تاريخ البدء: ${fmtDate(row.start_date)}\n` +
          `📅 تاريخ الانتهاء: ${fmtDate(endDate)}\n` +
          `💰 سعر الاشتراك: ${fmt(row.price)} د.ع`
        );
        if (ok) markSent(key);
      }
    }

    const endedKey = `sub_ended_${row.id}`;
    if (daysLeft <= 0 && !sent[endedKey]) {
      const ok = await sendAlert(
        `🔴 انتهى اشتراك عميل\n\n` +
        `👤 العميل: ${row.client || '—'}\n` +
        `📌 نوع الاشتراك: ${row.sub_type || '—'}\n` +
        `📅 تاريخ البدء: ${fmtDate(row.start_date)}\n` +
        `📅 تاريخ الانتهاء: ${fmtDate(endDate)}\n` +
        `📆 عدد الأيام: ${days} يوم\n` +
        `💰 سعر الاشتراك: ${fmt(row.price)} د.ع\n\n` +
        `✉️ رسالة جاهزة للإرسال للزبون:\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `انتهت مدة اشتراككم بتاريخ ${fmtDate(endDate)}. نتمنى تكونون راضين عن الخدمة، وبانتظار تجديد اشتراككم لمواصلة إدارة حملاتكم الإعلانية 🌟`
      );
      if (ok) markSent(endedKey);
    }
  }

  if (changed) {
    try {
      await fetch(FIREBASE_ALERTS_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sent)
      });
    } catch (e) {
      // Non-fatal: alerts were already sent even if bookkeeping failed to save.
    }
  }

  return { statusCode: 200, body: 'ok' };
};
