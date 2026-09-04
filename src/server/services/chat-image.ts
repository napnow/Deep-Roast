import type { ImageRecord, Message } from "@/types";

export function createAssistantImageMessage(
  image: Pick<
    ImageRecord,
    "id" | "imageUrl" | "thumbUrl" | "prompt" | "model" | "size"
  >,
  content = "我给你看看。",
): Message {
  return {
    role: "assistant",
    content,
    metadata: {
      image: {
        status: "success",
        id: image.id,
        imageUrl: image.imageUrl,
        thumbUrl: image.thumbUrl,
        prompt: image.prompt,
        model: image.model,
        size: image.size,
      },
    },
  };
}

export function createAssistantImageErrorMessage(
  prompt: string,
  error: string,
): Message {
  return {
    role: "assistant",
    content: "这次没能生成出来。",
    metadata: {
      image: {
        status: "error",
        prompt,
        error,
      },
    },
  };
}
