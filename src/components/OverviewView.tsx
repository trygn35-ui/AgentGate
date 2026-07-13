import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { CLIENT_META, CLIENT_TARGET_ORDER, PROTOCOL_META } from "../config";
import { useI18n } from "../i18n";
import {
  computeDivergence,
  formatDivergence,
  formatRate,
  formatTokenTotal,
  recentCacheRate,
  todayTokenTotal,
} from "../lib/divergence";
import type {
  ActiveRequest,
  ClientStatus,
  ClientTarget,
  GatewayState,
  HealthState,
  Profile,
} from "../types";
import { NixieTubes } from "./NixieTubes";

const HEALTH_DOT: Record<HealthState, string> = {
  healthy: "dot-good",
  limited: "dot-warn",
  unhealthy: "dot-bad",
  unknown: "dot-unknown",
};

interface OverviewViewProps {
  profiles: Profile[];
  clients: ClientStatus[];
  gateway: GatewayState;
  /** 最近一小时的请求记录，用于窗口指标。 */
  requests: ActiveRequest[];
  activeRequestCount: number;
  busy: boolean;
  onApply: (id: string, target: ClientTarget) => void;
  onGoActivity: () => void;
}

/**
 * 概览页：DIVERGENCE METER 与客户端铭牌。
 *
 * 仪表三格各司其职：左边告诉你「该不该换线路」（分歧率），中间「省不省钱」
 * （缓存率），右边「用了多少」（累计 Token）。
 */
export function OverviewView({
  profiles,
  clients,
  gateway,
  requests,
  activeRequestCount,
  busy,
  onApply,
  onGoActivity,
}: OverviewViewProps): ReactElement {
  const { m, fill } = useI18n();
  const [pickerFor, setPickerFor] = useState<ClientTarget>();
  const [flashTarget, setFlashTarget] = useState<ClientTarget>();
  const flashTimer = useRef<number>(undefined);
  const gatewayOn = gateway.status === "running" || gateway.status === "starting";

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  useEffect(() => {
    if (!pickerFor) return undefined;
    function handleKey(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setPickerFor(undefined);
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [pickerFor]);

  function healthTag(profile: Profile): { text: string; className: string } {
    const status = profile.health?.status ?? "unknown";
    if (status === "healthy") return { text: `${profile.health?.latencyMs ?? 0} ms`, className: "tier-good" };
    if (status === "limited") return { text: m.keys.limited, className: "tier-warn" };
    if (status === "unhealthy") return { text: m.keys.down, className: "tier-bad" };
    return { text: "", className: "tier-quiet" };
  }

  function pick(profileId: string, target: ClientTarget): void {
    setPickerFor(undefined);
    onApply(profileId, target);
    setFlashTarget(target);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashTarget(undefined), 500);
  }

  const routeCount = gateway.routes
    .filter((route) => profiles.some((profile) => profile.id === route.profileId))
    .length;
  const divergence = computeDivergence(profiles, gateway);
  const cacheRate = recentCacheRate(requests);
  const tokenToday = todayTokenTotal(profiles);
  const cacheText = formatRate(cacheRate);
  const tokenText = formatTokenTotal(tokenToday);

  const heroTitle = gateway.status === "starting"
    ? m.overview.heroStarting
    : gateway.status === "stopping"
      ? m.overview.heroStopping
      : gateway.status === "error"
        ? m.overview.heroFault
        : gatewayOn ? m.overview.heroOnline : m.overview.heroOffline;
  const heroSub = gateway.status === "error"
    ? gateway.error ?? m.overview.faultHint
    : gatewayOn
      ? fill(m.overview.routesBound, { routes: routeCount, profiles: profiles.length })
      : m.overview.directToUpstream;
  const liveText = activeRequestCount > 0
    ? fill(m.overview.streaming, { count: activeRequestCount })
    : m.overview.idle;

  return (
    <main className="page-scroll" aria-label={m.nav.overview}>
      {pickerFor && (
        <button
          type="button"
          className="overlay-scrim"
          aria-label={m.editor.close}
          onClick={() => setPickerFor(undefined)}
        />
      )}
      <div className="page-inner">
        <section aria-label={m.gateway.online} className="hero rise">
          <h1 key={heroTitle} className="swap-text">{heroTitle}</h1>
          <p>
            <span key={heroSub} className="swap-text">{heroSub}</span>
            <button
              type="button"
              className={`live-link ${activeRequestCount > 0 ? "live" : ""}`}
              onClick={onGoActivity}
            >
              <i />
              <span key={liveText} className="swap-text">{liveText}</span>
              <ArrowRight size={11} />
            </button>
          </p>
        </section>

        <section className="meter rise-1" aria-label={m.overview.divergence}>
          <div className="meter-cell">
            <div className="meter-label">D I V E R G E N C E</div>
            <NixieTubes
              value={divergence ? formatDivergence(divergence.ratio) : undefined}
              tier={divergence?.tier}
              label={divergence
                ? fill(m.overview.baselineOf, {
                  current: divergence.currentMs,
                  baseline: divergence.baselineMs,
                  profile: divergence.profileName,
                })
                : m.overview.awaitingBaseline}
            />
            <div
              className={`meter-sub ${divergence?.tier === "critical"
                ? "tier-bad"
                : divergence?.tier === "diverging" ? "tier-warn" : ""}`}
            >
              {divergence
                ? fill(m.overview.baselineOf, {
                  current: divergence.currentMs,
                  baseline: divergence.baselineMs,
                  profile: divergence.profileName,
                })
                : gatewayOn ? m.overview.awaitingBaseline : m.gateway.offline}
            </div>
          </div>

          <div className="meter-divider" />

          <div className="meter-cell">
            <div className="meter-label">C A C H E &nbsp; H I T</div>
            {/* key 绑定读数：只有数值真的变了才重挂载，播一次滚入动画 */}
            <div
              key={cacheText}
              className={`meter-plain value-swap ${cacheRate === undefined ? "dim" : ""}`}
            >
              {cacheText}
            </div>
            <div className="meter-sub">{fill(m.overview.lastHour, { count: requests.length })}</div>
          </div>

          <div className="meter-divider" />

          <div className="meter-cell">
            <div className="meter-label">T O K E N S</div>
            <div
              key={tokenText}
              className={`meter-plain value-swap ${tokenToday === 0 ? "dim" : ""}`}
            >
              {tokenText}
            </div>
            <div className="meter-sub">{m.overview.todayResets}</div>
          </div>
        </section>

        <section aria-label={m.overview.clients} className="rise-2" style={{ marginTop: 22 }}>
          <div className="section-head">
            <span className="kicker">{m.overview.clients}</span>
            <h2>{m.overview.worldLines}</h2>
            <span className="head-hint">{m.overview.clickToJump}</span>
          </div>
          <div className="socket-grid">
            {CLIENT_TARGET_ORDER.map((target, index) => {
              const client = clients.find((item) => item.target === target);
              const route = gateway.routes.find((item) => item.target === target);
              const profile = route
                ? profiles.find((item) => item.id === route.profileId)
                : undefined;
              const options = profiles.filter((item) => item.targets.includes(target));
              const open = pickerFor === target;
              const cardClass = [
                "socket-card",
                `tone-${CLIENT_META[target].tone}`,
                profile ? "" : "empty",
                open ? "picker-open" : "",
                flashTarget === target ? "flash" : "",
              ].filter(Boolean).join(" ");
              const dotClass = profile
                ? gatewayOn ? HEALTH_DOT[profile.health?.status ?? "unknown"] : "dot-warn"
                : "dot-unknown";
              const detail = client?.drifted
                ? m.overview.externalEdit
                : profile
                  ? profile.baseUrl.replace(/^https?:\/\//, "")
                  : route
                    ? m.overview.profileRemoved
                    : client && !client.installed
                      ? m.overview.clientNotDetected
                      : m.overview.noProfileBound;
              const boundName = profile?.name ?? route?.profileName ?? m.overview.unbound;
              return (
                <div className="socket-cell" key={target}>
                  <button
                    type="button"
                    className={cardClass}
                    style={{ animationDelay: `${80 + index * 45}ms` }}
                    aria-label={fill(m.overview.editToEnable, { client: CLIENT_META[target].label })}
                    aria-expanded={open}
                    onClick={() => setPickerFor(open ? undefined : target)}
                  >
                    <span className="socket-no">{String(index + 1).padStart(2, "0")}</span>
                    <span className="socket-title">
                      <strong>{CLIENT_META[target].label.toUpperCase()}</strong>
                    </span>
                    <span className="socket-profile">
                      <span className="socket-profile-line">
                        <i className={`socket-dot ${dotClass}`} />
                        <strong key={boundName} className="swap-text">{boundName}</strong>
                      </span>
                      <code className={`socket-detail ${client?.drifted ? "warn" : ""}`} title={detail}>
                        {detail}
                      </code>
                    </span>
                  </button>
                  {open && (
                    <div className="picker-menu" role="menu" aria-label={m.overview.worldLines}>
                      {options.length > 0 ? options.map((option) => {
                        const current = route?.profileId === option.id;
                        const tag = current
                          ? { text: m.overview.current, className: "tier-orange" }
                          : healthTag(option);
                        return (
                          <button
                            type="button"
                            role="menuitem"
                            className={`picker-item ${current ? "current" : ""}`}
                            key={option.id}
                            disabled={current || busy}
                            onClick={() => pick(option.id, target)}
                          >
                            <i className={HEALTH_DOT[option.health?.status ?? "unknown"]} />
                            <span style={{ minWidth: 0 }}>
                              <strong>{option.name}</strong>
                              <code>
                                {PROTOCOL_META[option.protocol].short.toUpperCase()} ·{" "}
                                {option.model || m.overview.clientDefault}
                              </code>
                            </span>
                            <small className={tag.className}>{tag.text}</small>
                          </button>
                        );
                      }) : (
                        <button type="button" role="menuitem" className="picker-item" disabled>
                          <i className="dot-unknown" />
                          <span style={{ minWidth: 0 }}>
                            <strong>{m.overview.noCompatibleProfile}</strong>
                            <code>{fill(m.overview.editToEnable, { client: CLIENT_META[target].label })}</code>
                          </span>
                          <small />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
