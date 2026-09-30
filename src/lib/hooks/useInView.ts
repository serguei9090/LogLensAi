// Assume Role: Frontend Engineer (@frontend)

import { useEffect, useRef, useState } from "react";

interface UseInViewOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  triggerOnce?: boolean;
}

export function useInView<T extends HTMLElement = HTMLElement>(options: UseInViewOptions = {}) {
  const { root = null, rootMargin = "0px", threshold = 0, triggerOnce = true } = options;
  const [inView, setInView] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);

        if (entry.isIntersecting && triggerOnce) {
          observer.unobserve(element);
        }
      },
      { root, rootMargin, threshold },
    );

    observer.observe(element);

    return () => {
      if (element && !triggerOnce) {
        observer.unobserve(element);
      }
    };
  }, [root, rootMargin, threshold, triggerOnce]);

  return [ref, inView] as const;
}
