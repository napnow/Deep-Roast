# 多图图生图双模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ( - [ ] ) syntax for tracking.

**Goal:** 在不破坏旧图生图接口的前提下，支持逐图独立修改和目标图参考图修改，并部署到服务器的 Deeproast 实例。

**Architecture:** 用共享的客户端/服务端请求契约描述编辑任务；服务端把旧请求和新请求规范化为任务数组，再由一个串行执行器负责模型能力校验、积分预校验、上游调用和结果关联。前端在现有图生图面板内增加模式、逐图指令、目标图和参考图选择，底层 hook 统一提交新契约。

**Tech Stack:** Next.js 16.2.10, React 19, TypeScript, Node test runner, Drizzle/PostgreSQL, OpenAI-compatible /v1/images/edits proxy.

## Global Constraints

- 最多 5 张上传图片。
- 逐图模式每个任务只发送一张目标图；参考模式把目标图放在多图数组第一位。
- 参考模式第一版只允许 gpt-image-2。
- 旧 { image, prompt, count } 请求继续按逐图独立生成兼容处理。
- 参考图不重复计费；每个成功输出只扣一次 CREDIT_PER_IMAGE。
- 不新增数据库迁移，不修改 chatgpt2api/grok2api 容器代码。
- 工作区现有未提交改动归用户所有；每次提交只暂存本任务新增或修改的明确文件。

---

### Task 1: 建立共享请求契约和后端任务规范化器

**Files:**
- Create: src/lib/image-edit-contract.ts
- Create: src/server/services/image-edit-tasks.ts
- Test: src/server/services/image-edit-tasks.test.ts

**Interfaces:**
- ImageEditRequest：客户端和 API 共用的可选旧/新字段契约。
- ImageEditTask：规范化后的 per-image 或 reference 任务。
- normalizeImageEditRequest(input: ImageEditRequest, model: string): ImageEditTask[]：执行输入校验和旧请求兼容。
- calculateImageEditCost(tasks: ImageEditTask[], count: number): number：返回应预校验的输出数量。
- supportsReferenceImageEdit(model: string): boolean：第一版仅对 gpt-image-2 返回 true。

- [ ] **Step 1: Write the failing tests**

在 src/server/services/image-edit-tasks.test.ts 覆盖：

~~~ts
it("normalizes the legacy multi-image request into independent tasks", () => {
  const tasks = normalizeImageEditRequest(
    { image: ["a", "b"], prompt: "换背景" },
    "gpt-image-2",
  );
  assert.deepEqual(tasks, [
    { mode: "per-image", targetImage: "a", prompt: "换背景", targetIndex: 0 },
    { mode: "per-image", targetImage: "b", prompt: "换背景", targetIndex: 1 },
  ]);
});

it("keeps one target and one or more references for reference mode", () => {
  const tasks = normalizeImageEditRequest(
    {
      mode: "reference",
      targetImage: "target",
      referenceImages: ["ref-a", "ref-b"],
      prompt: "参考风格修改",
    },
    "gpt-image-2",
  );
  assert.deepEqual(tasks[0], {
    mode: "reference",
    targetImage: "target",
    referenceImages: ["ref-a", "ref-b"],
    prompt: "参考风格修改",
    targetIndex: 0,
  });
});

it("rejects self-reference and unsupported reference models", () => {
  assert.throws(
    () => normalizeImageEditRequest(
      {
        mode: "reference",
        targetImage: "same",
        referenceImages: ["same"],
        prompt: "修改",
      },
      "gpt-image-2",
    ),
    /不能作为参考图/,
  );
  assert.throws(
    () => normalizeImageEditRequest(
      {
        mode: "reference",
        targetImage: "target",
        referenceImages: ["ref"],
        prompt: "修改",
      },
      "grok-imagine-image-lite",
    ),
    /GPT Image 2/,
  );
});

it("charges per task rather than per reference image", () => {
  const tasks = normalizeImageEditRequest(
    {
      mode: "reference",
      targetImage: "target",
      referenceImages: ["ref-a", "ref-b"],
      prompt: "修改",
    },
    "gpt-image-2",
  );
  assert.equal(calculateImageEditCost(tasks, 3), 3);
});
~~~

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm test -- src/server/services/image-edit-tasks.test.ts

Expected: FAIL because the contract and normalizer do not exist yet.

- [ ] **Step 3: Write the minimal contract and normalizer**

src/lib/image-edit-contract.ts defines the serializable types:

~~~ts
export type ImageEditMode = "per-image" | "reference";

export interface ImageEditItemInput {
  image: string;
  prompt?: string;
  targetIndex?: number;
}

export interface ImageEditRequest {
  mode?: ImageEditMode;
  image?: string | string[];
  prompt?: string;
  items?: ImageEditItemInput[];
  targetImage?: string;
  referenceImages?: string[];
  model?: string;
  size?: string;
  count?: number;
}

export interface ImageEditTaskBase {
  targetImage: string;
  prompt: string;
  targetIndex: number;
}

export type ImageEditTask =
  | ({ mode: "per-image" } & ImageEditTaskBase)
  | ({ mode: "reference"; referenceImages: string[] } & ImageEditTaskBase);
~~~

src/server/services/image-edit-tasks.ts trims and filters image strings, applies the 5-image limit, applies the prompt fallback "生成这张图的变体", maps legacy image arrays to per-image, and throws ApiError(..., 400) for empty input, self-reference, missing reference images, or unsupported models.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: npm test -- src/server/services/image-edit-tasks.test.ts

Expected: PASS for all normalizer and cost cases.

- [ ] **Step 5: Commit only the contract and task-normalizer files**

~~~bash
git add src/lib/image-edit-contract.ts src/server/services/image-edit-tasks.ts src/server/services/image-edit-tasks.test.ts
git commit -m "feat: add multi-image edit task contract"
~~~

### Task 2: Refactor the image service into a task runner

**Files:**
- Modify: src/server/services/image.ts:328-545,614-693
- Modify: src/app/api/image-edit/route.ts
- Modify: src/app/api/image-edit/batch/route.ts
- Test: src/server/services/image-edit-runner.test.ts

**Interfaces:**
- Add runImageEditTasks(opts) in src/server/services/image.ts; it consumes ImageEditRequest and returns results with taskIndex and targetIndex.
- Keep editImage(opts) as the legacy single/array-compatible entry point for existing callers.
- Extract the current one-upstream-call body into an internal editImageOnce(opts) accepting image: string | string[] and charging one successful output.

- [ ] **Step 1: Write failing service tests**

Use a dependency-injected upstream executor in the new runner test so no real image request or database write is made:

~~~ts
it("sends only the target image for per-image tasks", async () => {
  const calls: Array<string | string[]> = [];
  const result = await runImageEditTasks({
    userId: "user",
    modelOverride: "gpt-image-2",
    request: {
      mode: "per-image",
      items: [
        { image: "a", prompt: "改一" },
        { image: "b", prompt: "改二" },
      ],
    },
    execute: async (task) => {
      calls.push(task.mode === "reference" ? [task.targetImage, ...task.referenceImages] : task.targetImage);
      return { id: task.targetImage, imageUrl: "/images/result.png", prompt: task.prompt, model: "gpt-image-2", size: "1024x1024" };
    },
  });
  assert.deepEqual(calls, ["a", "b"]);
  assert.deepEqual(result.images.map((item) => [item.taskIndex, item.targetIndex]), [[0, 0], [1, 1]]);
});

it("sends target first and references together", async () => {
  const calls: Array<string | string[]> = [];
  await runImageEditTasks({
    userId: "user",
    modelOverride: "gpt-image-2",
    request: { mode: "reference", targetImage: "target", referenceImages: ["ref-a", "ref-b"], prompt: "参考" },
    execute: async (task) => {
      calls.push(task.mode === "reference" ? [task.targetImage, ...task.referenceImages] : task.targetImage);
      return { id: "result", imageUrl: "/images/result.png", prompt: task.prompt, model: "gpt-image-2", size: "1024x1024" };
    },
  });
  assert.deepEqual(calls, [["target", "ref-a", "ref-b"]]);
});
~~~

- [ ] **Step 2: Run the focused service tests to verify they fail**

Run: npm test -- src/server/services/image-edit-runner.test.ts

Expected: FAIL because runImageEditTasks and the injectable executor do not exist.

- [ ] **Step 3: Extract the single upstream call and implement the runner**

Move the existing fetch, decode, crop, file persistence, thumbnail, database insert, and one-output credit consumption from editImage into editImageOnce. For non-Grok requests, change the payload from image: images[0] to:

~~~ts
image: images.length === 1 ? images[0] : images,
~~~

Keep Grok's current explicit single-image rejection. The runner must:

1. call normalizeImageEditRequest(request, model);
2. pre-check CREDIT_PER_IMAGE * tasks.length * count for non-admin users;
3. loop tasks and count serially;
4. call editImageOnce with the target only for per-image, or [targetImage, ...referenceImages] for reference;
5. append taskIndex and targetIndex to each successful result;
6. continue after per-task errors and return total, succeeded, failed, and lastError.

The existing editImage wrapper continues to normalize an array into independent legacy tasks. The existing editImageBatch delegates to the new runner, preserving old callers and correcting reference-mode precharge to count outputs rather than input references.

- [ ] **Step 4: Update both API routes to pass the complete request body**

Replace the route-local { image, prompt, model, size, count } destructuring with ImageEditRequest and pass request: body to the runner. The non-batch route uses count: 1; the batch route uses the requested count. Both keep existing auth and rate limits.

- [ ] **Step 5: Run focused and regression tests**

Run: npm test -- src/server/services/image-edit-tasks.test.ts src/server/services/image-edit-runner.test.ts src/server/services/image-credit-policy.test.ts

Expected: PASS, with no change to the existing retry policy.

- [ ] **Step 6: Commit the backend task runner**

~~~bash
git add src/server/services/image.ts src/server/services/image-edit-runner.test.ts src/app/api/image-edit/route.ts src/app/api/image-edit/batch/route.ts
git commit -m "feat: orchestrate multi-image edit tasks"
~~~

### Task 3: Add the two-mode editor UI

**Files:**
- Modify: src/components/ImageGen/Img2ImgPanel.tsx
- Create: src/components/ImageGen/image-edit-ui.ts
- Modify: src/components/ImageGen/CreationPanel.tsx
- Modify: src/components/ImageGen/ImageGenView.tsx
- Modify: src/components/ImageGen/ImageInputColumn.tsx
- Modify: src/components/ImageGen/ImageMobileBar.tsx
- Test: src/components/ImageGen/image-edit-ui.test.ts

**Interfaces:**
- Change the editor callback chain to pass ImageEditRequest plus size and count rather than separate image arrays and one shared prompt.
- Img2ImgPanel owns editMode, perImagePrompts, targetIndex, and referenceIndexes; wrapper components only forward the callback.

- [ ] **Step 1: Write failing UI contract tests**

Create the pure request builder in src/components/ImageGen/image-edit-ui.ts and test it without importing React or JSX:

~~~ts
it("builds independent tasks with per-image prompt fallback", () => {
  assert.deepEqual(
    buildImageEditRequest(
      ["a", "b"],
      { mode: "per-image", prompts: ["改一", ""] },
      "统一修改",
    ),
    {
      mode: "per-image",
      items: [
        { image: "a", prompt: "改一", targetIndex: 0 },
        { image: "b", prompt: "统一修改", targetIndex: 1 },
      ],
    },
  );
});

it("builds a target/reference request without the target in references", () => {
  assert.deepEqual(
    buildImageEditRequest(
      ["target", "ref"],
      { mode: "reference", targetIndex: 0, referenceIndexes: [1] },
      "参考风格",
    ),
    {
      mode: "reference",
      targetImage: "target",
      referenceImages: ["ref"],
      prompt: "参考风格",
    },
  );
});
~~~

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: npm test -- src/components/ImageGen/image-edit-ui.test.ts

Expected: FAIL because the builder and two-mode state do not exist.

- [ ] **Step 3: Implement the editor state and UI**

Add a compact mode selector, preserve the existing upload and style controls, and render:

- per-image prompt inputs and a shared fallback prompt in “分别修改”;
- target buttons and reference checkboxes in “参考修改”;
- a model-independent warning in the UI only when the selected model is not gpt-image-2 if the current model is available to the panel; the server remains the authority;
- estimated cost as CREDIT_PER_IMAGE * activeTaskCount * batchCount, where reference mode has one active task.

When a reference image is removed, remove its index from referenceIndexes and rebase the selected target index. When the target changes, automatically remove that index from references. When generation finishes, clear prompts and selection state together with the existing images.

- [ ] **Step 4: Thread the new callback through desktop and mobile wrappers**

Update the prop types and pass-through calls in CreationPanel, ImageGenView, ImageInputColumn, and ImageMobileBar. Keep the existing text-to-image and reverse-prompt paths unchanged.

- [ ] **Step 5: Run UI and regression tests**

Run: npm test -- src/components/ImageGen/image-edit-ui.test.ts src/components/ImageGen/ResultCanvas.test.ts src/lib/image-task.test.ts

Expected: PASS, including existing image workspace tests.

- [ ] **Step 6: Commit the UI mode changes**

~~~bash
git add src/lib/image-edit-contract.ts src/components/ImageGen/image-edit-ui.ts src/components/ImageGen/image-edit-ui.test.ts src/components/ImageGen/Img2ImgPanel.tsx src/components/ImageGen/CreationPanel.tsx src/components/ImageGen/ImageGenView.tsx src/components/ImageGen/ImageInputColumn.tsx src/components/ImageGen/ImageMobileBar.tsx
git commit -m "feat: add per-image and reference edit modes"
~~~

### Task 4: Submit, retry, and preserve structured edit tasks

**Files:**
- Modify: src/hooks/useImageActions.ts:188-352
- Modify: src/lib/image-task.ts
- Modify: src/lib/store.ts:206-214
- Test: src/lib/image-task.test.ts

**Interfaces:**
- ImageTaskRequest gains editRequest?: ImageEditRequest while retaining images?: string[] for old persisted task state.
- handleEditImage(request, size) and handleEditImageBatch(request, size, count) send { ...request, size, count, model } to the corresponding API route.

- [ ] **Step 1: Write the failing retry test**

Add a pure task-state constructor in src/lib/image-task.ts and test that a structured reference task is retained without being flattened to a plain image array:

~~~ts
it("keeps structured edit requests in image task state", () => {
  const request: ImageEditRequest = {
    mode: "reference",
    targetImage: "target",
    referenceImages: ["ref"],
    prompt: "参考",
  };
  const state = createImageTaskState({
    mode: "edit",
    prompt: "参考",
    size: "1024x1024",
    count: 1,
    editRequest: request,
  });
  assert.deepEqual(state.request?.editRequest, request);
});
~~~

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm test -- src/lib/image-task.test.ts

Expected: FAIL because editRequest and createImageTaskState are not part of the task state contract.

- [ ] **Step 3: Implement request preservation and hook payloads**

Add editRequest?: ImageEditRequest to ImageTaskRequest, add createImageTaskState(request) to produce the generating state, and make startImageTask use it. On retry, prefer request.editRequest; fall back to the legacy request.images path for tasks created before this change. Use response metadata only for ordering and user-facing success counts; keep the existing history record shape.

- [ ] **Step 4: Run focused tests and type-check the hook**

Run: npm test -- src/lib/image-task.test.ts; then npx tsc --noEmit.

Expected: PASS and no new TypeScript errors.

- [ ] **Step 5: Commit the submission and retry changes**

~~~bash
git add src/hooks/useImageActions.ts src/lib/image-task.ts src/lib/image-task.test.ts src/lib/store.ts
git commit -m "feat: preserve structured image edit retries"
~~~

### Task 5: Full verification, review, and deployment

**Files:**
- Modify only files already listed above unless a failing test identifies a directly related contract issue.
- Server backup: /opt/deeproast/.deploy/backups/<timestamp>/ on 20.41.121.31.

- [ ] **Step 1: Run the full local verification**

Run:

~~~bash
npm test
npx tsc --noEmit
npm run build
~~~

Expected: all new tests pass, TypeScript passes, and the production build completes. If the existing unrelated rate-limit environment test remains red, record it separately and do not attribute it to this feature.

- [ ] **Step 2: Inspect the final diff and request code review**

Run:

~~~bash
git diff --stat HEAD~4..HEAD
git status --short
~~~

Review specifically that no API keys, .env.production, generated images, or unrelated user changes are included. Fix all critical or important review findings before deployment.

- [ ] **Step 3: Create a recoverable server backup**

On the server, create a timestamped backup of only the files to be replaced plus .env.production, preserving permissions and never printing file contents:

~~~bash
backup_dir="/opt/deeproast/.deploy/backups/$(date +%Y%m%d-%H%M%S)-multi-image-edit"
mkdir -p "$backup_dir"
cp --parents src/lib/image-edit-contract.ts src/server/services/image.ts src/server/services/image-edit-tasks.ts src/app/api/image-edit/route.ts src/app/api/image-edit/batch/route.ts .env.production "$backup_dir"
~~~

- [ ] **Step 4: Synchronize only the feature files**

Transfer the exact modified source and test files to /opt/deeproast, then run the production build in the existing deployment directory. Do not copy .env, .env.production, node_modules, .next, or public/images from the local workspace.

- [ ] **Step 5: Restart and verify the production process**

Use the existing service/container restart mechanism, verify the Next.js process is healthy, and issue a non-generating authenticated smoke request if available. Confirm GPT_IMAGE_BASE_URL still resolves to http://127.0.0.1:2567/v1; do not change the proxy container.

- [ ] **Step 6: Roll back only if deployment fails**

If build, restart, or health verification fails, stop the new process, copy the backed-up files back to their original paths, restore the previous process, and report the exact failure. If verification passes, report the deployed commit and the two manual acceptance scenarios.
