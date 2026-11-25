"use client";

/**
 * Moteur de timeline d'animation style GSAP dedie a la vue videoprojecteur /live.
 * Orchestre les courbes cubic-bezier via Web Animations API et requestAnimationFrame
 * avec methodes chainables .fromTo(), .to(), .addLabel(), .play() et .kill().
 */

export interface TweenStyleVars {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  boxShadow?: string;
  filter?: string;
}

export interface TweenOptions {
  duration?: number;
  delay?: number;
  ease?: string;
}

interface ScheduledTween {
  target: HTMLElement;
  fromVars: TweenStyleVars | null;
  toVars: TweenStyleVars;
  durationMs: number;
  startTimeMs: number;
  easing: string;
}

export const GSAP_EASE = {
  power4Out: "cubic-bezier(0.16, 1, 0.3, 1)",
  power3In: "cubic-bezier(0.7, 0, 0.84, 0)",
  backOut: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  expoOut: "cubic-bezier(0.19, 1, 0.22, 1)",
  linear: "linear",
} as const;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildTransformString(vars: TweenStyleVars): string {
  const parts: string[] = [];
  const x = vars.x ?? 0;
  const y = vars.y ?? 0;
  if (vars.x !== undefined || vars.y !== undefined) {
    parts.push(`translate3d(${x}px, ${y}px, 0)`);
  }
  if (vars.scale !== undefined) {
    parts.push(`scale(${vars.scale})`);
  } else if (vars.scaleX !== undefined || vars.scaleY !== undefined) {
    const sx = vars.scaleX ?? 1;
    const sy = vars.scaleY ?? 1;
    parts.push(`scale(${sx}, ${sy})`);
  }
  if (vars.rotate !== undefined) {
    parts.push(`rotate(${vars.rotate}deg)`);
  }
  if (parts.length === 0) {
    return "none";
  }
  return parts.join(" ");
}

function toKeyframe(vars: TweenStyleVars): Keyframe {
  const frame: Keyframe = {};
  if (vars.opacity !== undefined) {
    frame.opacity = vars.opacity;
  }
  if (
    vars.x !== undefined ||
    vars.y !== undefined ||
    vars.scale !== undefined ||
    vars.scaleX !== undefined ||
    vars.scaleY !== undefined ||
    vars.rotate !== undefined
  ) {
    frame.transform = buildTransformString(vars);
  }
  if (vars.boxShadow !== undefined) {
    frame.boxShadow = vars.boxShadow;
  }
  if (vars.filter !== undefined) {
    frame.filter = vars.filter;
  }
  return frame;
}

function readCurrentKeyframe(el: HTMLElement, reference: TweenStyleVars): Keyframe {
  const computed = window.getComputedStyle(el);
  const frame: Keyframe = {};
  if (reference.opacity !== undefined) {
    frame.opacity = Number.parseFloat(computed.opacity) || 1;
  }
  if (
    reference.x !== undefined ||
    reference.y !== undefined ||
    reference.scale !== undefined ||
    reference.scaleX !== undefined ||
    reference.scaleY !== undefined ||
    reference.rotate !== undefined
  ) {
    if (computed.transform === "none") {
      frame.transform = "translate3d(0px, 0px, 0) scale(1)";
    } else {
      frame.transform = computed.transform;
    }
  }
  if (reference.boxShadow !== undefined) {
    frame.boxShadow = computed.boxShadow;
  }
  if (reference.filter !== undefined) {
    frame.filter = computed.filter;
  }
  return frame;
}

export class LiveTimeline {
  private readonly tweens: ScheduledTween[] = [];
  private readonly labels = new Map<string, number>();
  private readonly activeAnimations: Animation[] = [];
  private cursorMs = 0;
  private rafId: number | null = null;
  private completionTimeoutId: number | null = null;
  private killed = false;
  private onCompleteCallback: (() => void) | null = null;

  constructor(options?: { onComplete?: () => void }) {
    if (options?.onComplete !== undefined) {
      this.onCompleteCallback = options.onComplete;
    }
  }

  public addLabel(name: string, timeSeconds?: number): this {
    if (timeSeconds !== undefined) {
      this.labels.set(name, Math.max(0, timeSeconds * 1000));
    } else {
      this.labels.set(name, this.cursorMs);
    }
    return this;
  }

  private resolvePositionMs(position?: number | string): number {
    if (position === undefined) {
      return this.cursorMs;
    }
    if (typeof position === "number") {
      return Math.max(0, position * 1000);
    }
    const labelMs = this.labels.get(position);
    if (labelMs !== undefined) {
      return labelMs;
    }
    if (position.startsWith("+=")) {
      const delta = Number.parseFloat(position.slice(2));
      if (Number.isFinite(delta)) {
        return Math.max(0, this.cursorMs + delta * 1000);
      }
    }
    if (position.startsWith("-=")) {
      const delta = Number.parseFloat(position.slice(2));
      if (Number.isFinite(delta)) {
        return Math.max(0, this.cursorMs - delta * 1000);
      }
    }
    return this.cursorMs;
  }

  public fromTo(
    target: HTMLElement | null,
    fromVars: TweenStyleVars,
    toVars: TweenStyleVars & TweenOptions,
    position?: number | string,
  ): this {
    if (target === null) {
      return this;
    }
    const durationSec = toVars.duration ?? 0.45;
    const delaySec = toVars.delay ?? 0;
    const durationMs = Math.max(16, durationSec * 1000);
    const startTimeMs = this.resolvePositionMs(position) + delaySec * 1000;
    const easing = toVars.ease ?? GSAP_EASE.power4Out;

    this.tweens.push({
      target,
      fromVars,
      toVars,
      durationMs,
      startTimeMs,
      easing,
    });

    this.cursorMs = Math.max(this.cursorMs, startTimeMs + durationMs);
    return this;
  }

  public to(
    target: HTMLElement | null,
    toVars: TweenStyleVars & TweenOptions,
    position?: number | string,
  ): this {
    if (target === null) {
      return this;
    }
    const durationSec = toVars.duration ?? 0.4;
    const delaySec = toVars.delay ?? 0;
    const durationMs = Math.max(16, durationSec * 1000);
    const startTimeMs = this.resolvePositionMs(position) + delaySec * 1000;
    const easing = toVars.ease ?? GSAP_EASE.power4Out;

    this.tweens.push({
      target,
      fromVars: null,
      toVars,
      durationMs,
      startTimeMs,
      easing,
    });

    this.cursorMs = Math.max(this.cursorMs, startTimeMs + durationMs);
    return this;
  }

  public getTotalDurationMs(): number {
    return this.cursorMs;
  }

  public play(): this {
    if (this.killed) {
      return this;
    }

    const reduced = prefersReducedMotion();
    let maxEndMs = this.cursorMs;

    if (reduced) {
      maxEndMs = Math.min(this.cursorMs, 1800);
    }

    for (const tween of this.tweens) {
      if (typeof tween.target.animate !== "function") {
        continue;
      }

      let fromFrame: Keyframe;
      if (tween.fromVars !== null) {
        fromFrame = toKeyframe(tween.fromVars);
      } else {
        fromFrame = readCurrentKeyframe(tween.target, tween.toVars);
      }
      const toFrame = toKeyframe(tween.toVars);

      let duration = tween.durationMs;
      let delay = tween.startTimeMs;
      if (reduced) {
        duration = 16;
        delay = Math.min(tween.startTimeMs, 1200);
      }

      const animation = tween.target.animate([fromFrame, toFrame], {
        duration,
        delay,
        easing: tween.easing,
        fill: "forwards",
      });
      this.activeAnimations.push(animation);
    }

    if (this.onCompleteCallback !== null) {
      const doneCallback = this.onCompleteCallback;
      const startTimestamp = performance.now();

      const tick = (now: number) => {
        if (this.killed) {
          return;
        }
        if (now - startTimestamp >= maxEndMs) {
          doneCallback();
          return;
        }
        this.rafId = window.requestAnimationFrame(tick);
      };

      this.rafId = window.requestAnimationFrame(tick);
      // Filet de securite si l'onglet passe brievement en arriere-plan (throttling rAF)
      this.completionTimeoutId = window.setTimeout(() => {
        if (!this.killed) {
          if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
          }
          doneCallback();
        }
      }, maxEndMs + 120);
    }

    return this;
  }

  public kill(): void {
    this.killed = true;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.completionTimeoutId !== null) {
      window.clearTimeout(this.completionTimeoutId);
      this.completionTimeoutId = null;
    }
    for (const animation of this.activeAnimations) {
      try {
        animation.cancel();
      } catch {
        // Ignore les animations deja liberees
      }
    }
    this.activeAnimations.length = 0;
  }
}

export function gsapTimeline(options?: {
  onComplete?: () => void;
}): LiveTimeline {
  return new LiveTimeline(options);
}

/**
 * Transition fluide a l'entree d'un nouvel ecran dans la rotation /live.
 */
export function animateLiveViewEnter(container: HTMLElement | null): LiveTimeline {
  const tl = gsapTimeline();
  if (container === null) {
    return tl;
  }
  tl.fromTo(
    container,
    { opacity: 0, y: 18, scale: 0.992 },
    { opacity: 1, y: 0, scale: 1, duration: 0.52, ease: GSAP_EASE.power4Out },
    0,
  );
  return tl.play();
}

export interface PopupChoreographyRefs {
  backdrop: HTMLElement | null;
  card: HTMLElement | null;
  badge: HTMLElement | null;
  headline: HTMLElement | null;
  teamRow: HTMLElement | null;
  verdictValue: HTMLElement | null;
  suitsStrip: HTMLElement | null;
  progressBar: HTMLElement | null;
}

/**
 * Choregraphie GSAP complete d'un pop-up temps reel (~4.5 secondes) :
 * - Entree dramatique du voile + carte
 * - Impact elastique sur le badge & valeur de verdict
 * - Lueur semantique (ambre / vert passe / rouge chute)
 * - Decompte fluide sur la barre inferieure
 * - Sortie nette avant de depiler l'evenement FIFO suivant.
 */
export function playLivePopupTimeline(
  refs: PopupChoreographyRefs,
  variant: "announced" | "passed" | "failed",
  onComplete: () => void,
): LiveTimeline {
  let glowShadow = "0 0 0 1px rgba(232,166,40,0.45), 0 24px 70px rgba(232,166,40,0.22)";
  let restingShadow = "0 0 0 1px rgba(232,166,40,0.3), 0 18px 48px rgba(0,0,0,0.55)";
  if (variant === "passed") {
    glowShadow = "0 0 0 2px rgba(56,153,96,0.65), 0 26px 80px rgba(45,125,78,0.36)";
    restingShadow = "0 0 0 1px rgba(56,153,96,0.45), 0 18px 48px rgba(0,0,0,0.55)";
  } else if (variant === "failed") {
    glowShadow = "0 0 0 2px rgba(220,70,61,0.7), 0 26px 80px rgba(200,52,43,0.36)";
    restingShadow = "0 0 0 1px rgba(220,70,61,0.45), 0 18px 48px rgba(0,0,0,0.55)";
  }

  const tl = gsapTimeline({ onComplete });

  // 1. Entree du fond et de la carte principale (0.00s -> 0.48s)
  tl.fromTo(
    refs.backdrop,
    { opacity: 0 },
    { opacity: 1, duration: 0.3, ease: GSAP_EASE.power4Out },
    0,
  )
    .fromTo(
      refs.card,
      { opacity: 0, y: 42, scale: 0.88, boxShadow: restingShadow },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: glowShadow,
        duration: 0.48,
        ease: GSAP_EASE.backOut,
      },
      0.04,
    )
    .fromTo(
      refs.badge,
      { opacity: 0, y: -14, scale: 0.86 },
      { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: GSAP_EASE.backOut },
      0.14,
    )
    .fromTo(
      refs.headline,
      { opacity: 0, y: 20, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: GSAP_EASE.power4Out },
      0.2,
    )
    .fromTo(
      refs.teamRow,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.36, ease: GSAP_EASE.power4Out },
      0.28,
    )
    .fromTo(
      refs.verdictValue,
      { opacity: 0, scale: 0.72 },
      { opacity: 1, scale: 1, duration: 0.42, ease: GSAP_EASE.backOut },
      0.34,
    )
    .fromTo(
      refs.suitsStrip,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.35, ease: GSAP_EASE.power4Out },
      0.36,
    );

  // 2. Pulsation de lueur ambre/verte/rouge a mi-parcours (0.9s -> 3.6s)
  tl.to(
    refs.card,
    { boxShadow: restingShadow, duration: 0.85, ease: GSAP_EASE.power4Out },
    1.0,
  )
    .to(
      refs.card,
      { boxShadow: glowShadow, duration: 0.7, ease: GSAP_EASE.power4Out },
      1.95,
    )
    .to(
      refs.card,
      { boxShadow: restingShadow, duration: 0.7, ease: GSAP_EASE.power4Out },
      2.75,
    );

  // 3. Barre de decompte lineaire sur 4.1s
  tl.fromTo(
    refs.progressBar,
    { scaleX: 1 },
    { scaleX: 0, duration: 4.05, ease: GSAP_EASE.linear },
    0.1,
  );

  // 4. Sortie rapide et propre (4.10s -> 4.50s)
  tl.addLabel("exit", 4.1)
    .to(
      refs.card,
      {
        opacity: 0,
        y: -26,
        scale: 0.94,
        duration: 0.38,
        ease: GSAP_EASE.power3In,
      },
      "exit",
    )
    .to(
      refs.backdrop,
      { opacity: 0, duration: 0.38, ease: GSAP_EASE.power3In },
      "exit",
    );

  return tl.play();
}
