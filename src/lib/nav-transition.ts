/** 带过渡的客户端导航（支持 View Transitions，失败则回退普通路由） */

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

export function softNavigate(
  router: RouterLike,
  href: string,
  mode: "push" | "replace" = "push",
): void {
  const go = () => {
    if (mode === "replace") router.replace(href);
    else router.push(href);
  };

  if (typeof document === "undefined") {
    go();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  if (typeof doc.startViewTransition === "function") {
    try {
      doc.startViewTransition(() => {
        go();
      });
      return;
    } catch {
      // fall through
    }
  }

  go();
}
