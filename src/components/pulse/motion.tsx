"use client";

import { useEffect, useRef, useState } from "react";
import { signed } from "@/lib/pulse";
import { formatNumber } from "@/lib/utils";

/** Número que cuenta desde el valor anterior hasta el nuevo cuando cambia un filtro. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 350;
    let frame = 0;
    let begin: number | null = null;
    const tick = (now: number) => {
      begin ??= now;
      const t = duration ? Math.min(1, (now - begin) / duration) : 1;
      const current = start + (value - start) * (1 - Math.pow(1 - t, 3));
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Si el navegador no está dibujando cuadros, la cifra igual tiene que quedar al día.
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      from.current = value;
      setShown(value);
    }, duration + 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [value]);

  return <>{format(shown)}</>;
}

const FORMATS = {
  entero: (n: number) => formatNumber(Math.round(n)),
  saldo: signed,
  decimal: (n: number) => n.toFixed(1).replace(".", ","),
  porcentaje: (n: number) => `${n.toFixed(1).replace(".", ",")}%`,
};

/** Igual que `CountUp`, para usar desde el servidor: el formato se elige por nombre. */
export function AnimatedNumber({ value, as = "entero" }: { value: number; as?: keyof typeof FORMATS }) {
  return <CountUp value={value} format={FORMATS[as]} />;
}
