import type { ReactElement } from "react";
import { useI18n } from "../i18n";
import type { GatewayState } from "../types";

interface GatewaySwitchProps {
  gateway: GatewayState;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * 顶栏网关开关：胶囊形态的 role=switch，含状态点、文字和拨杆。
 *
 * starting/stopping 显示过渡状态；error 时点击执行恢复并关闭。
 */
export function GatewaySwitch({ gateway, busy, onStart, onStop }: GatewaySwitchProps): ReactElement {
  const { m } = useI18n();
  const enabled = gateway.status === "running" || gateway.status === "starting";
  const transitioning = gateway.status === "starting" || gateway.status === "stopping";
  const needsRecovery = gateway.status === "error" && gateway.routes.length > 0;
  const statusLabel: Record<GatewayState["status"], string> = {
    stopped: m.overview.heroOffline,
    starting: m.overview.heroStarting,
    running: m.overview.heroOnline,
    stopping: m.overview.heroStopping,
    error: m.overview.heroFault,
  };
  const actionLabel = needsRecovery
    ? m.gateway.recover
    : enabled ? m.gateway.toggleOff : m.gateway.toggleOn;
  const text = transitioning
    ? m.gateway.syncing
    : gateway.status === "error"
      ? m.gateway.fault
      : enabled ? m.gateway.online : m.gateway.offline;
  const className = [
    "gateway-switch",
    enabled ? "on" : "",
    transitioning ? "busy" : "",
    gateway.status === "error" ? "error" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={className}
      role="switch"
      aria-checked={enabled}
      aria-label={actionLabel}
      title={gateway.error
        ? `${statusLabel[gateway.status]}: ${gateway.error}`
        : m.gateway.hint}
      disabled={busy}
      onClick={() => {
        if (enabled || needsRecovery) onStop();
        else onStart();
      }}
    >
      <i className="gateway-dot" />
      {/* key 变化时重挂载，触发 CSS 的文字切换动画 */}
      <strong key={text} className="swap-text">{text}</strong>
    </button>
  );
}
