import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useI18n } from "../i18n";
import type { DivergenceTier } from "../lib/divergence";

interface NixieTubesProps {
  /** 要显示的数字串，可含小数点；undefined 表示无数据（全管留空）。 */
  value?: string;
  /** 无数据时的管位数，用于渲染空管阵列。 */
  blankLength?: number;
  tier?: DivergenceTier;
  label?: string;
}

const TIER_CLASS: Record<DivergenceTier, string> = {
  nominal: "",
  diverging: "warn",
  critical: "bad",
};

/** 与 CSS 的 tube-roll 动画时长保持一致。 */
const ROLL_MS = 340;

/**
 * 单管：数字变化时旧字符向上滚出、新字符从下方滚入，并伴一次点火辉光。
 *
 * 保留旧字符是为了让两者在同一管内交错——纯 CSS 做不到，React 卸载旧节点太快。
 */
function Tube({ char, blank }: { char: string; blank: boolean }): ReactElement {
  const isDot = char === ".";
  const [previous, setPrevious] = useState<string>();
  const last = useRef(char);

  useEffect(() => {
    if (last.current === char) return undefined;
    setPrevious(last.current);
    last.current = char;
    const timer = window.setTimeout(() => setPrevious(undefined), ROLL_MS);
    return () => window.clearTimeout(timer);
  }, [char]);

  const className = ["tube", isDot ? "dot" : "", blank ? "blank" : ""].filter(Boolean).join(" ");

  return (
    <span className={className} aria-hidden="true" data-ghost={isDot ? "." : "8"}>
      {previous !== undefined && (
        <b key={`out-${previous}`} className="tube-glyph out">{previous}</b>
      )}
      <b key={`in-${char}`} className="tube-glyph in">{char}</b>
    </span>
  );
}

/**
 * 辉光管数字阵列（Divergence Meter）。
 *
 * 三个细节缺一不可，少任何一个就只是「橙色数字」：
 * 1. 幽灵阴极——每管后面叠着极暗的未点亮数字（用 data-ghost 由 CSS 绘制）
 * 2. 阳极栅网——管面的斜向细网格（暗色主题下的 ::after）
 * 3. 小数点独占一管——原作就是这么排的
 *
 * 无数据时全管留空，对应原作分歧仪无法显示负值时首位留空的约定。
 */
export function NixieTubes({
  value,
  blankLength = 8,
  tier = "nominal",
  label,
}: NixieTubesProps): ReactElement {
  const { m } = useI18n();
  const chars = value ? [...value] : Array.from({ length: blankLength }, () => "0");
  const blank = !value;

  return (
    <div
      className={`tubes ${TIER_CLASS[tier]}`}
      role="img"
      aria-label={label ?? (value ?? m.keys.awaitingSamples)}
    >
      {chars.map((char, index) => (
        <Tube key={index} char={char} blank={blank} />
      ))}
    </div>
  );
}
