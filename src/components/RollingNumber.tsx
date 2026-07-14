import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

const DIGITS = "0123456789";

/**
 * 两次变化间隔小于这个值时走快速单步（里程表式）。
 *
 * 高频小步快滚，低频变化才配整卷慢滚。窗口必须盖住整卷慢滚的最长时长
 * （延迟 ~320 + 时长 ~3300ms），否则周期性变化的值会在慢滚滚到一半时
 * 又触发下一卷，永远停不下来。
 */
const QUICK_WINDOW_MS = 4000;

/** 慢滚要滚过的随机数字位数。位数随机，于是每一位的滚动时长天然不同。 */
const SPIN_MIN = 6;
const SPIN_MAX = 14;

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

/** 数字与空位（辉光管熄灭态）才滚随机数字；标点、单位、箭头只做单步滑动。 */
function canSpin(from: string, to: string): boolean {
  const digitish = (c: string) => isDigit(c) || c === " ";
  return digitish(from) && digitish(to) && (isDigit(from) || isDigit(to));
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function randomDigit(): string {
  return DIGITS[Math.floor(Math.random() * 10)];
}

interface Reel {
  /** 纸带上的字符，自上而下。 */
  frames: string[];
  /** 窗口的起始格与最终停靠格。 */
  fromIndex: number;
  targetIndex: number;
  /** 整卷慢滚（带回弹与动态模糊）还是单步快滚。 */
  spin: boolean;
  duration: number;
  delay: number;
  /** 每次变化自增，用来丢弃过期动画的收尾回调。 */
  token: number;
}

/**
 * 单个字位的滚筒。
 *
 * 每次变化随机决定向上还是向下滚，随机滚过若干中间数字，时长与起步延迟
 * 也各自随机——同一读数里的各位不齐步，先后落定。落位是一条纯粹的减速
 * 曲线，速度渐近归零；辉光管没有机械结构，不冲头、不回弹。
 *
 * 落位后把纸带收回单帧，否则每个字位会常驻十几个节点，请求流里成百上千。
 */
export function RollingChar({ char, ticker, rollIn }: {
  char: string;
  ticker?: boolean;
  /** 挂载时从空位滚进来（读数变长、新冒出来的位），而不是凭空蹦出。 */
  rollIn?: boolean;
}): ReactElement {
  const stripRef = useRef<HTMLSpanElement>(null);
  const settled = useRef(rollIn ? " " : char);
  const lastChange = useRef(0);
  const counter = useRef(0);
  const [reel, setReel] = useState<Reel>({
    // rollIn 时首帧画空位，随后 effect 把字滚进来；直接画 char 会先闪一下终态
    frames: [rollIn ? " " : char],
    fromIndex: 0,
    targetIndex: 0,
    spin: false,
    duration: 0,
    delay: 0,
    token: 0,
  });

  useEffect(() => {
    const from = settled.current;
    if (from === char) return;
    settled.current = char;
    counter.current += 1;
    const token = counter.current;

    if (prefersReducedMotion()) {
      setReel({ frames: [char], fromIndex: 0, targetIndex: 0, spin: false, duration: 0, delay: 0, token });
      return;
    }

    const now = Date.now();
    // 空位 ↔ 数字只发生在网关开关这类用户亲手扳的动作上，永远值得整卷慢滚；
    // 否则快速开关时第二次变化会落进快滚窗口，动画被降级成一步小滑。
    const blankShift = (from === " " || char === " ") && canSpin(from, char);
    // 秒表类读数（ticker）连空位滚进都走快步——跳表跨过 1:00 时新冒出的分位
    // 要是慢滚三秒，旁边的秒位早跳了十下。
    const quick = ticker
      || (!blankShift && (now - lastChange.current < QUICK_WINDOW_MS || !canSpin(from, char)));
    lastChange.current = now;

    if (quick) {
      // 里程表式单步。方向固定向上——高频跳动再随机方向就成抽搐了。
      // 时长必须小于动态页 300ms 的跳动周期，否则每跳都把上一步掐断。
      setReel({
        frames: [from, char],
        fromIndex: 0,
        targetIndex: 1,
        spin: false,
        duration: 220 + Math.random() * 60,
        delay: 0,
        token,
      });
      return;
    }

    const up = Math.random() < 0.5;
    const steps = SPIN_MIN + Math.floor(Math.random() * (SPIN_MAX - SPIN_MIN + 1));
    const mid = Array.from({ length: steps }, randomDigit);

    setReel({
      // 向上滚：新字从下方来，纸带顺排；向下滚：新字从上方来，纸带倒排
      frames: up ? [from, ...mid, char] : [char, ...mid, from],
      fromIndex: up ? 0 : steps + 1,
      targetIndex: up ? steps + 1 : 0,
      spin: true,
      // 2.1–3.4s：这不是给赶时间的人看的仪表，慢滚本身就是内容
      duration: 1400 + steps * 110 + Math.random() * 400,
      delay: Math.random() * 320,
      token,
    });
  }, [char, ticker]);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const count = reel.frames.length;
    if (!strip || count < 2) return undefined;

    const cell = 100 / count;
    const ty = (index: number) => `translateY(${-(index * cell)}%)`;

    const move = strip.animate(
      [
        // 一条纯粹的减速曲线：前段疾速掠过中间数字，速度渐近归零、滑进停靠格
        // 就停。辉光管是气体放电管，没有机械结构——不冲头、不回弹。
        {
          transform: ty(reel.fromIndex),
          easing: reel.spin ? "cubic-bezier(.12, .55, .12, 1)" : "cubic-bezier(.2, .9, .3, 1)",
        },
        { transform: ty(reel.targetIndex) },
      ],
      { duration: reel.duration, delay: reel.delay, fill: "both" },
    );

    // 动态模糊只给慢滚：起步最快时最糊，随减速一路变清
    const blur = reel.spin
      ? strip.animate(
        [
          { filter: "blur(0px)" },
          { filter: "blur(1.6px)", offset: .12 },
          { filter: "blur(.6px)", offset: .45 },
          { filter: "blur(0px)", offset: .8 },
          { filter: "blur(0px)" },
        ],
        { duration: reel.duration, delay: reel.delay, fill: "both" },
      )
      : undefined;

    // 收回单帧。cancel 交给下一轮 effect 的清理——它和收帧的 DOM 变更在同一次
    // 提交里同步发生，纸带归零与节点减少同时生效，不会闪。
    move.onfinish = () => {
      setReel((current) => (current.token === reel.token
        ? { ...current, frames: [char], fromIndex: 0, targetIndex: 0, spin: false }
        : current));
    };
    return () => {
      move.cancel();
      blur?.cancel();
    };
  }, [reel, char]);

  const rolling = reel.frames.length > 1;
  // 辉光管的点火辉光跟滚动同长（见 CSS 的 --roll-ms）
  const style = rolling
    ? { "--roll-ms": `${Math.round(reel.delay + reel.duration)}ms` } as CSSProperties
    : undefined;

  /*
   * 停下来就收成一个字。
   *
   * 纸带那三层 span 只有滚动时才需要。一直留着的话，动态页 50 行 × 7 个读数
   * ≈ 1790 个字位 × 3 层 = 五千多个节点；更要命的是每条纸带都带
   * will-change: transform——一千七百多个合成层常驻显存。实测：一行 152 个
   * 节点里有 132 个是滚筒（87%）。而已完成的请求，数字永远不会再变。
   */
  if (!rolling) {
    const settled = reel.frames[0];
    return <span className="reel">{settled === " " ? " " : settled}</span>;
  }

  return (
    <span className="reel" data-rolling="" style={style}>
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
  /** 秒表类持续跳动的读数：永远走里程表式快滚，不玩老虎机。 */
  ticker?: boolean;
  title?: string;
}

/** 读数：每一位都是一个滚筒，变化时随机上下滚过一串数字，先后落定。 */
export function RollingNumber({
  value,
  className,
  as: Tag = "code",
  title,
  ticker,
}: RollingNumberProps): ReactElement {
  // 首次挂载（切页面、换语言）读数直接呈现；之后新冒出来的位才滚进来
  const seasoned = useRef(false);
  useEffect(() => {
    seasoned.current = true;
  }, []);
  const chars = [...value];
  return (
    <Tag className={["rolling", className].filter(Boolean).join(" ")} title={title}>
      {/* 读屏软件读整串，别让它一位一位念 */}
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="reel-row">
        {chars.map((char, index) => (
          <RollingChar
            /*
             * 从右端对齐，像里程表：个位永远是个位。
             *
             * 用从左数的 index 做 key 的话，读数变长（999 987 → 1 000 123）
             * 时所有字符集体错一位，没变的数字也会跟着重滚一遍。
             */
            key={index - chars.length}
            char={char}
            ticker={ticker}
            rollIn={seasoned.current}
          />
        ))}
      </span>
    </Tag>
  );
}
