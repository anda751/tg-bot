// ============================================================
// src/api/auth-telegram/controllers/telegram.ts
// ใช้ field จริง: telegram_id, role_level, account_status, full_name
// ============================================================

import crypto from "crypto";

const BOT_TOKEN = process.env.BOT_TOKEN!;

function verifyTelegramInitData(initData: string): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (expectedHash !== hash) return null;

    const authDate = parseInt(params.get("auth_date") ?? "0", 10);
    if (Math.floor(Date.now() / 1000) - authDate > 3600) return null;

    const result: Record<string, string> = {};
    params.forEach((v, k) => { result[k] = v; });
    return result;
  } catch {
    return null;
  }
}

export default {

  // ================================================================
  // POST /api/auth/telegram
  // ตรวจสอบ initData → ออก JWT
  // ================================================================
  async login(ctx: any) {
    const { initData } = ctx.request.body as { initData: string };
    if (!initData) return ctx.badRequest("ไม่มีข้อมูล initData");

    const verified = verifyTelegramInitData(initData);
    if (!verified) return ctx.unauthorized("initData ไม่ถูกต้องหรือหมดอายุแล้ว");

    let telegramUser: any;
    try {
      telegramUser = JSON.parse(verified.user ?? "{}");
    } catch {
      return ctx.badRequest("ข้อมูล user ใน initData ไม่ถูกต้อง");
    }

    const telegramId = String(telegramUser.id);
    if (!telegramId) return ctx.badRequest("ไม่พบ Telegram ID");

    // ค้นหา user ด้วย telegram_id (field จริง)
    const existingUsers = await strapi.entityService.findMany(
      "plugin::users-permissions.user",
      {
        filters: { telegram_id: telegramId } as any,
        populate: ["role"],
      }
    );

    const existingUser = existingUsers?.[0] as any;

    if (!existingUser) {
      // ยังไม่มีในระบบ
      return ctx.send({
        registered: false,
        telegramId,
        firstName: telegramUser.first_name,
        username: telegramUser.username,
      });
    }

    const jwt = strapi
      .plugin("users-permissions")
      .service("jwt")
      .issue({ id: existingUser.id });

    return ctx.send({
      registered: true,
      jwt,
      user: {
        id: existingUser.id,
        username: existingUser.username,
        telegram_id: existingUser.telegram_id,
        full_name: existingUser.full_name,
        account_status: existingUser.account_status,   // "Pending" | "Approved"
        role_level: existingUser.role_level,           // "Manager" | "Staff"
      },
    });
  },

  // ================================================================
  // POST /api/auth/telegram/register
  // สมัครสมาชิกใหม่ → account_status: "Pending"
  // ================================================================
  async register(ctx: any) {
    const {
      telegramId,
      telegramUsername,
      firstName,
    } = ctx.request.body as {
      telegramId: string;
      telegramUsername?: string;
      firstName: string;
    };

    if (!telegramId || !firstName) {
      return ctx.badRequest("กรุณากรอกข้อมูลให้ครบ");
    }

    // ตรวจว่ามีในระบบแล้วหรือยัง
    const existing = await strapi.entityService.findMany(
      "plugin::users-permissions.user",
      { filters: { telegram_id: telegramId } as any }
    );
    if ((existing as any[])?.length > 0) {
      return ctx.badRequest("Telegram ID นี้ถูกลงทะเบียนไปแล้ว");
    }

    // role "Authenticated"
    const staffRole = await strapi
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } });

    // สร้าง username
    const baseUsername = telegramUsername ?? `tg_${telegramId}`;
    const existingUname = await strapi.entityService.findMany(
      "plugin::users-permissions.user",
      { filters: { username: baseUsername } as any }
    );
    const finalUsername =
      (existingUname as any[])?.length > 0
        ? `${baseUsername}_${telegramId.slice(-4)}`
        : baseUsername;

    const newUser = await strapi.entityService.create(
      "plugin::users-permissions.user",
      {
        data: {
          username: finalUsername,
          email: `${telegramId}@telegram.local`,
          password: crypto.randomBytes(20).toString("hex"),
          confirmed: true,
          blocked: false,
          role: staffRole?.id,
          telegram_id: telegramId,           // field จริง
          full_name: firstName,              // field จริง
          account_status: "Pending",         // enum จริง
          role_level: "Staff",               // enum จริง
        } as any,
      }
    );

    const jwt = strapi
      .plugin("users-permissions")
      .service("jwt")
      .issue({ id: (newUser as any).id });

    return ctx.send({
      jwt,
      user: {
        id: (newUser as any).id,
        username: (newUser as any).username,
        telegram_id: (newUser as any).telegram_id,
        full_name: (newUser as any).full_name,
        account_status: (newUser as any).account_status,
        role_level: (newUser as any).role_level,
      },
    });
  },
};
