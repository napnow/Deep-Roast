"use client";

import { useInitialData } from "@/hooks/useInitialData";
import { useChatActions } from "@/hooks/useChatActions";
import { useImageActions } from "@/hooks/useImageActions";
import { useConfigActions } from "@/hooks/useConfigActions";

/**
 * 门面 hook：组合初始数据、聊天、生图、配置操作。
 * page.tsx 只依赖这一处，内部按域拆分便于维护。
 */
export function useAppActions() {
  const { loadConfig, loadConversations, loadCredits } = useInitialData();
  const chat = useChatActions(loadConversations);
  const image = useImageActions(loadCredits);
  const config = useConfigActions(loadConfig);

  return {
    ...chat,
    ...image,
    ...config,
    loadCredits,
  };
}
