import { useRef, useEffect, type RefObject, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type AnimationPreset = "fadeUp" | "fadeDown" | "fadeLeft" | "fadeRight" | "scaleIn" | "rotateIn" | "blurIn";

interface ScrollAnimationOptions {
  preset?: AnimationPreset;
  delay?: number;
  duration?: number;
  start?: string;
  stagger?: number;
  children?: boolean;
}

const presets: Record<AnimationPreset, gsap.TweenVars> = {
  fadeUp: { opacity: 0, y: 60 },
  fadeDown: { opacity: 0, y: -60 },
  fadeLeft: { opacity: 0, x: -60 },
  fadeRight: { opacity: 0, x: 60 },
  scaleIn: { opacity: 0, scale: 0.85 },
  rotateIn: { opacity: 0, rotate: -5, y: 40 },
  blurIn: { opacity: 0, filter: "blur(10px)", y: 30 },
};

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const {
    preset = "fadeUp",
    delay = 0,
    duration = 0.8,
    start = "top 85%",
    stagger = 0,
    children = false,
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = children ? el.children : el;
    const fromVars = presets[preset];

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        ...fromVars,
        duration,
        delay,
        stagger: stagger || 0,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start,
          toggleActions: "play none none none",
        },
      });
    }, el);

    return () => ctx.revert();
  }, [preset, delay, duration, start, stagger, children]);

  return ref;
}

export function useParallax<T extends HTMLElement = HTMLDivElement>(
  speed: number = 0.3
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: speed * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [speed]);

  return ref;
}

export function useCountUp(
  end: number,
  duration: number = 2
): [RefObject<HTMLElement | null>, () => void] {
  const ref = useRef<HTMLElement | null>(null);

  const trigger = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(
      el,
      { innerText: "0" },
      {
        innerText: end,
        duration,
        ease: "power2.out",
        snap: { innerText: 1 },
        onUpdate() {
          if (el) el.innerText = String(Math.round(Number(el.innerText)));
        },
      }
    );
  }, [end, duration]);

  return [ref, trigger];
}

export function useMagneticHover<T extends HTMLElement = HTMLDivElement>(
  strength: number = 0.3
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, {
        x: x * strength,
        y: y * strength,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    const handleLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);

    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [strength]);

  return ref;
}
