"use client";

import type { EditStyle } from "@/types";

/**
 * 图生图「风格预设」：
 * 把风格化规则编译成编辑 prompt 前缀，与用户描述合并后交给 /api/image-edit。
 * 风格已迁移到数据库（styles 表）由管理端维护；本文件保留硬编码作为
 * 数据库加载失败/未 seed 时的兜底，及公共工具函数。
 */

export interface EditStylePreset {
  id: string;
  label: string;
  /** 拼接在用户描述前的风格规则（含 {color} / {texture} 槽位） */
  prefix: string;
  /** 该风格可选的强调色（无则为 null） */
  colors?: string[];
  /** 该风格可选的纹理（无则用默认） */
  textures?: string[];
}

/** 数据库风格行 → 前端 preset（id 用 styleKey） */
export function toEditStylePreset(s: EditStyle): EditStylePreset {
  return {
    id: s.styleKey,
    label: s.label,
    prefix: s.prefix,
    colors: s.colors,
    textures: s.textures,
  };
}

/** 颜色选项的中文展示名 */
export function friendlyStyleColor(c: string): string {
  return c
    .replace("fully saturated ", "")
    .replace("opaque ", "")
    .replace("vivid ", "")
    .replace("clean ", "")
    .replace("electric ", "")
    .replace("vibrant ", "")
    .replace("crimson ", "")
    .replace("golden ", "")
    .replace("emerald ", "")
    .replace("hot ", "")
    .replace("pear-", "梨")
    .replace("magenta-pink", "品红")
    .replace("cobalt-blue", "钴蓝")
    .replace("ultramarine", "群青")
    .replace("lemon-yellow", "柠檬黄")
    .replace("tomato-red", "番茄红")
    .replace("orange-red", "橙红")
    .replace("electric blue", "电光蓝")
    .replace("crimson red", "绯红")
    .replace("golden yellow", "金黄")
    .replace("emerald green", "祖母绿")
    .replace("hot pink", "亮粉")
    .replace("warm rice paper white", "暖米宣纸")
    .replace("cool porcelain white", "冷瓷白")
    .replace("mist gray paper", "雾灰")
    .replace("muted celadon paper", "青瓷")
    .replace("moonlit pale indigo paper", "月夜靛蓝")
    .replace("light ochre paper", "浅赭")
    .replace("deep navy blue", "深靛蓝")
    .replace("deep navy", "深海军蓝")
    .replace("burnt orange / amber", "琥珀橙")
    .replace("burnt orange", "焦橙")
    .replace("olive-yellow", "橄榄黄绿")
    .replace("warm ivory", "暖象牙白")
    .replace("muted sand", "哑沙")
    .replace("muted olive", "哑橄榄绿")
    .replace("soft slate blue", "柔板岩蓝");
}

/** 纹理选项的中文展示名 */
export function friendlyStyleTexture(t: string): string {
  return t
    .replace("risograph grain", "Riso 颗粒")
    .replace("xerox softness", "复印柔化")
    .replace("letterpress ink bleed", "铅印洇墨")
    .replace("halftone degradation", "半调失真")
    .replace("aged paper mottling", "旧纸斑驳")
    .replace("dry-brush fracture", "飞白破墨")
    .replace("wet wash bloom", "湿墨晕染")
    .replace("diluted transparent ink layers", "淡墨层叠")
    .replace("pooled pigment edge", "墨渍边缘")
    .replace("ink-absorbed photo fragment", "墨吸照片")
    .replace("soft photocopy grain", "柔复印颗粒")
    .replace("heavy paper grain", "重纸纹")
    .replace("risograph texture", "Riso 纹理")
    .replace("offset misregistration", "套印错位")
    .replace("ink bleed", "洇墨")
    .replace("halftone dots", "半调网点")
    .replace("matte finish", "哑光")
    .replace("heavy halftone dot texture", "重半调网点")
    .replace("rough grainy paper noise", "粗纸纹噪点")
    .replace("misregistered print offset look", "套色错位")
    .replace("screen-print texture", "丝网印刷");
}

export const EDIT_STYLE_PRESETS: EditStylePreset[] = [
  {
    id: "zine",
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
  },
  {
    id: "cyberpunk",
    label: "赛博朋克",
    prefix:
      "把这张照片改造成赛博朋克风格：霓虹灯招牌与赛博城市夜景，" +
      "青色/品红霓虹光效，雨夜潮湿地面反光，高对比、深蓝紫暗调，" +
      "未来科技细节，电影感布光。避免：阳光场景、低饱和、真实自然光。",
  },
  {
    id: "watercolor",
    label: "水彩手绘",
    prefix:
      "把这张照片改造成水彩手绘风格：柔和的水彩晕染与透明层叠，" +
      "纸张纹理质感，边缘自然洇开，色彩清透柔和，保留主体轮廓但简化为手绘笔触，" +
      "留白透气。避免：油画厚涂、写实摄影、硬边矢量。",
  },
  {
    id: "ukiyoe",
    label: "浮世绘",
    prefix:
      "把这张照片改造成日式浮世绘木版画风格：江户时代版画线条，" +
      "平涂色块与木纹纸质感，海浪/云纹装饰元素，传统和风配色（靛蓝、朱红、米白），" +
      "扁平化构图。避免：写实透视、现代数码感、过多暗部细节。",
  },
  {
    id: "gathered-zine",
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
  },
  {
    id: "ink-wash",
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
  },
];

/** 默认风格 id */
export const DEFAULT_EDIT_STYLE = "zine";
