import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { socialPulse } from "../src/lib/dashboard";
import { computeSocial } from "../src/lib/social/analytics";
import type { SocialPost } from "../src/lib/types";

const TODAY = "2026-11-25";

const post = (id: number, text: string, label: SocialPost["label"], day = TODAY, topics: string[] = []) =>
  ({
    id: `p${id}`,
    text,
    label,
    topics,
    network: "noticias",
    author: null,
    emotion: null,
    sentiment: 0,
    engagement: 0,
    published_at: `${day}T12:00:00-03:00`,
  }) as unknown as SocialPost;

/** Textos sin palabras en común, para que cada uno cuente como una noticia distinta. */
const distinct = (i: number) => `zz${i}aaa qq${i}bbb ww${i}ccc`;

describe("radar en la portada", () => {
  it("cuenta una sola vez la noticia que repiten varios portales", () => {
    const repeated = "Vecinos reclaman por el corte de agua en el barrio sur";
    const posts = [post(1, repeated, "negativo"), post(2, repeated, "negativo"), post(3, repeated, "negativo"), post(4, distinct(4), "positivo")];
    const pulse = socialPulse(posts, TODAY);
    assert.equal(pulse.total, 2);
    assert.equal(pulse.mood, 0);
  });

  it("da el mismo tono y la misma cantidad que la semana del Radar", () => {
    const posts = Array.from({ length: 20 }, (_, i) => post(i, distinct(i), i % 3 === 0 ? "positivo" : "negativo"));
    posts.push(post(99, distinct(99), "positivo", "2026-11-10"));
    const radar = computeSocial(posts, { days: 7 }, TODAY);
    const pulse = socialPulse(posts, TODAY);
    assert.equal(pulse.mood, radar.mood);
    assert.equal(pulse.total, radar.total);
    assert.equal(pulse.total, 20);
  });

  it("avisa cuando la semana viene negativa y nombra el tema más criticado", () => {
    const posts = Array.from({ length: 12 }, (_, i) => post(i, distinct(i), i < 8 ? "negativo" : "neutral", TODAY, [i < 6 ? "Agua" : "Calles"]));
    const [alert] = socialPulse(posts, TODAY).alerts;
    assert.equal(alert.topic, "Agua");
    assert.match(alert.detail, /^8 de 12 notas/);
  });

  it("no avisa con muy pocas notas", () => {
    const posts = Array.from({ length: 5 }, (_, i) => post(i, distinct(i), "negativo"));
    assert.deepEqual(socialPulse(posts, TODAY).alerts, []);
  });
});
