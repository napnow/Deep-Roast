/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { ThinkingOrb } from "thinking-orbs";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import ImageGenStageIndicator from "@/components/ImageGen/ImageGenStageIndicator";
import { compressImageFile, downloadImage, formatTime, thumbSrc } from "@/components/ImageGen/imageUtils";
import {
  fetchWearLibrary,
  WEAR_KINDS,
  WEAR_KIND_LABELS,
  WEAR_KIND_SHORT,
  type WearKind,
  type WearLibraryItem,
} from "@/components/ImageGen/wear-library";
import RedesignTopbar, { type RedesignNav } from "@/components/Redesign/RedesignTopbar";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/Toast";
import AppShell from "@/components/Workspace/AppShell";
import { AppIcon, type AppIconName } from "@/components/ui/icons";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { useConfigActions } from "@/hooks/useConfigActions";
import { copyText } from "@/lib/browser-actions";
import { ApiError, apiJson, jsonBody } from "@/lib/client-api";
import { canUseImageGeneration } from "@/lib/image-generation-access";
import { getImageSizeOptions } from "@/lib/image-model-capabilities";
import {
  IMAGE_MODEL_PREFERENCE_STORAGE_KEY,
  resolveImageModelAfterConfigLoad,
} from "@/lib/image-model-preferences";
import { getSessionImage } from "@/lib/image-transfer";
import { softNavigate } from "@/lib/nav-transition";
import { useDeepRoastStore } from "@/lib/store";
import { DEFAULT_IMAGE_MODELS, DEFAULT_IMAGE_MODEL_CREDIT_COST, type Config, type ImageRecord } from "@/types";
import "./wear.css";

type RefSlot = "person" | "outfit" | "pose";

const REF_SLOTS: readonly RefSlot[] = ["person", "outfit", "pose"];
const SLOT_META: Record<RefSlot, { title: string; hint: string; icon: AppIconName }> = {
  person: { title: "01 人物参考", hint: "锁定脸部与身形", icon: "user" },
  outfit: { title: "02 服装参考", hint: "上传平铺或款式图", icon: "hanger" },
  pose: { title: "03 姿势参考", hint: "上传线稿或动作图", icon: "upload" },
};

function useElapsedSeconds(startedAt: number | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !startedAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);
  if (!active || !startedAt) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** 服装摄影优先使用竖构图（2:3 / 3:4），找不到再回落首项 */
function pickDefaultWearSize(options: Array<{ value: string; label: string }>): string {
  const preferred = ["1024x1536", "1080x1440", "768x1024", "864x1152", "1024x1024"];
  for (const candidate of preferred) {
    if (options.some((item) => item.value === candidate)) return candidate;
  }
  return options[0]?.value ?? "1024x1024";
}

function shortRatioLabel(label: string, value: string): string {
  const head = label.split(" ")[0];
  if (head && head.includes(":")) return head;
  const [w, h] = value.split("x").map(Number);
  if (!w || !h) return value;
  if (w === h) return "1:1";
  return `${w}×${h}`;
}

export default function WearBenchPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();
  const stageDownload = useActionFeedback();
  const stageCopy = useActionFeedback();

  const {
    credits,
    setCredits,
    checkinReward,
    checkinEligible,
    todayChecked,
    setCheckinStatus,
    config,
    replaceConfig,
    setImageModels,
    selectedImageModel,
    setSelectedImageModel,
    setWalletOpen,
  } = useDeepRoastStore(
    useShallow((state) => ({
      credits: state.credits,
      setCredits: state.setCredits,
      checkinReward: state.checkinReward,
      checkinEligible: state.checkinEligible,
      todayChecked: state.todayChecked,
      setCheckinStatus: state.setCheckinStatus,
      config: state.config,
      replaceConfig: state.replaceConfig,
      setImageModels: state.setImageModels,
      selectedImageModel: state.selectedImageModel,
      setSelectedImageModel: state.setSelectedImageModel,
      setWalletOpen: state.setWalletOpen,
    })),
  );

  const loadConfig = useCallback(async () => {
    if (!user?.id) return;
    const initialSelected = useDeepRoastStore.getState().selectedImageModel;
    try {
      const cfg = await apiJson<Config>("/api/config");
      replaceConfig(cfg);
      const enabled = cfg.enabledImageModels ?? DEFAULT_IMAGE_MODELS.map((m) => m.id);
      setImageModels(enabled.map((id) => ({ id })));
      let storedModel: string | null = null;
      try {
        storedModel = window.localStorage.getItem(IMAGE_MODEL_PREFERENCE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const afterSelected = useDeepRoastStore.getState().selectedImageModel;
      setSelectedImageModel(
        resolveImageModelAfterConfigLoad(storedModel, initialSelected, afterSelected, enabled, cfg.imageModel),
      );
    } catch {
      /* ignore */
    }
  }, [user?.id, replaceConfig, setImageModels, setSelectedImageModel]);

  const { handleSaveConfig } = useConfigActions(loadConfig);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  // 穿搭工作台仅在桌面端开放；移动端直接访问自动回到主创作台
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobileViewport(mq.matches);
      if (mq.matches) router.replace("/");
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [router]);

  const [kind, setKind] = useState<WearKind>("outfit");
  const [category, setCategory] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<WearLibraryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [libError, setLibError] = useState<string | null>(null);
  const [picked, setPicked] = useState<WearLibraryItem[]>([]);

  const [extra, setExtra] = useState("");
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [refs, setRefs] = useState<Partial<Record<RefSlot, string>>>({});
  const [dragSlot, setDragSlot] = useState<RefSlot | null>(null);

  const [modelOpen, setModelOpen] = useState(false);
  const modelPopRef = useRef<HTMLDivElement>(null);
  const fileInputs = useRef<Partial<Record<RefSlot, HTMLInputElement | null>>>({});
  const genAbortRef = useRef<AbortController | null>(null);

  const [size, setSize] = useState("");
  const [generating, setGenerating] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ImageRecord | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lockingModel, setLockingModel] = useState(false);
  const [history, setHistory] = useState<ImageRecord[]>([]);

  const elapsed = useElapsedSeconds(startedAt, generating);
  const role = user?.role || "user";
  const isAdmin = role === "admin";

  const models = useMemo(
    () =>
      config.enabledImageModels?.length
        ? config.enabledImageModels
        : config.imageModel
          ? [config.imageModel]
          : DEFAULT_IMAGE_MODELS.map((item) => item.id),
    [config.enabledImageModels, config.imageModel],
  );
  const activeModel = models.includes(selectedImageModel) ? selectedImageModel : models[0] || "";
  const sizeOptions = useMemo(() => getImageSizeOptions(activeModel), [activeModel]);
  const activeSize = sizeOptions.some((item) => item.value === size) ? size : pickDefaultWearSize(sizeOptions);

  const perImageCost = config.imageModelCosts?.[activeModel] ?? DEFAULT_IMAGE_MODEL_CREDIT_COST;
  const canAfford = isAdmin || credits >= perImageCost;
  const available =
    canUseImageGeneration(isAdmin ? "admin" : "user", config.imageGenerationEnabled !== false) && Boolean(activeModel);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ enabled?: boolean }>("/api/public/donation")
      .then((data) => {
        if (!cancelled) setDonationEnabled(data.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setDonationEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCategory("全部");
  }, [kind]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setLoadingLib(true);
        setLibError(null);
        fetchWearLibrary({ kind, category, keyword, pageSize: 120, signal: controller.signal })
          .then((res) => {
            setItems(res.items);
            setCategories(res.categories);
          })
          .catch((cause) => {
            if (!(cause instanceof DOMException && cause.name === "AbortError")) {
              setLibError(cause instanceof Error ? cause.message : "素材库加载失败");
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoadingLib(false);
          });
      },
      keyword ? 220 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, category, keyword]);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await apiJson<ImageRecord[] | { images?: ImageRecord[] }>("/api/image-history?origin=wear&limit=60");
      const list = Array.isArray(rows) ? rows : rows.images ?? [];
      setHistory(list);
      setCurrent((prev) => prev ?? list[0] ?? null);
    } catch {
      /* 历史加载失败不阻断工作台使用 */
    }
  }, []);

  useEffect(() => {
    if (user) void loadHistory();
  }, [user, loadHistory]);

  useEffect(() => {
    if (!modelOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!modelPopRef.current?.contains(event.target as Node)) setModelOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModelOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [modelOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  useEffect(() => () => genAbortRef.current?.abort(), []);

  const handleCheckin = useCallback(async () => {
    if (!checkinEligible || todayChecked || checkinLoading) return;
    setCheckinLoading(true);
    try {
      const data = await apiJson<{ credits: number; reward?: number }>("/api/credits/checkin", { method: "POST" });
      setCredits(data.credits);
      const reward = data.reward ?? checkinReward;
      setCheckinStatus({ todayChecked: true, eligible: true, reward });
      toast(`签到成功，+${reward} 积分`, "success");
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        toast(error.message || "签到失败", "error");
        if (error.message.includes("已签到")) setCheckinStatus({ todayChecked: true });
      } else {
        toast("网络错误", "error");
      }
    } finally {
      setCheckinLoading(false);
    }
  }, [checkinEligible, todayChecked, checkinLoading, checkinReward, setCredits, setCheckinStatus, toast]);

  const pickedIds = useMemo(() => new Set(picked.map((item) => item.id)), [picked]);
  const pickedByKind = useMemo(() => {
    const counts: Record<WearKind, number> = { outfit: 0, pose: 0, portrait: 0 };
    for (const item of picked) counts[item.kind] += 1;
    return counts;
  }, [picked]);

  const visualMode = useMemo(() => items.length > 0 && items.some((item) => Boolean(item.thumbUrl || item.imageUrl)), [items]);

  const synthesizedPrompt = useMemo(() => {
    const parts: string[] = [];
    const activeSlots = REF_SLOTS.filter((slot) => Boolean(refs[slot]));
    if (activeSlots.length > 0) {
      const instructions: string[] = [];
      const pIdx = activeSlots.indexOf("person") + 1;
      const oIdx = activeSlots.indexOf("outfit") + 1;
      const sIdx = activeSlots.indexOf("pose") + 1;
      if (pIdx > 0) instructions.push(`严格保持第${pIdx}张参考图中人物的面部五官、发型与体型特征不变`);
      if (oIdx > 0) instructions.push(`穿着第${oIdx}张参考图中的服装单品，还原其版型轮廓、颜色与面料肌理`);
      if (sIdx > 0) instructions.push(`动作姿态与镜头角度参考第${sIdx}张参考图`);
      parts.push(instructions.join("，"));
    }
    for (const item of picked) parts.push(item.prompt);
    if (extra.trim()) parts.push(extra.trim());
    return parts.join("，");
  }, [picked, extra, refs]);

  const activeRefCount = Number(Boolean(refs.person)) + Number(Boolean(refs.outfit)) + Number(Boolean(refs.pose));
  const modeSummary = useMemo(() => {
    if (activeRefCount >= 2) return { live: true, text: `多图组合试穿（已载入 ${activeRefCount} 张参考图）` };
    if (refs.person) return { live: true, text: "锁定人物换装 · 保持五官，按描述与光影生成穿搭" };
    if (refs.outfit) return { live: true, text: "单品上身展示 · 还原参考服装款式生成模特图" };
    if (refs.pose) return { live: true, text: "指定姿势生图 · 按参考线稿/动作构图生成" };
    return { live: false, text: "自由拼装工作台 · 上传人物/服装/姿势参考图，或搭配场景光影生图" };
  }, [activeRefCount, refs.outfit, refs.person, refs.pose]);

  if (!user || isMobileViewport) return null;

  const applyLibraryImageToSlot = async (slot: RefSlot, imageUrl: string) => {
    // 同源静态相对路径（如 /wear-packs/...）先转为 dataURL，兼容服务端参考图校验
    if (imageUrl.startsWith("/") && !imageUrl.startsWith("/api/images/") && !imageUrl.startsWith("/images/")) {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        const file = new File([blob], "pack-ref.png", { type: blob.type || "image/png" });
        const dataUrl = await compressImageFile(file, 1536, 0.9);
        setRefs((prev) => (prev[slot] ? prev : { ...prev, [slot]: dataUrl }));
      } catch {
        /* ignore */
      }
      return;
    }
    setRefs((prev) => (prev[slot] ? prev : { ...prev, [slot]: imageUrl }));
  };

  const togglePreset = (item: WearLibraryItem) => {
    const exists = picked.some((x) => x.id === item.id);
    setPicked((list) => (exists ? list.filter((x) => x.id !== item.id) : [...list, item]));
    // 若素材自带参考图（如导入的 PoseWear 服装/姿势卡片），选中时自动填入对应空槽位
    if (!exists && item.imageUrl && (item.kind === "outfit" || item.kind === "pose")) {
      void applyLibraryImageToSlot(item.kind, item.imageUrl);
    }
  };

  const handleDeleteImage = async (target: ImageRecord) => {
    const ok = await confirm({
      title: "删除穿搭成片",
      message: "确定删除这张图片？删除后主图库中也会一并移除，此操作不可撤销。",
      confirmText: "删除",
    });
    if (!ok) return;
    try {
      await apiJson(`/api/image-history/${target.id}`, { method: "DELETE" });
      setLightboxOpen(false);
      setHistory((prev) => {
        const next = prev.filter((item) => item.id !== target.id);
        setCurrent((cur) => (cur?.id === target.id ? next[0] ?? null : cur));
        return next;
      });
      const store = useDeepRoastStore.getState();
      store.setImageHistory(store.imageHistory.filter((item) => item.id !== target.id));
      toast("已删除成片", "success");
    } catch (error: unknown) {
      toast(error instanceof ApiError ? error.message : "删除失败，请稍后重试", "error");
    }
  };

  const handleUploadFile = async (slot: RefSlot, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setGenError("请上传 PNG / JPG / WebP 图片文件");
      return;
    }
    try {
      const dataUrl = await compressImageFile(file, 1536, 0.9);
      setRefs((prev) => ({ ...prev, [slot]: dataUrl }));
      setGenError(null);
    } catch {
      setGenError("读取参考图片失败，请换一张重试");
    }
  };

  const lockAsPersonRef = async (image: ImageRecord) => {
    if (lockingModel) return;
    setLockingModel(true);
    try {
      const blob = await getSessionImage(image.imageUrl);
      const file = new File([blob], "model-ref.png", { type: blob.type || "image/png" });
      const dataUrl = await compressImageFile(file, 1536, 0.9);
      setRefs((prev) => ({ ...prev, person: dataUrl }));
      setLightboxOpen(false);
      toast("已将该成片设为「01 人物参考」，可继续换装或换动作", "success");
    } catch {
      toast("载入人物参考图失败，请稍后重试", "error");
    } finally {
      setLockingModel(false);
    }
  };

  const refreshCredits = async () => {
    try {
      const me = await apiJson<{ credits?: number }>("/api/auth/me");
      if (typeof me.credits === "number") setCredits(me.credits);
    } catch {
      /* ignore */
    }
  };

  const handleGenerate = async () => {
    if (!synthesizedPrompt.trim() || generating || !available) return;
    if (!canAfford) {
      setGenError(`积分不足，当前模型需要 ${perImageCost} 积分/张`);
      setWalletOpen(true);
      return;
    }
    genAbortRef.current?.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;
    setGenerating(true);
    setStartedAt(Date.now());
    setGenError(null);

    const headers = { "Idempotency-Key": crypto.randomUUID() };
    const refList = REF_SLOTS.map((slot) => refs[slot]).filter((val): val is string => Boolean(val));
    try {
      let created: ImageRecord | undefined;
      if (refList.length > 0) {
        const body =
          refList.length >= 2
            ? {
                mode: "reference" as const,
                targetImage: refList[0],
                referenceImages: refList.slice(1),
                prompt: synthesizedPrompt,
                model: activeModel,
                size: activeSize,
                origin: "wear",
              }
            : {
                image: refList[0],
                prompt: synthesizedPrompt,
                model: activeModel,
                size: activeSize,
                origin: "wear",
              };
        const res = await apiJson<{ images?: ImageRecord[] }>("/api/image-edit", {
          method: "POST",
          signal: controller.signal,
          ...jsonBody(body, headers),
        });
        created = res.images?.[0];
      } else {
        created = await apiJson<ImageRecord>("/api/image", {
          method: "POST",
          signal: controller.signal,
          ...jsonBody({ prompt: synthesizedPrompt, model: activeModel, size: activeSize, origin: "wear" }, headers),
        });
      }

      if (created) {
        const record: ImageRecord = {
          ...created,
          createdAt: created.createdAt || new Date().toISOString(),
        };
        setCurrent(record);
        setHistory((prev) => [record, ...prev.filter((item) => item.id !== record.id)]);
      }
      void refreshCredits();
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setGenError(error instanceof Error ? error.message : "生成失败，请稍后重试");
      if (error instanceof ApiError && error.status === 402) setWalletOpen(true);
    } finally {
      if (genAbortRef.current === controller) {
        genAbortRef.current = null;
        setGenerating(false);
        setStartedAt(null);
      }
    }
  };

  const stopGenerating = () => {
    genAbortRef.current?.abort();
    genAbortRef.current = null;
    setGenerating(false);
    setStartedAt(null);
  };

  const handleNav = (nav: RedesignNav) => {
    if (nav === "wear") return;
    if (nav === "canvas") {
      softNavigate(router, "/studio/canvas");
      return;
    }
    softNavigate(router, nav === "create" ? "/" : `/?nav=${nav}`);
  };

  const header = (
    <RedesignTopbar
      active="wear"
      onSelect={handleNav}
      username={user.username || ""}
      role={role}
      credits={credits}
      donationEnabled={donationEnabled}
      onOpenDonation={() => setDonationOpen(true)}
      onLogout={logout}
      onWalletClick={() => setWalletOpen(true)}
      checkinAvailable={checkinEligible && !todayChecked}
      checkinReward={checkinReward}
      checkinLoading={checkinLoading}
      onCheckin={handleCheckin}
    />
  );

  const canSubmit = Boolean(synthesizedPrompt.trim()) && !generating && available && synthesizedPrompt.length <= 12000;

  return (
    <AppShell header={header}>
      <div className="wa-shell">
        <div className="wa-grid">
          {/* 左栏：服装 / 姿势 / 光影 素材库 */}
          <aside className="wa-pane wa-lib" aria-label="素材库">
            <div className="wa-lib__head">
              <span className="wa-lib__title">
                <AppIcon name="hanger" size={16} />
                穿搭素材库
              </span>
              {picked.length > 0 && (
                <button type="button" className="wa-clear-btn" onClick={() => setPicked([])}>
                  清空 ({picked.length})
                </button>
              )}
            </div>

            <div className="wa-kinds" role="tablist" aria-label="素材类别">
              {WEAR_KINDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={kind === value}
                  onClick={() => setKind(value)}
                >
                  <span>{WEAR_KIND_SHORT[value]}</span>
                  {pickedByKind[value] > 0 && <span className="wa-kinds__badge">{pickedByKind[value]}</span>}
                </button>
              ))}
            </div>

            <div className="wa-search-wrap">
              <AppIcon name="search" size={14} />
              <input
                className="wa-search"
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={`搜索${WEAR_KIND_LABELS[kind]}…`}
                aria-label={`搜索${WEAR_KIND_LABELS[kind]}`}
              />
            </div>

            {categories.length > 0 ? (
              <div className="wa-cats" role="group" aria-label="细分分类">
                {["全部", ...categories].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={category === cat}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            ) : (
              <div className="wa-list-divider" />
            )}

            <div className={`wa-list${visualMode ? " is-visual" : ""}`}>
              {libError ? (
                <div className="wa-lib-empty" role="alert">
                  <b>加载失败</b>
                  <p>{libError}</p>
                </div>
              ) : loadingLib ? (
                Array.from({ length: 4 }, (_, idx) => <div key={idx} className="wa-skeleton" />)
              ) : !items.length ? (
                <div className="wa-lib-empty">
                  <b>暂未导入{WEAR_KIND_LABELS[kind]}图包</b>
                  <p>
                    {kind === "outfit" || kind === "pose"
                      ? `可直接在右侧上传本地${WEAR_KIND_SHORT[kind]}参考图；后续导入 PoseWear 图库素材后将在此展示缩略图卡片。`
                      : "没有匹配的场景光影预设。"}
                  </p>
                  {(kind === "outfit" || kind === "pose") && (
                    <button
                      type="button"
                      className="wa-lib-empty__btn"
                      onClick={() => fileInputs.current[kind]?.click()}
                    >
                      <AppIcon name="upload" size={13} />
                      上传本地{WEAR_KIND_SHORT[kind]}图
                    </button>
                  )}
                </div>
              ) : visualMode ? (
                items.map((item) => {
                  const selected = pickedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`wa-vcard${selected ? " is-on" : ""}`}
                      aria-pressed={selected}
                      onClick={() => togglePreset(item)}
                      title={item.prompt}
                    >
                      <span className="wa-vcard__thumb">
                        {(item.thumbUrl || item.imageUrl) && (
                          <img src={item.thumbUrl || item.imageUrl} alt={item.title} loading="lazy" />
                        )}
                      </span>
                      <span className="wa-vcard__meta">
                        <strong>{item.title}</strong>
                        <small>{item.category}</small>
                      </span>
                      <i className="wa-vcard__badge" aria-hidden="true">
                        {selected ? <AppIcon name="check" size={11} strokeWidth={2.5} /> : "+"}
                      </i>
                    </button>
                  );
                })
              ) : (
                items.map((item) => {
                  const selected = pickedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`wa-preset${selected ? " is-on" : ""}`}
                      aria-pressed={selected}
                      onClick={() => togglePreset(item)}
                    >
                      <span className="wa-preset__top">
                        <span className="wa-preset__cat">{item.category}</span>
                        <i className="wa-preset__check" aria-hidden="true">
                          {selected ? <AppIcon name="check" size={11} strokeWidth={2.5} /> : "+"}
                        </i>
                      </span>
                      <strong className="wa-preset__title">{item.title}</strong>
                      <p className="wa-preset__desc">{item.prompt}</p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* 中栏：试穿画板 & 创作控制台 */}
          <section className="wa-center" aria-label="试穿画板与生成控制台">
            <div className="wa-stage">
              {generating ? (
                <div className="wa-developing" aria-live="polite">
                  <ThinkingOrb state="working" size={64} />
                  <ImageGenStageIndicator elapsedSeconds={elapsed} />
                  <span className="wa-developing__time">正在显影成片 · {formatTime(elapsed)}</span>
                  <button type="button" className="wa-developing__stop" onClick={stopGenerating}>
                    取消生成
                  </button>
                </div>
              ) : current ? (
                <div className="wa-stage__img-wrap">
                  <img
                    className="wa-stage__img"
                    src={current.imageUrl}
                    alt={current.prompt}
                    onClick={() => setLightboxOpen(true)}
                  />
                  <div className="wa-stage__bar">
                    <button
                      type="button"
                      className="wa-stage__act is-accent"
                      disabled={lockingModel}
                      onClick={() => void lockAsPersonRef(current)}
                      title="锁定这张图的人物五官，继续尝试其他服装或动作"
                    >
                      <AppIcon name="user" size={13} />
                      {lockingModel ? "载入中…" : "设为人物继续换装"}
                    </button>
                    <button type="button" className="wa-stage__act" onClick={() => setLightboxOpen(true)}>
                      <AppIcon name="maximize" size={13} />
                      查看大图
                    </button>
                    <button
                      type="button"
                      className="wa-stage__act"
                      disabled={stageDownload.status === "pending"}
                      onClick={() =>
                        void stageDownload.run(
                          (signal) => downloadImage(current, signal),
                          "已发起原图下载",
                          "下载未完成，请检查网络后重试",
                        )
                      }
                    >
                      <AppIcon name="download" size={13} />
                      {stageDownload.status === "pending" ? "下载中…" : "下载原图"}
                    </button>
                    <button
                      type="button"
                      className="wa-stage__act"
                      onClick={() => void stageCopy.run(() => copyText(current.prompt), "提示词已复制")}
                    >
                      <AppIcon name="copy" size={13} />
                      {stageCopy.status === "success" ? "已复制" : "复制提示词"}
                    </button>
                    <button
                      type="button"
                      className="wa-stage__act is-danger"
                      onClick={() => void handleDeleteImage(current)}
                    >
                      <AppIcon name="trash" size={13} />
                      删除
                    </button>
                  </div>
                </div>
              ) : (
                <div className="wa-empty">
                  <span className="wa-empty__badge">
                    <AppIcon name="hanger" size={13} />
                    FASHION ATELIER · 穿搭工作台
                  </span>
                  <h2>人物 + 服装 + 姿势 自由拼装</h2>
                  <p>上传参考图进行 AI 试穿与姿态控制，或直接描述穿搭构思出图。</p>
                  <div className="wa-empty__modes">
                    <div className="wa-empty__card">
                      <b>
                        <i>01</i>人物参考
                      </b>
                      <span>锁定模特面部五官、发型与身材特征，连续试穿多套成衣。</span>
                    </div>
                    <div className="wa-empty__card">
                      <b>
                        <i>02</i>服装参考
                      </b>
                      <span>上传衣服平铺图或单品图，精准还原款式结构、色彩与面料。</span>
                    </div>
                    <div className="wa-empty__card">
                      <b>
                        <i>03</i>姿势参考
                      </b>
                      <span>上传动作线稿或全身参考照，控制机位角度与肢体姿态。</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="wa-composer">
              <div className="wa-tryon-head">
                <span className={`wa-mode-pill${modeSummary.live ? " is-live" : ""}`}>
                  <i aria-hidden="true" />
                  {modeSummary.text}
                </span>
                {synthesizedPrompt && (
                  <button
                    type="button"
                    className="wa-prompt-toggle"
                    onClick={() => setShowFullPrompt((open) => !open)}
                  >
                    {showFullPrompt ? "收起完整指令" : "预览完整指令"}
                  </button>
                )}
              </div>

              {/* 三槽参考图上传区：人物 + 服装 + 姿势 */}
              <div className="wa-slots">
                {REF_SLOTS.map((slot) => {
                  const dataUrl = refs[slot];
                  const meta = SLOT_META[slot];
                  return (
                    <div
                      key={slot}
                      className={`wa-slot${dataUrl ? " has-img" : ""}${dragSlot === slot ? " is-drag" : ""}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragSlot(slot);
                      }}
                      onDragLeave={() => setDragSlot((currentSlot) => (currentSlot === slot ? null : currentSlot))}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragSlot(null);
                        void handleUploadFile(slot, event.dataTransfer.files?.[0]);
                      }}
                    >
                      {dataUrl ? (
                        <div className="wa-slot__filled">
                          <img src={dataUrl} alt={meta.title} />
                          <span className="wa-slot__copy">
                            <strong>{meta.title}</strong>
                            <small>已就绪</small>
                          </span>
                          <button
                            type="button"
                            className="wa-slot__remove"
                            aria-label={`移除${meta.title}`}
                            onClick={() => setRefs((prev) => ({ ...prev, [slot]: undefined }))}
                          >
                            <AppIcon name="close" size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="wa-slot__btn"
                          onClick={() => fileInputs.current[slot]?.click()}
                        >
                          <span className="wa-slot__icon">
                            <AppIcon name={meta.icon} size={15} />
                          </span>
                          <span className="wa-slot__copy">
                            <strong>{meta.title}</strong>
                            <small>{meta.hint}</small>
                          </span>
                        </button>
                      )}
                      <input
                        ref={(el) => {
                          fileInputs.current[slot] = el;
                        }}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => {
                          void handleUploadFile(slot, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {picked.length > 0 && (
                <div className="wa-picked" aria-label="已选素材">
                  {picked.map((item) => (
                    <span key={item.id} className="wa-chip">
                      <small>{WEAR_KIND_SHORT[item.kind]}</small>
                      <span>{item.title}</span>
                      <button
                        type="button"
                        aria-label={`移除 ${item.title}`}
                        onClick={() => togglePreset(item)}
                      >
                        <AppIcon name="close" size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <textarea
                className="wa-textarea"
                rows={2}
                maxLength={8000}
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmit) {
                    event.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder="输入穿搭或动作描述（如：让人物穿这套衣服侧坐窗边，柔和自然光；Ctrl+Enter 提交）……"
                aria-label="生图描述"
              />

              {showFullPrompt && synthesizedPrompt && (
                <div className="wa-prompt-preview">{synthesizedPrompt}</div>
              )}

              {(genError || !available) && (
                <p className="wa-error" role="alert">
                  {genError || (isAdmin ? "尚未启用生图模型，请打开模型配置设置" : "生图服务暂未开放")}
                </p>
              )}

              <div className="wa-tools">
                <div ref={modelPopRef} className="rd-popwrap is-model">
                  <button
                    type="button"
                    className={`rd-tok is-mode${modelOpen ? " is-open" : ""}`}
                    aria-haspopup="menu"
                    aria-expanded={modelOpen}
                    title={`模型：${activeModel || "未配置"}`}
                    onClick={() => setModelOpen((open) => !open)}
                  >
                    <span className="rd-tok__lbl">模型</span>
                    <b>{activeModel || "未配置"}</b>
                    <AppIcon name="chevron-down" size={11} className="rd-tok__chev" />
                  </button>
                  {modelOpen && (
                    <div className="rd-pop" role="menu">
                      <h6>生图模型</h6>
                      {models.map((id) => {
                        const selected = id === activeModel;
                        const costLabel = `${config.imageModelCosts?.[id] ?? DEFAULT_IMAGE_MODEL_CREDIT_COST} 积分/张`;
                        return (
                          <button
                            key={id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            className={selected ? "is-on" : ""}
                            onClick={() => {
                              setSelectedImageModel(id);
                              setModelOpen(false);
                            }}
                          >
                            <span>{id}</span>
                            <small>{costLabel}</small>
                            <i aria-hidden="true">
                              {selected ? <AppIcon name="check" size={12} strokeWidth={2.4} /> : null}
                            </i>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="wa-ratios" role="radiogroup" aria-label="画幅比例">
                  {sizeOptions.map((option) => {
                    const [w, h] = option.value.split("x").map(Number);
                    const ratio = w && h ? w / h : 1;
                    const rectStyle =
                      ratio >= 1
                        ? { width: 13, height: Math.max(7, Math.round(13 / ratio)) }
                        : { width: Math.max(7, Math.round(13 * ratio)), height: 13 };
                    const checked = option.value === activeSize;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        title={option.label}
                        onClick={() => setSize(option.value)}
                      >
                        <i className="wa-ratio-rect" style={rectStyle} aria-hidden="true" />
                        <span>{shortRatioLabel(option.label, option.value)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rd-actions">
                  {generating ? (
                    <button type="button" className="rd-go" onClick={stopGenerating}>
                      停止
                    </button>
                  ) : (
                    <button type="button" className="rd-go" disabled={!canSubmit} onClick={() => void handleGenerate()}>
                      <span>{activeRefCount > 0 ? "生成试穿" : "生成穿搭"}</span>
                      <span className="rd-go__cost">{isAdmin ? "免费" : perImageCost}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 右栏：穿搭成片集 */}
          <aside className="wa-pane wa-hist" aria-label="穿搭成片历史">
            <div className="wa-hist__head">
              <b>
                穿搭成片 <span>{history.length}</span>
              </b>
              <button type="button" className="wa-hist__link" onClick={() => softNavigate(router, "/?nav=gallery")}>
                全部图库 →
              </button>
            </div>
            <div className="wa-hist__body">
              {history.length > 0 ? (
                <div className="wa-hist__grid">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`wa-hist__item${current?.id === item.id ? " is-on" : ""}`}
                      onClick={() => setCurrent(item)}
                      title={item.prompt}
                    >
                      <img src={thumbSrc(item)} alt={item.prompt} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="wa-hist__empty">
                  这里会收纳你在穿搭工作台生成的成片，同时也会自动同步至主图库。
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* 大图预览 Lightbox */}
        {lightboxOpen && current && (
          <div
            className="rd-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="穿搭成片大图"
            onClick={() => setLightboxOpen(false)}
          >
            <figure onClick={(event) => event.stopPropagation()}>
              <img src={current.imageUrl} alt={current.prompt} />
              <figcaption>
                <p>{current.prompt}</p>
                <span>
                  {current.model} · {current.size}
                </span>
                <div>
                  <button
                    type="button"
                    className="rd-bb is-visible"
                    disabled={lockingModel}
                    onClick={() => void lockAsPersonRef(current)}
                  >
                    <AppIcon name="user" size={13} />
                    设为人物继续换装
                  </button>
                  <button
                    type="button"
                    className="rd-bb is-visible"
                    onClick={() =>
                      void stageDownload.run(
                        (signal) => downloadImage(current, signal),
                        "已发起原图下载",
                        "下载未完成，请检查网络后重试",
                      )
                    }
                  >
                    <AppIcon name="download" size={13} />
                    下载原图
                  </button>
                  <button
                    type="button"
                    className="rd-bb is-visible"
                    onClick={() => void stageCopy.run(() => copyText(current.prompt), "提示词已复制")}
                  >
                    <AppIcon name="copy" size={13} />
                    复制提示词
                  </button>
                  <button
                    type="button"
                    className="rd-bb is-visible is-danger"
                    onClick={() => void handleDeleteImage(current)}
                  >
                    <AppIcon name="trash" size={13} />
                    删除
                  </button>
                  <button type="button" className="rd-bb is-visible" onClick={() => setLightboxOpen(false)}>
                    关闭
                  </button>
                </div>
              </figcaption>
            </figure>
          </div>
        )}

        <AppModals
          onSaveConfig={handleSaveConfig}
          role={role}
          donationOpen={donationOpen}
          onDonationClose={() => setDonationOpen(false)}
          checkinLoading={checkinLoading}
          onCheckinClick={handleCheckin}
        />
      </div>
    </AppShell>
  );
}
