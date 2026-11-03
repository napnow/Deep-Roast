import type { Conversation, CreditTransaction, ImageRecord } from "@/types";

export async function loadAdminUserDetails(userId: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const id = encodeURIComponent(userId);
  const get = async (url: string) => {
    const response = await fetcher(url, { signal });
    if (!response.ok) throw new Error(`请求失败 (${response.status})`);
    return response.json();
  };
  const [images, credits, conversations] = await Promise.all([
    get(`/api/admin/users/${id}/images`),
    get(`/api/admin/credits?userId=${id}`),
    get(`/api/admin/users/${id}/conversations`),
  ]);
  if (!Array.isArray(images) || !Array.isArray(credits?.transactions) || !Array.isArray(conversations)) throw new Error("用户详情格式不正确");
  return { images: images as ImageRecord[], transactions: credits.transactions as CreditTransaction[], conversations: conversations as Conversation[] };
}
