export type ImageGenStageKey = "parsing" | "composing" | "finishing";

export interface ImageGenStageDefinition {
  key: ImageGenStageKey;
  /** 该阶段结束的秒数（不含），最后一阶段为 Infinity */
  until: number;
  label: string;
  hint: string;
}

export interface ImageGenStage {
  key: ImageGenStageKey;
  /** 1-based 阶段序号 */
  step: number;
  total: number;
  label: string;
  hint: string;
}

export const IMAGE_GEN_STAGES: readonly ImageGenStageDefinition[] = [
  {
    key: "parsing",
    until: 3,
    label: "正在解析画面",
    hint: "辨认主体、光线与氛围",
  },
  {
    key: "composing",
    until: 15,
    label: "正在渲染构图",
    hint: "铺陈层次，把握明暗",
  },
  {
    key: "finishing",
    until: Infinity,
    label: "正在收尾细节",
    hint: "回火收边，校准质感",
  },
];

/** 按已耗时取当前阶段；非法或负数耗时按 0 处理。 */
export function getImageGenStage(elapsedSeconds: number): ImageGenStage {
  const seconds =
    Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  const index = Math.max(
    0,
    IMAGE_GEN_STAGES.findIndex((stage) => seconds < stage.until),
  );
  const stage = IMAGE_GEN_STAGES[index] ?? IMAGE_GEN_STAGES[0];

  return {
    key: stage.key,
    step: index + 1,
    total: IMAGE_GEN_STAGES.length,
    label: stage.label,
    hint: stage.hint,
  };
}
