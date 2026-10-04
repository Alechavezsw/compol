import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Photo({
  src,
  alt,
  className,
  sizes,
  priority,
  quality = 85,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  quality?: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 768px) 100vw, 50vw"}
      className={cn("object-cover", className)}
      priority={priority}
      quality={quality}
    />
  );
}

export function Polaroid({
  src,
  alt,
  caption,
  className,
  style,
}: {
  src: string;
  alt: string;
  caption: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <figure
      style={style}
      className={cn(
        "group bg-[#fffdf8] p-2 pb-7 shadow-[0_18px_40px_-22px_rgba(20,12,40,.55)] ring-1 ring-black/5 transition-transform duration-500 ease-out hover:-translate-y-3 hover:rotate-0 hover:shadow-[0_28px_54px_-24px_rgba(20,12,40,.6)] dark:bg-[#1a1730] dark:ring-white/10",
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--surface-2)]">
        <Photo
          src={src}
          alt={alt}
          quality={100}
          sizes="(max-width: 768px) 50vw, 280px"
          className="transition-transform duration-700 ease-out group-hover:scale-110"
        />
      </div>
      <figcaption className="display mt-3 text-center text-[17px] text-[var(--foreground)]">
        {caption}
      </figcaption>
    </figure>
  );
}
