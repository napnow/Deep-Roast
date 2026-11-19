export type CanvasGenerationTaskStatus = "queued" | "generating" | "success" | "error" | "cancelled";

export type CanvasGenerationTask = {
  taskId: string;
  nodeId: string;
  status: CanvasGenerationTaskStatus;
  queuedAt: number;
  startedAt?: number;
  elapsedSeconds: number;
  count: number;
  completed: number;
  failed: number;
  error?: string;
};

export type CanvasGenerationJobResult = {
  completed: number;
  failed: number;
  error?: string;
};

export type CanvasGenerationJob = {
  nodeId: string;
  count: number;
  run: (signal: AbortSignal) => Promise<CanvasGenerationJobResult>;
};

type QueueOptions = {
  limit?: number;
  onChange?: (tasks: CanvasGenerationTask[]) => void;
};

type InternalTask = CanvasGenerationTask & {
  job: CanvasGenerationJob;
  controller?: AbortController;
  idleWaiters: Array<() => void>;
};

let taskSequence = 0;

function nextTaskId() {
  taskSequence += 1;
  return `canvas-generation-${Date.now()}-${taskSequence}`;
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.message === "图片生成已取消");
}

export function createCanvasGenerationQueue({ limit = 2, onChange }: QueueOptions = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Canvas generation queue limit must be positive");
  const tasks = new Map<string, InternalTask>();
  const waiting: string[] = [];
  const listeners = new Set<(tasks: CanvasGenerationTask[]) => void>();
  let active = 0;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const snapshot = () => [...tasks.values()].map(({ job: _job, controller: _controller, idleWaiters: _idleWaiters, ...task }) => ({ ...task }));
  const emit = () => {
    const value = snapshot();
    onChange?.(value);
    listeners.forEach(listener => listener(value));
  };
  const ensureTimer = () => {
    if (timer || disposed) return;
    timer = setInterval(() => {
      let changed = false;
      const now = Date.now();
      tasks.forEach(task => {
        if (task.status !== "generating" || task.startedAt === undefined) return;
        const elapsedSeconds = Math.floor(Math.max(0, now - task.startedAt) / 1000);
        if (elapsedSeconds !== task.elapsedSeconds) {
          task.elapsedSeconds = elapsedSeconds;
          changed = true;
        }
      });
      if (changed) emit();
    }, 1000);
  };
  const stopTimerIfIdle = () => {
    if (tasksOfStatus("queued", "generating").length > 0) return;
    if (timer) clearInterval(timer);
    timer = null;
  };
  function tasksOfStatus(...statuses: CanvasGenerationTaskStatus[]) {
    return [...tasks.values()].filter(task => statuses.includes(task.status));
  }
  const resolveIdle = (task: InternalTask) => {
    if (task.status === "queued" || task.status === "generating") return;
    const waiters = task.idleWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  };
  const finish = (task: InternalTask, result: CanvasGenerationJobResult) => {
    if (task.status === "cancelled") {
      resolveIdle(task);
      return;
    }
    task.completed = Math.max(0, result.completed);
    task.failed = Math.max(0, result.failed);
    task.error = result.error;
    task.status = task.completed > 0 ? "success" : task.failed > 0 ? "error" : "success";
    resolveIdle(task);
    emit();
  };
  const run = async (task: InternalTask) => {
    if (disposed || task.status !== "queued") return;
    active += 1;
    task.status = "generating";
    task.startedAt = Date.now();
    task.elapsedSeconds = 0;
    task.controller = new AbortController();
    ensureTimer();
    emit();
    try {
      const result = await task.job.run(task.controller.signal);
      finish(task, result);
    } catch (error) {
      if (task.status !== "cancelled") {
        task.failed = Math.max(1, task.failed);
        task.error = error instanceof Error ? error.message : "生成失败";
        task.status = isAbortError(error) ? "cancelled" : "error";
        resolveIdle(task);
        emit();
      }
    } finally {
      active -= 1;
      task.controller = undefined;
      drain();
      stopTimerIfIdle();
    }
  };
  function drain() {
    if (disposed) return;
    while (active < limit && waiting.length) {
      const nodeId = waiting.shift()!;
      const task = tasks.get(nodeId);
      if (task?.status === "queued") void run(task);
    }
  }

  const enqueue = (job: CanvasGenerationJob) => {
    if (disposed || tasksOfStatus("queued", "generating").some(task => task.nodeId === job.nodeId)) return null;
    const task: InternalTask = {
      taskId: nextTaskId(),
      nodeId: job.nodeId,
      status: "queued",
      queuedAt: Date.now(),
      elapsedSeconds: 0,
      count: job.count,
      completed: 0,
      failed: 0,
      job,
      idleWaiters: [],
    };
    tasks.set(job.nodeId, task);
    waiting.push(job.nodeId);
    emit();
    drain();
    return task.taskId;
  };
  const cancel = (nodeId: string) => {
    const task = tasks.get(nodeId);
    if (!task || (task.status !== "queued" && task.status !== "generating")) return false;
    task.status = "cancelled";
    if (task.status === "cancelled" && task.controller) task.controller.abort();
    const index = waiting.indexOf(nodeId);
    if (index >= 0) waiting.splice(index, 1);
    resolveIdle(task);
    emit();
    drain();
    stopTimerIfIdle();
    return true;
  };
  const retry = (nodeId: string) => {
    const task = tasks.get(nodeId);
    if (!task || task.status !== "error") return null;
    tasks.delete(nodeId);
    return enqueue(task.job);
  };
  const get = (nodeId: string) => {
    const task = tasks.get(nodeId);
    if (!task) return undefined;
    const { job: _job, controller: _controller, idleWaiters: _idleWaiters, ...value } = task;
    return { ...value };
  };
  const getAll = () => snapshot();
  const subscribe = (listener: (tasks: CanvasGenerationTask[]) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const whenIdle = (nodeId: string) => {
    const task = tasks.get(nodeId);
    if (!task || (task.status !== "queued" && task.status !== "generating")) return Promise.resolve();
    return new Promise<void>(resolve => task.idleWaiters.push(resolve));
  };
  const dispose = () => {
    disposed = true;
    if (timer) clearInterval(timer);
    timer = null;
    tasks.forEach(task => {
      if (task.status === "queued" || task.status === "generating") {
        task.status = "cancelled";
        task.controller?.abort();
        resolveIdle(task);
      }
    });
    waiting.length = 0;
    emit();
  };

  return { enqueue, cancel, retry, get, getAll, subscribe, whenIdle, dispose };
}
