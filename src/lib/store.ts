"use client";

import { create } from "zustand";
import type {
  Message,
  Conversation,
  ImageRecord,
  Config,
  ModelInfo,
} from "@/types";
import { DEFAULT_TEXT_MODELS, DEFAULT_IMAGE_MODELS } from "@/types";

type Updater<T> = T | ((prev: T) => T);

function applyUpdater<T>(prev: T, next: Updater<T>): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

export interface DeepRoastState {
  // mode
  activeMode: "text" | "image";

  // config / models
  config: Config;
  textModels: ModelInfo[];
  imageModels: ModelInfo[];

  // chat
  conversations: Conversation[];
  activeConvId: string | null;
  chatMessages: Message[];
  streaming: boolean;
  streamingText: string;

  // image
  imageHistory: ImageRecord[];
  generating: boolean;

  // credits
  credits: number;

  // ui modals
  settingsOpen: boolean;
  rechargeOpen: boolean;
  walletOpen: boolean;

  // setters
  setActiveMode: (mode: "text" | "image") => void;
  setConfig: (updates: Partial<Config> | ((prev: Config) => Config)) => void;
  replaceConfig: (config: Config) => void;
  setTextModels: (models: Updater<ModelInfo[]>) => void;
  setImageModels: (models: Updater<ModelInfo[]>) => void;
  setConversations: (conversations: Updater<Conversation[]>) => void;
  setActiveConvId: (id: string | null) => void;
  setChatMessages: (messages: Updater<Message[]>) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingText: (text: string) => void;
  setImageHistory: (history: Updater<ImageRecord[]>) => void;
  setGenerating: (generating: boolean) => void;
  setCredits: (credits: number) => void;
  setSettingsOpen: (open: boolean) => void;
  setRechargeOpen: (open: boolean) => void;
  setWalletOpen: (open: boolean) => void;
  resetChatSession: () => void;
}

const initialConfig: Config = {
  arkApiKey: "",
  baseUrl: "",
  textModel: "doubao-seed-2-0-pro-260215",
  imageModel: "doubao-seedream-4-5-251128",
  imageSystemPrompt: "",
  hasApiKey: false,
  apiKeyHint: "",
  enabledTextModels: DEFAULT_TEXT_MODELS.map((m) => m.id),
  enabledImageModels: DEFAULT_IMAGE_MODELS.map((m) => m.id),
};

export const useDeepRoastStore = create<DeepRoastState>((set) => ({
  activeMode: "text",
  config: initialConfig,
  textModels: DEFAULT_TEXT_MODELS,
  imageModels: DEFAULT_IMAGE_MODELS,
  conversations: [],
  activeConvId: null,
  chatMessages: [],
  streaming: false,
  streamingText: "",
  imageHistory: [],
  generating: false,
  credits: 0,
  settingsOpen: false,
  rechargeOpen: false,
  walletOpen: false,

  setActiveMode: (mode) => set({ activeMode: mode }),
  setConfig: (updates) =>
    set((s) => ({
      config:
        typeof updates === "function"
          ? updates(s.config)
          : { ...s.config, ...updates },
    })),
  replaceConfig: (config) => set({ config }),
  setTextModels: (models) =>
    set((s) => ({ textModels: applyUpdater(s.textModels, models) })),
  setImageModels: (models) =>
    set((s) => ({ imageModels: applyUpdater(s.imageModels, models) })),
  setConversations: (conversations) =>
    set((s) => ({
      conversations: applyUpdater(s.conversations, conversations),
    })),
  setActiveConvId: (id) => set({ activeConvId: id }),
  setChatMessages: (messages) =>
    set((s) => ({ chatMessages: applyUpdater(s.chatMessages, messages) })),
  setStreaming: (streaming) => set({ streaming }),
  setStreamingText: (text) => set({ streamingText: text }),
  setImageHistory: (history) =>
    set((s) => ({ imageHistory: applyUpdater(s.imageHistory, history) })),
  setGenerating: (generating) => set({ generating }),
  setCredits: (credits) => set({ credits }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setRechargeOpen: (open) => set({ rechargeOpen: open }),
  setWalletOpen: (open) => set({ walletOpen: open }),
  resetChatSession: () =>
    set({ chatMessages: [], streaming: false, streamingText: "" }),
}));
