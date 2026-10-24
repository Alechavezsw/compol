import { Building2, GraduationCap, Handshake, BriefcaseBusiness } from "lucide-react";
import { orgBrandColor } from "@/lib/org-visual";
import type { OrgType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  gobierno: Building2,
  institucion: GraduationCap,
  ong: Handshake,
  privado: BriefcaseBusiness,
} as const;

export function OrgMark({
  type,
  brandColor,
  name,
  id,
  size = "md",
  className,
}: {
  type: OrgType;
  brandColor?: string | null;
  name?: string;
  id?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const color = orgBrandColor({ brand_color: brandColor, type, name, id });
  const Icon = TYPE_ICON[type];
  const box = size === "sm" ? "size-8 rounded-lg" : size === "lg" ? "size-14 rounded-2xl" : "size-10 rounded-xl";
  const icon = size === "sm" ? "size-3.5" : size === "lg" ? "size-6" : "size-4";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-white shadow-[0_8px_18px_-12px_rgba(15,23,42,0.55)]",
        box,
        className,
      )}
      style={{
        background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 72%, #0f172a))`,
      }}
      title={type}
      aria-hidden
    >
      <Icon className={icon} strokeWidth={2.25} />
    </span>
  );
}
