import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

const DIGITS = "0123456789";

/** 滚一格到位的时长。与 CSS 里 .reel[data-rolling] 的点火闪光同源。 */
export const ROLL_MS = 420;

/** 落位前滚过几个随机数字。多了拖沓，少了看不出「滚」。 */
const SPIN_STEPS = 3;

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Reel {
  /** 纸带上的字符，按滚动方向排好序：可视窗口从头滚到尾（或反之）。 */
  frames: string[];
  up: boolean;
  /** 每次变化自增，用来丢弃过期动画的收尾回调。 */
  token: number;
}

/**
 * 单个字位的滚筒。
 *
 * 纸带上依次排「旧字 → 若干随机数字 → 新字」，一次 transform 把它拉过去。
 * 递增向上滚、递减向下滚——反着来读数看着像在倒退。
 * 落位后把纸带收回单帧，否则每个字位会常驻 5 个节点，请求流里成百上千。
 */
export function RollingChar({ char }: { char: string }): ReactElement {
  const stripRef = useRef<HTMLSpanElement>(null);
  const settled = useRef(char);
  const counter = useRef(0);
  const [reel, setReel] = useState<Reel>({ frames: [char], up: true, token: 0 });

  useEffect(() => {
    const from = settled.current;
    if (from === char) return;
    settled.current = char;
    counter.current += 1;

    if (prefersReducedMotion()) {
      setReel({ frames: [char], up: true, token: counter.current });
      return;
    }

    // 只有数字参与的变化才滚随机中间帧。标点、单位、箭头直接对换——
    // 让「ms」滚过一串数字只会显得像出了故障。
    const spins = isDigit(from) || isDigit(char)
      ? Array.from({ length: SPIN_STEPS }, () => DIGITS[Math.floor(Math.random() * 10)])
      : [];
    // 空白 ↔ 数字（辉光管点亮/熄灭）没有大小可言，统一向上滚。
    const up = !isDigit(from) || !isDigit(char) || char >= from;
    const path = [from, ...spins, char];

    setReel({ frames: up ? path : [...path].reverse(), up, token: counter.current });
  }, [char]);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const count = reel.frames.length;
    if (!strip || count < 2) return undefined;

    // 纸带高 = count 格，位移按纸带自身高度取百分比，一格正好 1/count。
    const end = -((count - 1) / count) * 100;
    const [from, to] = reel.up ? [0, end] : [end, 0];

    const animation = strip.animate(
      [{ transform: `translateY(${from}%)` }, { transform: `translateY(${to}%)` }],
      { duration: ROLL_MS, easing: "cubic-bezier(.2, .85, .3, 1)", fill: "forwards" },
    );
    // 收回单帧。cancel 交给下一轮 effect 的清理——它和收帧的 DOM 变更在同一次
    // 提交里同步发生，纸带归零与节点减少同时生效，不会闪。
    animation.onfinish = () => {
      setReel((current) => (current.token === reel.token
        ? { frames: [char], up: current.up, token: current.token }
        : current));
    };
    return () => animation.cancel();
  }, [reel, char]);

  const rolling = reel.frames.length > 1;

  return (
    <span className="reel" data-rolling={rolling ? "" : undefined}>
      <span className="reel-strip" ref={stripRef}>
        {reel.frames.map((frame, index) => (
          <span className="reel-cell" key={index}>
            {frame === " " ? " " : frame}
          </span>
        ))}
      </span>
    </span>
  );
}

interface RollingNumberProps {
  /** 读数文本，逐字位滚到位。 */
  value: string;
  className?: string;
  /** 读数在本应用里默认是等宽的 <code>。 */
  as?: "code" | "strong" | "div" | "span";
  title?: string;
}

/** 读数：每一位都是一个滚筒，变化时滚过随机数字再落位。 */
export function RollingNumber({
  value,
  className,
  as: Tag = "code",
  title,
}: RollingNumberProps): ReactElement {
  return (
    <Tag className={["rolling", className].filter(Boolean).join(" ")} title={title}>
      {/* 读屏软件读整串，别让它一位一位念 */}
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="reel-row">
        {[...value].map((char, index) => (
          <RollingChar key={index} char={char} />
        ))}
      </span>
    </Tag>
  );
}
