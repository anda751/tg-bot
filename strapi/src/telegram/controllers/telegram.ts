const telegram = {
  async webhook(ctx) {
    const body = ctx.request.body;
    console.log('Telegram update received:', JSON.stringify(body));

    const message = body?.message;
    if (!message) {
      ctx.send({ ok: true });
      return;
    }

    const chatId = message.chat.id;
    const text = message.text;

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `ได้รับข้อความ: ${text}`,
        }),
      }
    );

    ctx.send({ ok: true });
  },
};

export default telegram;