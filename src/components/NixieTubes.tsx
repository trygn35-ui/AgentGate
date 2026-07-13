import type { ReactElement } from "react";
import { useI18n } from "../i18n";
import type { DivergenceTier } from "../lib/divergence";
import { RollingChar } from "./RollingNumber";

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

/**
 * 空管用空格表示，而不是「渲染 0 再涂成透明」。
 *
 * 涂透明的写法让熄灭/点亮变成了纯颜色切换，滚筒无从下手——网关一开一关，
 * 数字就凭空跳出来。用空格之后，熄灭是数字滚出去、点亮是数字滚进来。
 */
const BLANK = " ";

/**
 * 辉光管数字阵列（Divergence Meter）。
 *
 * 三个细节缺一不可，少任何一个就只是「橙色数字」：
 * 1. 幽灵阴极——每管后面叠着极暗的未点亮数字（用 data-ghost 由 CSS 绘制）
 * 2. 阳极栅网——管面的斜向细网格（暗色主题下的 ::after）
 * 3. 小数点独占一管——原作就是这么排的；管子等宽，点只是管里的字符
 */
export function NixieTubes({
  value,
  blankLength = 8,
  tier = "nominal",
  label,
}: NixieTubesProps): ReactElement {
  const { m } = useI18n();
  const chars = value ? [...value] : Array.from({ length: blankLength }, () => BLANK);

  return (
    <div
      className={`tubes ${TIER_CLASS[tier]}`}
      role="img"
      aria-label={label ?? (value ?? m.keys.awaitingSamples)}
    >
      {chars.map((char, index) => (
        <span key={index} className="tube" data-ghost={char === "." ? "." : "8"}>
          <RollingChar char={char} />
        </span>
      ))}
    </div>
  );
}
