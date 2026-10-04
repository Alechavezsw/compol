"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function ModulesRail({ count, children }: { count: number; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const card = el.firstElementChild as HTMLElement | null;
      if (!card) return;
      const step = card.offsetWidth + 16;
      setIndex(Math.round(el.scrollLeft / step));
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const atStart = el.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 && event.deltaY > 0;
      if (atStart || atEnd) return;
      event.preventDefault();
      el.scrollBy({ left: event.deltaY });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  function go(dir: -1 | 1) {
    const el = scroller.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.offsetWidth + 16), behavior: "smooth" });
  }

  return (
    <div>
      <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4 px-4 sm:px-6">
        <p className="text-sm text-white/45">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Módulo anterior"
            className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/6 text-white transition-colors hover:bg-white/14 disabled:opacity-30"
            disabled={index <= 0}
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Módulo siguiente"
            className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/6 text-white transition-colors hover:bg-white/14 disabled:opacity-30"
            disabled={index >= count - 1}
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{
          paddingLeft: "max(1rem, calc((100vw - 72rem) / 2 + 1.5rem))",
          paddingRight: "max(1rem, calc((100vw - 72rem) / 2 + 1.5rem))",
          scrollPaddingLeft: "max(1rem, calc((100vw - 72rem) / 2 + 1.5rem))",
        }}
      >
        {children}
      </div>
    </div>
  );
}
