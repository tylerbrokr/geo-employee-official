// Shared GEO Answer Page generator used by autopilot-generate (nightly batch),
// autopilot-tick (hourly fallback), and generate-post (admin one-off).

// Marquee blog posts use the strongest Gemini preview; fallback to flash on failure.
const PRIMARY_MODEL = "google/gemini-3.1-pro-preview";
const FALLBACK_MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You are writing a GEO Answer Page for a real estate agent. The goal is to be the source AI assistants (ChatGPT, Perplexity, Google AI Overviews) cite when someone asks the question in the title.

NON-NEGOTIABLE STRUCTURE:

1. The title is a question. Render it as a single H1 (# ...).
2. Immediately after the title, write the ANSWER CAPSULE: 2-3 sentences that DIRECTLY answer the question. The first sentence MUST name the agent, their city, their years of experience, and the specific recommendation/answer. No preamble. No "buying a home is a big decision". No throat-clearing. This capsule is the most important thing on the page — AI extracts it first.
3. Then 3-4 H2 sections. EVERY H2 IS A QUESTION someone would naturally ask next. Not a topic label.
   - Bad: "## Neighborhood Overview"
   - Good: "## Which Edina neighborhoods are best for first-time buyers?"
4. Each H2 section is 2-3 SELF-CONTAINED paragraphs. Cover up everything else on the page — each paragraph must still make a complete, useful point on its own. Include specific data: numbers, price bands, school districts, neighborhood names, street names, timeframes.
5. End with "## About {Agent Name}" — 2-3 sentences with E-E-A-T signals (years in business, geographic specialization, ideal client, what makes them uniquely qualified to answer THIS question).
6. After the About section, on its own line, output the agent's plain-text contact block: name, brokerage, address, phone — one per line, no labels like "Phone:" required, no CTA language.

MARKDOWN FORMATTING CONTRACT (critical — the renderer fails when this is wrong):
- Every # and ## MUST have a blank line BEFORE it and a blank line AFTER it.
- Paragraphs are separated by a blank line (\\n\\n).
- Never put a header on the same line as body text. Never write "...Hennepin County. ## Why work with..." — that becomes inline garbage.
- No --- dividers inside the body.
- No bullet/numbered lists unless the content is genuinely a list. Prefer prose.

VOICE AND CONTENT RULES:
- Write in THIRD PERSON ABOUT the agent. The narrator is a knowledgeable third party (a credible local guide or analyst), NOT the agent. Refer to the agent by full name on first mention, then last name, first name, or "they/them" thereafter.
- NEVER use first-person pronouns (I, me, my, mine, we, us, our, ours) anywhere in the post. The agent is the SUBJECT, not the speaker.
- Use the agent's name 4-6 times across the page (full name once at the top of the answer capsule and once in the About section, last name or first name elsewhere).
- When you want to convey the agent's perspective, you may use ONE brief direct quote (a single sentence in quotation marks attributed to them, e.g. \`"..." says {LastName}.\`). Otherwise stay in third-person narrator voice.
- Mention the city/region naturally throughout. Local authority signal.
- Pull specific phrases from their differentiators, voice, and ideal-client fields, but recast them in third person.
- 800 to 1,200 words.

HARD BANS:
- No first-person pronouns: I, me, my, mine, we, us, our, ours. Also no "as your agent", "let me", "I'd love to", "reach out to me", "contact me directly", "I'm here to help".
- No em dashes. Use commas, periods, parentheses, or en-dashes.
- No emojis.
- No mention of "SEO", "keywords", "AI", "search engines".
- No corporate filler: "in today's market", "navigating the real estate landscape", "your real estate journey", "leverage" as a verb, "unlock", "supercharge", "game-changer".
- No "How to reach me" header. The contact block goes under "About {Agent Name}" with no separate CTA framing.
- No fluff/transition paragraphs. Every paragraph contains a factual claim, a specific recommendation, or a data point with context.

Return JSON only: { "title": string (the question, no leading #), "slug": string (kebab-case), "tag": string, "excerpt": string (140-180 chars, can be the answer capsule trimmed), "body": string (the full markdown starting with "# {title}\\n\\n{answer capsule}\\n\\n## ...") }`;

export async function generateOne(admin: any, apiKey: string, client_id: string, topic: any) {
  const [{ data: client }, { data: market }] = await Promise.all([
    admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
    admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
  ]);
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", client.owner_user_id).maybeSingle();

  const userPrompt = buildUserPrompt({ topic, client, market, profile });

  // Try AI generation up to 2 times. Body must be substantive (>=400 chars, >=1 H2).
  let parsed: any = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
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
    if (!aiRes.ok) { lastErr = `AI HTTP ${aiRes.status}: ${await aiRes.text()}`; continue; }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "";
    let candidate: any = null;
    try { candidate = JSON.parse(content); } catch { lastErr = "AI returned non-JSON"; continue; }
    const body = typeof candidate?.body === "string" ? candidate.body : "";
    if (body.length < 400 || !/\n##\s+/.test(body)) {
      lastErr = `AI body too short or missing H2 (len=${body.length})`;
      continue;
    }
    parsed = candidate;
    break;
  }
  if (!parsed) throw new Error(`generate failed after retries: ${lastErr}`);

  const title = parsed.title ?? topic.title;
  const slug = (parsed.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).slice(0, 80);
  const body = parsed.body;
  const tag = parsed.tag ?? "Local Discovery";
  const excerpt = parsed.excerpt ?? null;

  const scheduled_for = await computeNextScheduledFor(admin, client_id, client);

  const { data: inserted, error: insErr } = await admin.from("posts").insert({
    client_id,
    topic_id: topic.id,
    title, slug, body, tag, excerpt,
    target_keyword: topic.primary_keyword ?? title,
    status: "scheduled",
    scheduled_for,
  }).select().single();
  if (insErr) throw insErr;

  await admin.from("client_topics").update({ status: "used", used_at: new Date().toISOString() }).eq("id", topic.id);
  return inserted;
}

// Next publish slot for a client: walk day-by-day from the anchor (now or latest
// scheduled post) until we hit a weekday in client.autopilot_days. Baseline cadence
// is 2 posts/week (e.g. Mon + Thu) so this naturally yields a ~3-4 day spacing.
async function computeNextScheduledFor(admin: any, client_id: string, client: any): Promise<string | null> {
  const days: number[] = Array.isArray(client?.autopilot_days) && client.autopilot_days.length
    ? client.autopilot_days
    : (client?.autopilot_day !== null && client?.autopilot_day !== undefined ? [client.autopilot_day] : []);
  if (!days.length) return null;
  const daySet = new Set<number>(days.map((d: any) => Number(d)));

  const { data: latest } = await admin
    .from("posts")
    .select("scheduled_for")
    .eq("client_id", client_id)
    .eq("status", "scheduled")
    .not("scheduled_for", "is", null)
    .order("scheduled_for", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const lastPub = client?.last_autopublish_at ? new Date(client.last_autopublish_at) : null;
  const latestSched = latest?.scheduled_for ? new Date(latest.scheduled_for) : null;

  const anchor = latestSched
    ? latestSched
    : (lastPub && lastPub > now ? lastPub : now);

  // Walk forward starting the day after the anchor until we hit one of the days.
  const next = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 14, 0, 0));
  next.setUTCDate(next.getUTCDate() + 1);
  for (let i = 0; i < 14; i++) {
    if (daySet.has(next.getUTCDay()) && next > anchor) {
      return next.toISOString();
    }
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return null;
}

export function buildUserPrompt({ topic, client, market, profile }: any): string {
  const agentName = profile?.full_name ?? "the agent";
  const city = topic.geo_scope ?? market?.primary_city ?? client.city ?? "their market";
  const years = client.years_experience ?? "—";

  const napLines: string[] = [];
  if (client.street_address) napLines.push(client.street_address);
  const cityLine = [client.city, client.state].filter(Boolean).join(", ");
  if (cityLine || client.postal_code) napLines.push([cityLine, client.postal_code].filter(Boolean).join(" "));
  if (client.phone_e164) napLines.push(client.phone_e164);
  const napBlock = [agentName, client.brokerage ?? "", ...napLines].filter(Boolean).join("\n");

  const suggestedQuestions = (topic.h2s ?? topic.talking_points ?? []) as string[];
  const questionsList = suggestedQuestions.length
    ? suggestedQuestions.map((q: string) => `- ${q}`).join("\n")
    : "- (none provided — invent 3-4 natural follow-up questions a buyer/seller would ask after the title)";

  return `
Write the GEO Answer Page.

QUESTION (this is the H1 title): ${topic.title}
Geographic focus: ${city}
Target word count: ${topic.word_count ?? 1000} (must be 800-1200)

ANSWER CAPSULE TEMPLATE — your first paragraph after the H1 must follow this shape (THIRD PERSON, narrator describing the agent), filled with specifics:
"${agentName}, a ${city}-based real estate agent with ${years} years of experience${client.brokerage ? ` at ${client.brokerage}` : ""}, recommends {specific answer to the question}. {One sentence on WHY in third person — concrete reason, not generic.} {Optional third sentence with a specific data point or named neighborhood/price band/school district.}"

H2 SECTIONS — rewrite each suggested topic below as a NATURAL FOLLOW-UP QUESTION header, then answer it in 2-3 self-contained paragraphs with specifics (named neighborhoods, school districts, price bands, timeframes). Drop or merge any that don't make sense as questions. Stay in third person throughout — describe what ${agentName} recommends, observes, or has seen, never what "I" recommend.

Suggested topics to cover:
${questionsList}

REQUIRED FINAL SECTION:
"## About ${agentName}" — 2-3 sentences IN THIRD PERSON (e.g. "${agentName} has spent ${years} years..."). Use these E-E-A-T inputs:
- Years in business: ${years}
- Brokerage: ${client.brokerage ?? "—"}
- Voice (recast in third person): ${client.voice ?? "professional and warm"}
- Differentiators: ${client.differentiators ?? "—"}
- Ideal client: ${client.ideal_client ?? "—"}
- Primary market: ${market?.primary_city ?? "—"}, ${market?.primary_state ?? "—"}
- Cities they work: ${(market?.cities ?? []).join(", ") || "—"}
- Neighborhoods they work: ${(market?.neighborhoods ?? []).join(", ") || "—"}
- Counties they work: ${(market?.counties ?? []).join(", ") || "—"}

After the About paragraphs, output this contact block VERBATIM, each line on its own line, no labels, no CTA framing:
${napBlock || "(no contact info on file — omit the block)"}

REMINDERS:
- THIRD PERSON ONLY. The narrator is NOT ${agentName}. Never write "I", "me", "my", "we", or "our". Refer to ${agentName} by name and "they/them".
- Use ${agentName}'s name 4-6 times across the post.
- Mention ${city} naturally throughout.
- EVERY # and ## MUST have a blank line before AND after it. No exceptions. The output is rendered as markdown and inline headers break it.
- No em dashes. No emojis. No "SEO/keywords/AI". No "in today's market" / "navigating" / "your real estate journey".
- Return JSON only: { "title", "slug" (kebab-case), "tag", "excerpt" (140-180 chars, third person), "body" (full markdown) }.
`.trim();
}
