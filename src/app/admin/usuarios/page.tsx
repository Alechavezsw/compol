import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Avatar, EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { toggleUserActiveAction } from "../actions";

export const metadata: Metadata = { title: "Usuarios" };

type Row = Profile & { organizations: { name: string } | null };

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, organizations(name)")
    .order("created_at", { ascending: false });

  const users = (data ?? []) as Row[];

  return (
    <div className="space-y-7">
      <PageHeader
        title="Usuarios"
        description="Todas las cuentas de la plataforma, de la administración central al trabajo de campo."
        actions={<ButtonLink href="/admin/usuarios/nuevo">Nuevo usuario</ButtonLink>}
      />

      {users.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No hay usuarios todavía"
          action={<ButtonLink href="/admin/usuarios/nuevo">Crear usuario</ButtonLink>}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <TableWrap>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>Persona</Th>
                    <Th>Rol</Th>
                    <Th>Organización</Th>
                    <Th>Alta</Th>
                    <Th className="text-right">Acceso</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name} src={u.avatar_url} size={34} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.full_name || "Sin nombre"}</p>
                            <p className="truncate text-xs text-[var(--muted)]">{u.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <RoleBadge role={u.role} />
                      </Td>
                      <Td className="text-[var(--muted)]">
                        {u.organizations?.name ?? (
                          <span className="text-xs italic">Sin organización</span>
                        )}
                      </Td>
                      <Td className="text-[var(--muted)]">{formatDate(u.created_at)}</Td>
                      <Td>
                        <form
                          action={toggleUserActiveAction}
                          className="flex items-center justify-end gap-2"
                        >
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="next" value={String(!u.is_active)} />
                          <Badge tone={u.is_active ? "success" : "danger"}>
                            {u.is_active ? "Activo" : "Bloqueado"}
                          </Badge>
                          <button
                            type="submit"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--primary)] hover:underline"
                          >
                            {u.is_active ? "Bloquear" : "Reactivar"}
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
