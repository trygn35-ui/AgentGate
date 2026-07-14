import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactElement } from "react";

/** 悬停多久才浮出来。太快会在扫过一行时糊一脸。 */
const HOVER_DELAY_MS = 160;
/** 提示框离锚点的间隙。 */
const GAP = 8;
const EDGE = 10;
/** 顶栏 54px，提示不许压上去。 */
const TOP_SAFE = 60;

interface Hint {
  text: string;
  x: number;
  /** 锚点的上下沿。翻不翻面要等量出面板真实高度才知道。 */
  top: number;
  bottom: number;
  /** 贴在锚点下方（上方放不下时）。 */
  below: boolean;
}

/**
 * 全应用唯一的提示层，替掉原生 title。
 *
 * 原生 title 是操作系统画的：黄底、圆角、自带延迟和字体，跟这套印刷/仪表的界面
 * 完全不搭，而且样式一点都改不了。
 *
 * 做成一个全局层而不是每个元素包一个 Tooltip 组件，是因为节点数：动态页光是
 * 50 行请求就有三千多个节点，每个要提示的格子再套一层包装，等于白白再加上千个。
 * 这里整个应用只有**一个**面板、**一个**事件监听——元素只要写个 `data-hint`。
 *
 * 换行用 \n，面板按 pre-wrap 原样排。
 */
export function HintLayer(): ReactElement | null {
  const [hint, setHint] = useState<Hint>();
  const panel = useRef<HTMLDivElement>(null);
  const anchor = useRef<Element>(undefined);
  const timer = useRef<number>(undefined);

  useEffect(() => {
    function place(element: Element, text: string): void {
      const rect = element.getBoundingClientRect();
      // 先按「浮在锚点上方、水平居中」摆。真放不放得下要等量出面板高度，见下面那个 effect。
      setHint({
        text,
        x: rect.left + rect.width / 2,
        top: rect.top,
        bottom: rect.bottom,
        below: false,
      });
    }

    function onOver(event: PointerEvent): void {
      const target = event.target instanceof Element
        ? event.target.closest("[data-hint]")
        : null;
      if (target === anchor.current) return;
      window.clearTimeout(timer.current);
      anchor.current = target ?? undefined;
      if (!target) {
        setHint(undefined);
        return;
      }
      const text = target.getAttribute("data-hint");
      if (!text) {
        setHint(undefined);
        return;
      }
      timer.current = window.setTimeout(() => place(target, text), HOVER_DELAY_MS);
    }

    function dismiss(): void {
      window.clearTimeout(timer.current);
      anchor.current = undefined;
      setHint(undefined);
    }

    document.addEventListener("pointerover", onOver);
    // 滚动或按键时锚点就跑了，别让提示留在半空
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("blur", dismiss);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("blur", dismiss);
    };
  }, []);

  /*
   * 摆好之后再量一次，夹回视口里。
   *
   * 面板多高，得先渲染出来才知道——五行的 Token 拆解和一行的路径差着一百多像素。
   * 上方顶穿了顶栏就翻到锚点下面；左右出界就横着挪回来。
   */
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node || !hint) return;

    if (!hint.below && node.getBoundingClientRect().top < TOP_SAFE) {
      setHint({ ...hint, below: true });
      return;
    }
    const rect = node.getBoundingClientRect();
    let dx = 0;
    if (rect.left < EDGE) dx = EDGE - rect.left;
    else if (rect.right > window.innerWidth - EDGE) dx = window.innerWidth - EDGE - rect.right;
    node.style.marginLeft = dx === 0 ? "" : `${dx}px`;
  }, [hint]);

  if (!hint) return null;

  return createPortal(
    <div
      className={`hint ${hint.below ? "below" : ""}`}
      ref={panel}
      role="tooltip"
      style={{ left: hint.x, top: hint.below ? hint.bottom + GAP : hint.top - GAP }}
    >
      {hint.text}
    </div>,
    document.body,
  );
}
