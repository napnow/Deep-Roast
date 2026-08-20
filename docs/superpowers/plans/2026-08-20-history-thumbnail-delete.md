# History Thumbnail Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete an image directly from the history thumbnail grid without opening the details tab.

**Architecture:** Keep selection and deletion as separate sibling buttons inside each thumbnail container. Reuse the existing `onDelete` callback and confirmation copy; add one pure confirmation helper so confirm/cancel behavior is covered by the existing Node test setup.

**Tech Stack:** Next.js 16.2.10, React 19, TypeScript, CSS, Node test runner.

## Global Constraints

- Preserve the existing image selection, details, preview, and backend deletion behavior.
- Desktop delete control appears on hover/focus; touch layouts keep it visible.
- The delete action has an accessible name and does not trigger thumbnail selection.
- Do not add dependencies or a new API route.

---

### Task 1: Add direct deletion to history thumbnails

**Files:**
- Modify: `src/lib/image-library.ts`
- Modify: `src/lib/image-library.test.ts`
- Modify: `src/components/ImageGen/AssetInspector.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: existing `AssetInspectorProps.onDelete(id: string)`.
- Produces: `confirmedImageDeletionId(imageId: string, confirmed: boolean): string | null`.

- [ ] **Step 1: Write the failing confirmation test**

Add to `src/lib/image-library.test.ts`:

```ts
it("returns an image id only after deletion is confirmed", () => {
  assert.equal(confirmedImageDeletionId("image-1", false), null);
  assert.equal(confirmedImageDeletionId("image-1", true), "image-1");
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --import tsx --test src/lib/image-library.test.ts`

Expected: FAIL because `confirmedImageDeletionId` is not exported.

- [ ] **Step 3: Implement the helper**

Add to `src/lib/image-library.ts`:

```ts
export function confirmedImageDeletionId(
  imageId: string,
  confirmed: boolean,
): string | null {
  return confirmed ? imageId : null;
}
```

- [ ] **Step 4: Split selection and deletion controls**

For every history image, render an `.asset-thumbnail` container containing:

```tsx
<button className="asset-thumbnail__select" onClick={() => onSelect(image)}>
  <img src={image.thumbUrl || image.imageUrl} alt={image.prompt} />
</button>
<button
  className="asset-thumbnail__delete"
  aria-label={`删除图片：${image.prompt}`}
  onClick={() => {
    const id = confirmedImageDeletionId(
      image.id,
      window.confirm("确认删除这张图片？"),
    );
    if (id) onDelete(id);
  }}
>
  <AppIcon name="trash" size={14} />
</button>
```

- [ ] **Step 5: Add responsive interaction styling**

Update `src/app/globals.css` so `.asset-thumbnail__delete` is a 30px top-right overlay, hidden until hover/focus on fine pointers and always visible under `@media (hover: none), (pointer: coarse)`.

- [ ] **Step 6: Verify and deploy**

Run:

```powershell
npm.cmd test
npm.cmd exec tsc -- --noEmit
npm.cmd exec eslint -- src/components/ImageGen/AssetInspector.tsx src/lib/image-library.ts
npm.cmd run build
```

Expected: all commands exit 0. Deploy using the existing `/opt/deeproast` atomic release workflow, then verify `https://deeproast.sryze.cc/login` returns HTTP 200.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/image-library.ts src/lib/image-library.test.ts src/components/ImageGen/AssetInspector.tsx src/app/globals.css
git commit -m "feat: add thumbnail image deletion"
```
