"use client";

import { useInitialData } from "@/hooks/useInitialData";
import { useImageActions } from "@/hooks/useImageActions";
import { useChatActions } from "@/hooks/useChatActions";
import { useConfigActions } from "@/hooks/useConfigActions";

/**
 * 门面 hook：组合初始数据、生图、对话、配置操作。
 * page.tsx 只依赖这一处，内部按域拆分便于维护。
 */
export function useAppActions() {
  const { loadConfig, loadImageHistory, loadConversations, loadCredits } =
    useInitialData();
  const image = useImageActions(loadCredits);
  const chat = useChatActions(loadConversations, loadCredits);
  const config = useConfigActions(loadConfig);

  return {
    ...image,
    ...chat,
    ...config,
    loadCredits,
    loadImageHistory,
    loadConversations,
  };
}
