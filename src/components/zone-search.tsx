"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { searchZones } from "@/lib/san-juan-zones";
import { cn } from "@/lib/utils";

export function ZoneSearch({
  value,
  onChange,
  recents = [],
  placeholder = "Escribí 3 letras…",
}: {
  value: string;
  onChange: (zone: string) => void;
  recents?: string[];
  placeholder?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => searchZones(value, recents), [value, recents]);
  const showList = open && value.trim().length >= 3 && matches.length > 0;

  useEffect(() => {
    setActive(0);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function pick(zone: string) {
    onChange(zone);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        role="combobox"
        aria-label="Zona del relevamiento"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        onFocus={(event) => {
          event.currentTarget.select();
          setOpen(true);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!showList) {
            if (event.key === "Escape") setOpen(false);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            pick(matches[active] ?? value);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--primary)_16%,transparent)] focus:outline-none"
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-card)]"
        >
          {matches.map((zone, i) => (
            <li key={zone} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(zone)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm",
                  i === active
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--foreground)] hover:bg-[var(--surface-2)]",
                )}
              >
                <MapPin className="size-3.5 shrink-0 opacity-70" />
                <span>{zone}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : open && value.trim().length > 0 && value.trim().length < 3 ? (
        <p className="absolute z-20 mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-xs text-[var(--muted)] shadow-[var(--shadow-card)]">
          Seguí escribiendo: la búsqueda arranca a las 3 letras.
        </p>
      ) : null}
    </div>
  );
}
