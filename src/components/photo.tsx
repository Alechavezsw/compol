import Image from "next/image";
import { cn } from "@/lib/utils";

export function Photo({
  src,
  alt,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 768px) 100vw, 50vw"}
      className={cn("object-cover", className)}
      priority={priority}
    />
  );
}

export function Polaroid({
  src,
  alt,
  caption,
  className,
}: {
  src: string;
  alt: string;
  caption: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "bg-[#fffdf8] p-2 pb-7 shadow-[0_18px_40px_-22px_rgba(20,12,40,.55)] ring-1 ring-black/5 dark:bg-[#1a1730] dark:ring-white/10",
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--surface-2)]">
        <Photo src={src} alt={alt} sizes="(max-width: 768px) 50vw, 280px" />
      </div>
      <figcaption className="display mt-3 text-center text-[17px] text-[var(--foreground)]">
        {caption}
      </figcaption>
    </figure>
  );
}
