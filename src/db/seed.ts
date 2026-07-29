import bcrypt from "bcryptjs";
import { db } from "./index";
import { llmConfig, users } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  // Insert default config row if not exists
  await db
    .insert(llmConfig)
    .values({
      id: 1,
      arkApiKey: "",
      // 不预置第三方中转；请在设置页或 env 自行配置
      baseUrl: "",
      textModel: "doubao-seed-2-0-pro-260215",
      imageModel: "doubao-seedream-4-5-251128",
    })
    .onConflictDoNothing();
  console.log("✓ Default LLM config seeded (empty baseUrl — configure in Settings)");

  // Create default admin user if not exists
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"));

  if (existingAdmin.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      role: "admin",
    });

    if (!process.env.ADMIN_PASSWORD) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  ⚠️  未设置 ADMIN_PASSWORD 环境变量");
      console.log("  默认管理员密码: admin123");
      console.log("  请登录后尽快修改密码！");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    } else {
      console.log("✓ Admin user seeded");
    }
  } else {
    console.log("✓ Admin user already exists");
  }

  process.exit(0);
}

seed();
