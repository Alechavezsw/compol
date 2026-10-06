"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SWATCHES = [
  { hex: "#3d2de0", name: "Violeta" },
  { hex: "#7c3aed", name: "Lila" },
  { hex: "#0ea5a4", name: "Turquesa" },
  { hex: "#0284c7", name: "Azul" },
  { hex: "#16a34a", name: "Verde" },
  { hex: "#ca8a04", name: "Oro" },
  { hex: "#ea580c", name: "Naranja" },
  { hex: "#e11d48", name: "Rosa" },
  { hex: "#334155", name: "Pizarra" },
] as const;

export function ColorPalette({
  name = "color",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const initial = /^#[0-9a-f]{6}$/i.test(defaultValue) ? defaultValue.toLowerCase() : "";
  const [value, setValue] = useState(initial);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setValue("")}
          aria-pressed={!value}
          className={cn(
            "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
            !value
              ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)]",
          )}
        >
          Sin color
        </button>
        {SWATCHES.map((swatch) => {
          const selected = value === swatch.hex;
          return (
            <button
              key={swatch.hex}
              type="button"
              onClick={() => setValue(swatch.hex)}
              aria-label={swatch.name}
              aria-pressed={selected}
              title={swatch.name}
              className={cn(
                "size-8 rounded-full border-2 transition-transform hover:scale-110",
                selected ? "border-[var(--foreground)] shadow-md" : "border-white/70",
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
