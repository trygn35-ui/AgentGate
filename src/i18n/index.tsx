import { createContext, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { detectLocale, MESSAGES } from "./messages";
import type { Locale, Messages } from "./messages";

export type { Locale, Messages } from "./messages";
export { LOCALE_LABELS, MESSAGES, detectLocale } from "./messages";

/**
 * 把设置里的语言选项解析成具体语言。
 *
 * 控制器 Hook 是 settings 的来源，位于 I18nProvider 之外，拿不到 context——
 * 它用这个函数从自己持有的 settings 直接算出文案。
 */
export function resolveLocale(language: Locale | "system" | undefined): Locale {
  return !language || language === "system" ? detectLocale() : language;
}

/** 插值：把模板里的 {key} 换成对应值。供 context 之外的调用方使用。 */
export function fill(template: string, vars?: Vars): string {
  return fillTemplate(template, vars);
}

/** 插值参数：{name} 占位符对应的值。 */
export type Vars = Record<string, string | number>;

interface I18nValue {
  locale: Locale;
  m: Messages;
  /** 插值：把模板里的 {key} 换成对应值。 */
  fill: (template: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

function fillTemplate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (
    key in vars ? String(vars[key]) : match
  ));
}

interface I18nProviderProps {
  /** 设置中选择的语言；"system" 表示跟随系统。 */
  locale?: Locale | "system";
  children: ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps): ReactElement {
  const value = useMemo<I18nValue>(() => {
    const resolved: Locale = !locale || locale === "system" ? detectLocale() : locale;
    return {
      locale: resolved,
      m: MESSAGES[resolved],
      fill: fillTemplate,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * 读取当前语言的文案。
 *
 * `m` 是扁平的文案对象（编译期类型安全，写错 key 会报错），`fill` 负责插值。
 */
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
