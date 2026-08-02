"use client";

import { create } from "zustand";
import type { ImageRecord, Config, ModelInfo } from "@/types";
import { DEFAULT_IMAGE_MODELS } from "@/types";

type Updater<T> = T | ((prev: T) => T);

function applyUpdater<T>(prev: T, next: Updater<T>): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

export interface DeepRoastState {
  // config / models
  config: Config;
  imageModels: ModelInfo[];

  // image
  imageHistory: ImageRecord[];
  generating: boolean;

  // credits / check-in
  credits: number;
  checkinEligible: boolean;
  todayChecked: boolean;

  // ui modals
  settingsOpen: boolean;
  walletOpen: boolean;

  // setters
  setConfig: (updates: Partial<Config> | ((prev: Config) => Config)) => void;
  replaceConfig: (config: Config) => void;
  setImageModels: (models: Updater<ModelInfo[]>) => void;
  setImageHistory: (history: Updater<ImageRecord[]>) => void;
  setGenerating: (generating: boolean) => void;
  setCredits: (credits: number) => void;
  setCheckinStatus: (status: {
    eligible?: boolean;
    todayChecked?: boolean;
  }) => void;
  setSettingsOpen: (open: boolean) => void;
  setWalletOpen: (open: boolean) => void;
}

const initialConfig: Config = {
  arkApiKey: "",
  baseUrl: "",
  imageModel: "doubao-seedream-4-5-251128",
  imageSystemPrompt: "",
  reversePromptModel: "",
  hasApiKey: false,
  apiKeyHint: "",
  enabledImageModels: DEFAULT_IMAGE_MODELS.map((m) => m.id),
};

export const useDeepRoastStore = create<DeepRoastState>((set) => ({
  config: initialConfig,
  imageModels: DEFAULT_IMAGE_MODELS,
  imageHistory: [],
  generating: false,
  credits: 0,
  checkinEligible: false,
  todayChecked: false,
  settingsOpen: false,
  walletOpen: false,

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
  setImageHistory: (history) =>
    set((s) => ({ imageHistory: applyUpdater(s.imageHistory, history) })),
  setGenerating: (generating) => set({ generating }),
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
}));
