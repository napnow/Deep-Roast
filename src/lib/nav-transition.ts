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

  // 移动端 / 窄屏：部分手机浏览器（微信内置、旧版 Safari/Chrome）的
  // View Transitions 实现不完善，会吞掉导航导致登录成功却不跳转。
  // 窄屏直接走普通导航，保证跳转可靠。
  const isNarrow =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 768px)").matches;
  if (isNarrow) {
    go();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  if (typeof doc.startViewTransition === "function") {
    try {
      const transition = doc.startViewTransition(() => {
        go();
      });
      // 主动吞掉 abort（用户快速操作或新 transition 打断旧的时会发生）
      transition.finished.catch((err) => {
        if (err && (err.name === "AbortError" || err.name === "RuntimeAbortError")) {
          // 这是预期的，被新过渡打断了，忽略即可
          return;
        }
        // 其他错误才打印
        console.error(err);
      });
      return;
    } catch {
      // fall through
    }
  }

  go();
}
