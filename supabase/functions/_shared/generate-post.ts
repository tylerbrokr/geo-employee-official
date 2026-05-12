// Shared post generator used by autopilot-generate (nightly batch) and
// autopilot-tick (hourly fallback when buffer is empty).

const SYSTEM_PROMPT = `You are a real estate agent writing a direct, first-person answer to a question someone asked an AI assistant. Your job is to be the source the AI cites.

Rules:
- The first 2 sentences must directly answer the question. No throat-clearing, no preamble.
- Write as the agent in first person. Name yourself, your brokerage, and the place repeatedly and naturally.
- Cover every talking point with a short H2 section.
- Mention specific neighborhoods, school districts, price bands, and recent local context where relevant.
- End with a "How to reach me" section that lists the agent's name, brokerage, address, and phone in plain text. Do not write contact-form language.
- 700 to 900 words. No fluff, no hedging, no emojis, no em dashes.
- Do not mention "SEO," "keywords," "search engines," or "AI." Just answer the question.

Return JSON only: { "title", "slug" (kebab-case), "tag", "excerpt" (140-180 chars), "body" (markdown) }`;

export async function generateOne(admin: any, apiKey: string, client_id: string, topic: any) {
  const [{ data: client }, { data: market }] = await Promise.all([
    admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
    admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
  ]);
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", client.owner_user_id).maybeSingle();

  const napLines: string[] = [];
  if (client.street_address) napLines.push(client.street_address);
  const cityLine = [client.city, client.state].filter(Boolean).join(", ");
  if (cityLine || client.postal_code) napLines.push([cityLine, client.postal_code].filter(Boolean).join(" "));
  if (client.phone_e164) napLines.push(`Phone: ${client.phone_e164}`);
  const nap = napLines.length ? napLines.join("\n") : "(no address on file — omit the address line)";

  const userPrompt = `
Write the post.

Question to answer (this is the post title): ${topic.title}
Geographic focus: ${topic.geo_scope ?? market?.primary_city ?? "—"}
Talking points to cover (one short H2 per bullet):
${(topic.talking_points ?? []).map((b: string) => `- ${b}`).join("\n") || "- (none, use your judgment)"}
Suggested H2 outline (refine wording as needed):
${(topic.h2s ?? []).map((h: string) => `- ${h}`).join("\n") || "- (none)"}
Target word count: ${topic.word_count ?? 800}

Agent identity (use repeatedly and naturally):
- Name: ${profile?.full_name ?? "the agent"}
- Brokerage: ${client.brokerage ?? "—"}
- Years in business: ${client.years_experience ?? "—"}
- Voice: ${client.voice ?? "professional and warm"}
- Differentiators: ${client.differentiators ?? "—"}
- Ideal client: ${client.ideal_client ?? "—"}

Primary market: ${market?.primary_city ?? "—"}, ${market?.primary_state ?? "—"}
Cities I work: ${(market?.cities ?? []).join(", ") || "—"}
Neighborhoods I work: ${(market?.neighborhoods ?? []).join(", ") || "—"}
Counties I work: ${(market?.counties ?? []).join(", ") || "—"}

NAP block to include verbatim in the "How to reach me" section:
${profile?.full_name ?? ""}
${client.brokerage ?? ""}
${nap}

Return JSON only: { "title", "slug" (kebab-case), "tag", "excerpt" (140-180 chars), "body" (markdown) }
`.trim();

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!aiRes.ok) throw new Error(`AI error: ${await aiRes.text()}`);
  const aiJson = await aiRes.json();
  const content = aiJson.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(content); } catch { parsed = {}; }

  const title = parsed.title ?? topic.title;
  const slug = (parsed.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).slice(0, 80);
  const body = parsed.body ?? "";
  const tag = parsed.tag ?? "Local Discovery";
  const excerpt = parsed.excerpt ?? null;

  const { data: inserted, error: insErr } = await admin.from("posts").insert({
    client_id,
    topic_id: topic.id,
    title, slug, body, tag, excerpt,
    target_keyword: topic.primary_keyword ?? title,
    status: "scheduled",
  }).select().single();
  if (insErr) throw insErr;

  await admin.from("client_topics").update({ status: "used", used_at: new Date().toISOString() }).eq("id", topic.id);
  return inserted;
}
