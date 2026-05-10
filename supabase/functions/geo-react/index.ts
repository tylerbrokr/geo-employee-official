// Generates a single short, in-character GEO reaction line after a user
// answers an intake question. Returns { reaction: string }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are GEO, an AI employee on a real estate agent's team at The Inner Cirql.
You are interviewing the agent so you can build their content engine.
After they answer a question, write ONE short reaction line — not the next question.

Rules:
- One sentence. Maximum 14 words.
- Direct, warm, operator. Sound like a real teammate, not a chatbot.
- No hype words: never use "amazing", "awesome", "love", "perfect", "great", "supercharge", "unlock", "leverage", "game-changer".
- No emojis. No em dashes (use periods or commas).
- Never ask a follow-up question. Never say "let's...".
- Reference the answer specifically when natural (a city, a number, a specialty).
- If the answer is empty or skipped, write a brief "okay, moving on" style line.

Output only the reaction text. No labels, no JSON, no quotes.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const field: string = body.field ?? "answer";
    const answer = body.answer;
    const context = body.context ?? {};

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY not set" }, 500);

    const answerStr = Array.isArray(answer) ? answer.join(", ") : String(answer ?? "");
    const userPrompt = `Field: ${field}
Their answer: ${answerStr || "(blank)"}
Known context: ${JSON.stringify(context)}

Write your one-line reaction.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
    if (aiRes.status === 402) return json({ error: "credits_exhausted" }, 402);
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: "ai_error", detail: txt }, 502);
    }

    const aiJson = await aiRes.json();
    let reaction: string = aiJson?.choices?.[0]?.message?.content ?? "";
    reaction = reaction.trim().replace(/^["']|["']$/g, "").replace(/—/g, ",");
    if (reaction.length > 160) reaction = reaction.slice(0, 160);

    return json({ reaction });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
