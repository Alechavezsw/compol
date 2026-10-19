import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { classifyText } from "@/lib/social/lexicon";
import type { SocialPost, SocialTracker } from "@/lib/types";

/**
 * Etiqueta con el léxico las notas que todavía no tienen tema y guarda el
 * resultado. Vive acá y no en `actions.ts`: todo lo que se exporta desde un
 * archivo "use server" queda expuesto como endpoint.
 */
export async function persistMissingTopics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  posts: SocialPost[],
  trackers: SocialTracker[],
) {
  const out = posts.map((p) => {
    if (p.topics.length) return p;
    const local = classifyText(p.text, trackers);
    return {
      ...p,
      topics: local.topics,
      sentiment: local.sentiment,
      label: local.label,
      emotion: local.emotion,
      classified_by: "lexico",
    };
  });
  const changed = out.filter((p, i) => p.topics.length > 0 && posts[i].topics.length === 0);
  await Promise.all(
    changed.map((p) =>
      supabase
        .from("social_posts")
        .update({
          topics: p.topics,
          sentiment: p.sentiment,
          label: p.label,
          emotion: p.emotion,
          classified_by: "lexico",
        })
        .eq("id", p.id)
        .eq("organization_id", organizationId),
    ),
  );
  return out;
}
