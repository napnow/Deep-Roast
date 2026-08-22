"use client";

import { create } from "zustand";
import type {
  ImageRecord,
  Config,
  ModelInfo,
  Conversation,
  Message,
} from "@/types";
import { DEFAULT_IMAGE_MODELS } from "@/types";
import type {
  ImageCreationMode,
  InspectorTab,
  WorkspaceMode,
} from "@/lib/workspace-preferences";
import type {
  ImageToImageDraft,
  ReversePromptDraft,
  TextToImageDraft,
} from "@/lib/image-workspace";
import {
  INITIAL_IMAGE_TASK,
  type ImageTaskError,
  type ImageTaskRequest,
  type ImageTaskState,
} from "@/lib/image-task";

type Updater<T> = T | ((prev: T) => T);

function applyUpdater<T>(prev: T, next: Updater<T>): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

export interface DeepRoastState {
  // mode: 文生图 / 对话
  activeMode: WorkspaceMode;
  imageCreationMode: ImageCreationMode;
  inspectorTab: InspectorTab;
  inspectorCollapsed: boolean;
  activeImageId: string | null;
  textToImageDraft: TextToImageDraft;
  imageToImageDraft: ImageToImageDraft;
  reversePromptDraft: ReversePromptDraft;

  // config / models
  config: Config;
  imageModels: ModelInfo[];
  /** 用户当前选择的生图模型（默认跟随 config.imageModel） */
  selectedImageModel: string;

  // chat
  conversations: Conversation[];
  activeConvId: string | null;
  chatMessages: Message[];
  streaming: boolean;
  streamingText: string;

  // image
  imageHistory: ImageRecord[];
  generating: boolean;
  imageTask: ImageTaskState;

  // credits / check-in
  credits: number;
  checkinEligible: boolean;
  todayChecked: boolean;

  // ui modals
  settingsOpen: boolean;
  walletOpen: boolean;
  pwOpen: boolean;
  apiOpen: boolean;

  // setters
  setActiveMode: (mode: WorkspaceMode) => void;
  setImageCreationMode: (mode: ImageCreationMode) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setInspectorCollapsed: (collapsed: boolean) => void;
  setActiveImageId: (id: string | null) => void;
  setTextToImageDraft: (next: Partial<TextToImageDraft>) => void;
  setImageToImageDraft: (next: Partial<ImageToImageDraft>) => void;
  setReversePromptDraft: (next: Partial<ReversePromptDraft>) => void;
  setConfig: (updates: Partial<Config> | ((prev: Config) => Config)) => void;
  replaceConfig: (config: Config) => void;
  setImageModels: (models: Updater<ModelInfo[]>) => void;
  setSelectedImageModel: (model: string) => void;
  setConversations: (conversations: Updater<Conversation[]>) => void;
  setActiveConvId: (id: string | null) => void;
  setChatMessages: (messages: Updater<Message[]>) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingText: (text: string) => void;
  setImageHistory: (history: Updater<ImageRecord[]>) => void;
  setGenerating: (generating: boolean) => void;
  startImageTask: (request: ImageTaskRequest) => void;
  finishImageTask: (resultIds: string[]) => void;
  failImageTask: (error: ImageTaskError) => void;
  clearImageTask: () => void;
  setCredits: (credits: number) => void;
  setCheckinStatus: (status: {
    eligible?: boolean;
    todayChecked?: boolean;
  }) => void;
  setSettingsOpen: (open: boolean) => void;
  setWalletOpen: (open: boolean) => void;
  setPwOpen: (open: boolean) => void;
  setApiOpen: (open: boolean) => void;
  resetChatSession: () => void;
}

const initialConfig: Config = {
  arkApiKey: "",
  baseUrl: "",
  textModel: "doubao-seed-2-0-pro-260215",
  imageModel: "doubao-seedream-4-5-251128",
  imageSystemPrompt: "",
  assistantImagePrompt: "",
  reversePromptModel: "",
  hasApiKey: false,
  apiKeyHint: "",
  enabledImageModels: DEFAULT_IMAGE_MODELS.map((m) => m.id),
  imageGenerationEnabled: true,
};

export const useDeepRoastStore = create<DeepRoastState>((set) => ({
  activeMode: "image",
  imageCreationMode: "text",
  inspectorTab: "history",
  inspectorCollapsed: false,
  activeImageId: null,
  textToImageDraft: {
    prompt: "",
    size: "1024x1024",
    count: 1,
    stylePrompt: "",
  },
  imageToImageDraft: {
    prompt: "",
    size: "1024x1024",
    count: 1,
    styleId: "",
    styleColor: "",
    styleTexture: "",
    refs: [],
  },
  reversePromptDraft: { image: null, resultPrompt: "" },
  config: initialConfig,
  imageModels: DEFAULT_IMAGE_MODELS,
  selectedImageModel: initialConfig.imageModel,
  conversations: [],
  activeConvId: null,
  chatMessages: [],
  streaming: false,
  streamingText: "",
  imageHistory: [],
  generating: false,
  imageTask: INITIAL_IMAGE_TASK,
  credits: 0,
  checkinEligible: false,
  todayChecked: false,
  settingsOpen: false,
  walletOpen: false,
  pwOpen: false,
  apiOpen: false,

  setActiveMode: (mode) => set({ activeMode: mode }),
  setImageCreationMode: (mode) => set({ imageCreationMode: mode }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setInspectorCollapsed: (collapsed) => set({ inspectorCollapsed: collapsed }),
  setActiveImageId: (id) => set({ activeImageId: id }),
  setTextToImageDraft: (next) =>
    set((state) => ({
      textToImageDraft: { ...state.textToImageDraft, ...next },
    })),
  setImageToImageDraft: (next) =>
    set((state) => ({
      imageToImageDraft: { ...state.imageToImageDraft, ...next },
    })),
  setReversePromptDraft: (next) =>
    set((state) => ({
      reversePromptDraft: { ...state.reversePromptDraft, ...next },
    })),
  setConfig: (updates) =>
    set((s) => ({
      config:
        typeof updates === "function"
          ? updates(s.config)
          : { ...s.config, ...updates },
    })),
  replaceConfig: (config) => set({ config }),
  setImageModels: (models) =>
    set((s) => ({ imageModels: applyUpdater(s.imageModels, models) })),
  setSelectedImageModel: (model) => set({ selectedImageModel: model }),
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
  startImageTask: (request) =>
    set({
      imageTask: {
        status: "generating",
        startedAt: Date.now(),
        request,
        resultIds: [],
        error: null,
      },
    }),
  finishImageTask: (resultIds) =>
    set((state) => ({
      imageTask: {
        ...state.imageTask,
        status: "success",
        startedAt: null,
        resultIds,
        error: null,
      },
    })),
  failImageTask: (error) =>
    set((state) => ({
      imageTask: {
        ...state.imageTask,
        status: "error",
        startedAt: null,
        error,
      },
    })),
  clearImageTask: () => set({ imageTask: INITIAL_IMAGE_TASK }),
  setCredits: (credits) => set({ credits }),
  setCheckinStatus: (status) =>
    set((s) => ({
      checkinEligible:
        status.eligible !== undefined ? status.eligible : s.checkinEligible,
      todayChecked:
        status.todayChecked !== undefined
          ? status.todayChecked
          : s.todayChecked,
    })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setWalletOpen: (open) => set({ walletOpen: open }),
  setPwOpen: (open) => set({ pwOpen: open }),
  setApiOpen: (open) => set({ apiOpen: open }),
  resetChatSession: () =>
    set({ chatMessages: [], streaming: false, streamingText: "" }),
}));
