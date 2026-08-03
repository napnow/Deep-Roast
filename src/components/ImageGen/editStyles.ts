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
];

/** 默认风格 id */
export const DEFAULT_EDIT_STYLE = "zine";
