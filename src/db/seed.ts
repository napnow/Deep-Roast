import bcrypt from "bcryptjs";
import { db } from "./index";
import { llmConfig, styles, users } from "./schema";
import { eq } from "drizzle-orm";
import { requireAdminSeedPassword } from "./seed-policy";

// 图生图风格预设：与旧版前端硬编码（editStyles.ts）一致；
// published=1 已公开，0 = 仅管理端测试可见（新风格先下架，测试通过后上架）。
const STYLE_SEEDS: Array<{
  styleKey: string;
  label: string;
  prefix: string;
  colors: string[];
  textures: string[];
  published: number;
}> = [
  {
    styleKey: "zine",
    label: "极简 Zine 海报",
    prefix:
      "把这张照片改造成极简 zine 海报风格：竖版 3:5 纸质画布，70%-90% 留白，" +
      "主体缩小为画面 8%-25% 的褪色照片/纸张剪贴处理，加入 serif/打字机小字与日期微文字，" +
      "使用 {color} 作为唯一高饱和色锚，{texture} 印刷纹理，平板扫描质感，" +
      "情绪安静诗意怀旧。避免：商业海报、3D、霓虹、卡通、全幅场景、清晰大字。",
    colors: [
      "fully saturated cobalt-blue",
      "opaque ultramarine",
      "vivid lemon-yellow",
      "clean tomato-red",
      "pear-green",
      "magenta-pink",
    ],
    textures: [
      "risograph grain",
      "xerox softness",
      "letterpress ink bleed",
      "halftone degradation",
      "aged paper mottling",
    ],
    published: 1,
  },
  {
    styleKey: "cyberpunk",
    label: "赛博朋克",
    prefix:
      "把这张照片改造成赛博朋克风格：霓虹灯招牌与赛博城市夜景，" +
      "青色/品红霓虹光效，雨夜潮湿地面反光，高对比、深蓝紫暗调，" +
      "未来科技细节，电影感布光。避免：阳光场景、低饱和、真实自然光。",
    colors: [],
    textures: [],
    published: 1,
  },
  {
    styleKey: "watercolor",
    label: "水彩手绘",
    prefix:
      "把这张照片改造成水彩手绘风格：柔和的水彩晕染与透明层叠，" +
      "纸张纹理质感，边缘自然洇开，色彩清透柔和，保留主体轮廓但简化为手绘笔触，" +
      "留白透气。避免：油画厚涂、写实摄影、硬边矢量。",
    colors: [],
    textures: [],
    published: 1,
  },
  {
    styleKey: "ukiyoe",
    label: "浮世绘",
    prefix:
      "把这张照片改造成日式浮世绘木版画风格：江户时代版画线条，" +
      "平涂色块与木纹纸质感，海浪/云纹装饰元素，传统和风配色（靛蓝、朱红、米白），" +
      "扁平化构图。避免：写实透视、现代数码感、过多暗部细节。",
    colors: [],
    textures: [],
    published: 1,
  },
  {
    styleKey: "gathered-zine",
    label: "拾景纸刊",
    prefix:
      "把这张照片改造成「拾景纸刊」风格：竖版 3:5 暖米色纸海报，" +
      "照片保持真实并占画面 30%-50%（真景为锚，核心主体与空间关系必须可辨认），" +
      "照片与纸面交界处保留清晰可见的手撕毛边（不规则撕口、露出的纸纤维、暖纸色），" +
      "其余部分转为大面积抽象插画场（约 45%-70% 画面，内部 55%+ 留白呼吸），" +
      "简化复杂细节：树叶/人群/纹理压缩为少数大块剪影与方向性笔势，不要逐片描绘，" +
      "使用 {color} 作为源自照片的唯一高饱和结构色（延续照片轮廓，参与构图而非装饰），" +
      "{texture} 印刷纹理，加一行不超过 5 个英文单词或 8 个汉字的微文字（打字机/铅笔质感，安静置于留白处）。" +
      "避免：整图描摹、逐叶逐枝细节、装饰性色块、干净数码剪裁、贴纸白边、3D、霓虹、卡通、商业海报。",
    colors: [
      "fully saturated cobalt-blue",
      "opaque ultramarine",
      "clean tomato-red",
      "vivid pear-green",
      "lemon-yellow",
      "saturated magenta-pink",
    ],
    textures: [
      "risograph grain",
      "letterpress ink bleed",
      "xerox softness",
      "halftone degradation",
      "aged paper mottling",
    ],
    published: 1,
  },
  {
    styleKey: "ink-wash",
    label: "水墨海报",
    prefix:
      "把这张照片改造成当代极简水墨编辑海报（Contemporary Ink-Wash Editorial）：" +
      "竖版 4:5 宣纸/纸面画布，保留照片的主体与构图可辨认（约 35%-65% 画面为墨色主图），" +
      "其余为大量安静留白（约 35%-65% 空白纸面呼吸），主体边缘用不规则墨晕/淡墨稀释溶解进纸面，不要贴图式矩形，" +
      "墨法使用 {texture}（飞白/湿墨晕染/稀释层叠/墨渍边缘），墨色随纸色调整（暖纸用中性黑，冷纸用蓝黑/烟墨），" +
      "纸色为 {color}（低饱和宣纸色系），整体墨色+纸色+至多一个克制点缀色，" +
      "如有小字使用细 serif/打字机字号安静置于留白处（≤2行，避免大字标题与仿古印章）," +
      "避免：整页传统山水大场景、大字书法标题、仿古年号日期、饱和数码渐变背景、统一灰色水彩滤镜、3D、霓虹。",
    colors: [
      "warm rice paper white",
      "cool porcelain white",
      "mist gray paper",
      "muted celadon paper",
      "moonlit pale indigo paper",
      "light ochre paper",
    ],
    textures: [
      "dry-brush fracture",
      "wet wash bloom",
      "diluted transparent ink layers",
      "pooled pigment edge",
      "ink-absorbed photo fragment",
      "soft photocopy grain",
    ],
    published: 1,
  },
  {
    styleKey: "riso-duotone",
    label: "Riso 双色调复古印刷",
    prefix:
      "把这张照片改造成 Riso 双色调复古印刷风格（retro riso print style illustration）：" +
      "双色调配色——深靛蓝（deep navy blue）作暗部/背景，琥珀橙（burnt orange/amber）作亮部/光源，" +
      "{color} 作为可选第三色（仅地面/植被等大面积区域使用，如橄榄黄绿 olive-yellow），" +
      "全图不出现纯黑或纯白（暗用深蓝代替，亮用浅米/浅橙代替），" +
      "主体做强逆光剪影（通常在画面右侧或中心偏右），背景放一个发光圆形太阳/月亮作为视觉锚点，" +
      "用清晰地平线切分天空与地面/水面，主体投下拉长的斜向阴影，" +
      "适度加入超现实/幽默元素制造反差（复古物件+现代科技、雕塑+日常道具等），" +
      "{texture} 丝网印刷质感，screen-print poster aesthetic、editorial illustration style。" +
      "避免：纯黑、纯白、过多色彩、写实照片、3D、霓虹、过饱和、塑料质感。",
    colors: [
      "olive-yellow",
      "deep navy blue",
      "burnt orange / amber",
    ],
    textures: [
      "heavy halftone dot texture",
      "rough grainy paper noise",
      "misregistered print offset look",
      "screen-print texture",
    ],
    published: 0,
  },
  {
    styleKey: "miyazaki-dusk",
    label: "宫崎骏黄昏风",
    prefix:
      "把这张照片改造成复古日本动画电影质感的黄昏风景画（90 年代日本动画背景绘制，宫崎骏式宁静浪漫氛围）：" +
      "保留照片的主体身份与构图，置于低地平线的广阔风景中（天空占画面上半部分，深邃纯净的蓝色天空，夕阳悬挂在远方地平线附近，太阳散发柔和明亮的金色光晕，照亮云层边缘，形成温暖黄橙色渐变），" +
      "地面为平原/浅水湿地/原野（由原图地貌决定），反射天空的蓝色与夕阳的橙色光泽，前景有细碎的草地、湿润地面和闪烁的光斑，" +
      "主体细节简洁，背后拖着长长的阴影沿地面延伸至前景，强化夕阳低角度照射的空间感，" +
      "使用 {color} 作为黄昏氛围主导色倾向（高饱和但柔和，冷暖强烈对比，无纯黑纯白），{texture} 质感，" +
      "90年代日本动画背景绘制，宫崎骏式宁静浪漫氛围，手绘质感，细腻颗粒纹理，略带水彩和油画笔触，胶片颗粒感和复古印刷效果，安静、治愈、梦幻、充满希望的黄昏旅途氛围，超高清细节，电影级场景设计，动漫背景艺术。" +
      "避免：写实照片、3D、赛博朋克、霓虹、过饱和、塑料渲染、夜景（非黄昏）、阴天灰调、现代数码感、水印、文字伪影。",
    colors: [
      "deep navy blue",
      "burnt orange / amber",
      "warm ivory",
    ],
    textures: [
      "soft photocopy grain",
      "aged paper mottling",
      "wet wash bloom",
      "heavy paper grain",
    ],
    published: 0,
  },
];

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
    const adminPassword = requireAdminSeedPassword(process.env.ADMIN_PASSWORD);
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      role: "admin",
    });

    console.log("✓ Admin user seeded");
  } else {
    console.log("✓ Admin user already exists");
  }

  // Insert image edit style presets (skip existing by style_key)
  let insertedStyles = 0;
  for (const s of STYLE_SEEDS) {
    const [row] = await db
      .insert(styles)
      .values({
        styleKey: s.styleKey,
        label: s.label,
        prefix: s.prefix,
        colors: JSON.stringify(s.colors),
        textures: JSON.stringify(s.textures),
        published: s.published,
      })
      .onConflictDoNothing()
      .returning({ id: styles.id });
    if (row) insertedStyles += 1;
  }
  console.log(`✓ Styles seeded: ${insertedStyles} inserted (total ${STYLE_SEEDS.length})`);

  process.exit(0);
}

seed();
