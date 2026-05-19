const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId: number, text: string, extra?: object) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra,
    }),
  });
}

export default () => {
  return async (ctx, next) => {
    if (ctx.method === 'POST' && ctx.path === '/api/telegram/webhook') {
      const body = ctx.request.body;
      const message = body?.message;

      if (!message) {
        ctx.status = 200;
        ctx.body = { ok: true };
        return;
      }

      const chatId = message.chat.id;
      const telegramId = String(message.from.id);
      const text = message.text || '';

      // ── /start ──────────────────────────────────────────
      if (text === '/start') {
        // เช็คว่ามี User ในระบบแล้วหรือยัง
        const users = await strapi.entityService.findMany(
          'plugin::users-permissions.user',
          { filters: { telegram_id: telegramId } }
        ) as any[];

        if (users.length > 0) {
          const user = users[0];
          if (user.account_status === 'Pending') {
            await sendMessage(chatId,
              `⏳ <b>รอการอนุมัติ</b>\n\nบัญชีของคุณยังรอ Manager อนุมัติอยู่ครับ`
            );
          } else {
            await sendMessage(chatId,
              `👋 ยินดีต้อนรับกลับมา <b>${user.full_name}</b>!\n\nพิมพ์ /tasks เพื่อดูงานของคุณ`
            );
          }
        } else {
          await sendMessage(chatId,
            `👋 <b>ยินดีต้อนรับสู่ระบบบริหารงาน</b>\n\nกรุณาส่งชื่อ-นามสกุลจริงของคุณเพื่อลงทะเบียน`
          );
        }
      }

      // ── /tasks ──────────────────────────────────────────
      else if (text === '/tasks') {
        const users = await strapi.entityService.findMany(
          'plugin::users-permissions.user',
          { filters: { telegram_id: telegramId } }
        ) as any[];

        if (users.length === 0) {
          await sendMessage(chatId, `❌ กรุณาลงทะเบียนก่อนโดยพิมพ์ /start`);
        } else {
          const user = users[0];
          const tasks = await strapi.entityService.findMany(
            'api::task.task',
            {
              filters: {
                current_owner: user.id,
                task_status: { $ne: 'Done' }
              },
              populate: ['project'],
            }
          ) as any[];

          if (tasks.length === 0) {
            await sendMessage(chatId, `📭 ไม่มีงานที่ต้องทำตอนนี้`);
          } else {
            let msg = `📋 <b>งานของคุณ (${tasks.length} งาน)</b>\n\n`;
            tasks.forEach((task, i) => {
              msg += `${i + 1}. <b>${task.task_name}</b>\n`;
              msg += `   สถานะ: ${task.task_status}\n\n`;
            });
            await sendMessage(chatId, msg);
          }
        }
      }

      // ── ข้อความทั่วไป (ลงทะเบียน) ──────────────────────
      else {
        const users = await strapi.entityService.findMany(
          'plugin::users-permissions.user',
          { filters: { telegram_id: telegramId } }
        ) as any[];

        if (users.length === 0) {
          // สร้าง User ใหม่
          await strapi.entityService.create(
            'plugin::users-permissions.user',
            {
              data: {
                telegram_id: telegramId,
                full_name: text,
                username: message.from.username || '',
                email: `${telegramId}@telegram.local`,
                password: Math.random().toString(36),
                provider: 'local',
                confirmed: true,
                role_level: 'Staff',
                account_status: 'Pending',
                role: 1,
              }
            }
          );

          await sendMessage(chatId,
            `✅ <b>ลงทะเบียนสำเร็จ!</b>\n\nชื่อ: ${text}\nสถานะ: รอ Manager อนุมัติ\n\nระบบจะแจ้งเตือนเมื่อได้รับการอนุมัติครับ`
          );
        } else {
          await sendMessage(chatId,
            `ไม่เข้าใจคำสั่งครับ\n\nคำสั่งที่ใช้ได้:\n/start - หน้าหลัก\n/tasks - ดูงานของฉัน`
          );
        }
      }

      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }
    await next();
  };
};