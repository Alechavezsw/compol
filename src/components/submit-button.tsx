"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const { disabled, ...rest } = props;
  return (
    <Button type="submit" disabled={pending || disabled} {...rest}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
