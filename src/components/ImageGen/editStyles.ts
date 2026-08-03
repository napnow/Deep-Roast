"use client";

/**
 * 图生图「风格预设」：
 * 把风格化规则编译成编辑 prompt 前缀，与用户描述合并后交给 /api/image-edit。
 * 规则灵感来自 gc-minimal-zine-poster skill（极简 zine 海报）。
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
