import {
  getImageGenStage,
  IMAGE_GEN_STAGES,
  type ImageGenStage,
} from "@/lib/image-stage";

interface ImageGenStageIndicatorProps {
  elapsedSeconds: number;
  className?: string;
}

/**
 * 生成等待卡的阶段指示：三点进度 + 阶段文案 + 一句补充说明。
 * ResultCanvas 与 ImageResultPanel 共用，保证两处等待态一致。
 */
export default function ImageGenStageIndicator({
  elapsedSeconds,
  className,
}: ImageGenStageIndicatorProps) {
  const stage: ImageGenStage = getImageGenStage(elapsedSeconds);

  return (
    <div className={`image-stage${className ? ` ${className}` : ""}`}>
      <div
        className="image-stage-steps"
        role="img"
        aria-label={`生成阶段 ${stage.step}/${stage.total}：${stage.label}`}
      >
        {IMAGE_GEN_STAGES.map((item, index) => {
          const state =
            index < stage.step - 1
              ? "is-done"
              : index === stage.step - 1
                ? "is-active"
                : "is-pending";
          return (
            <span key={item.key} className={`image-stage-step ${state}`} />
          );
        })}
      </div>
      <p className="image-stage-label">{stage.label}</p>
      <p className="image-stage-hint">{stage.hint}</p>
    </div>
  );
}
