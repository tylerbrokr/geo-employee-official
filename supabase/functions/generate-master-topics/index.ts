// Admin-only: deterministically enumerate GEO blog topics for a client.
// Body: { client_id: string, replenish?: boolean }
// No AI. Topics = client areas × fixed GEO question bank.
// On admin call: deletes all queued topics first, then rebuilds.
// On replenish call (autopilot): inserts only NEW titles (skips dups), then
// falls back to the seasonal layer if the base set is exhausted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Question bank — designed around what people actually ask LLMs.
// {area} is filled with a city, neighborhood, or county name.
const BASE_TEMPLATES = [
  "Best real estate agent in {area}",
  "What is the housing market like in {area}",
  "Is {area} a good place to buy a home",
  "What to know about buying a home in {area}",
  "Most desirable neighborhoods in {area}",
  "What homes cost in {area}",
  "First-time homebuyer guide to {area}",
  "Selling a home in {area}, what to expect",
  "Investment properties in {area}",
  "Relocating to {area}, real estate guide",
] as const;

const SEASONAL_TEMPLATES: Record<"spring" | "summer" | "fall" | "winter", string[]> = {
  spring: ["{area} spring real estate market"],
  summer: ["{area} summer housing trends"],
  fall: ["{area} fall buyer's guide"],
  winter: ["{area} winter market outlook"],
};

function currentSeason(d = new Date()): "spring" | "summer" | "fall" | "winter" {
  const m = d.getUTCMonth(); // 0-11
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

// Per-template content scaffold (talking points + h2s). Generic and
// agent-agnostic; the post writer fills in agent identity at write time.
function scaffoldFor(template: string): { talking_points: string[]; h2s: string[] } {
  const t = template;
  if (t.startsWith("Best real estate agent")) {
    return {
      talking_points: [
        "Why a local agent matters in this market",
        "Years of experience and credentials",
        "Specific neighborhoods and price bands worked",
        "How the agent works with buyers and sellers",
        "How to get in touch",
      ],
      h2s: [
        "Why work with a local agent",
        "What experience matters",
        "Where I work and what I know",
        "How to reach me",
      ],
    };
  }
  if (t.startsWith("What is the housing market like")) {
    return {
      talking_points: [
        "Current inventory and days on market",
        "Median price and recent direction",
        "Which neighborhoods are moving fastest",
        "Buyer vs seller leverage right now",
        "What to watch over the next quarter",
      ],
      h2s: [
        "Where prices are now",
        "How fast homes are selling",
        "Who has the leverage",
        "What to watch next",
      ],
    };
  }
  if (t.startsWith("Is ") && t.includes("a good place to buy")) {
    return {
      talking_points: [
        "Cost of living and home affordability",
        "Schools, safety, and lifestyle",
        "Commute and transit",
        "Long-term appreciation and resale",
        "Who this area suits best",
      ],
      h2s: ["What you get for the money", "Daily life and schools", "Long-term value", "Who fits here"],
    };
  }
  if (t.startsWith("What to know about buying a home")) {
    return {
      talking_points: [
        "Local price ranges by neighborhood",
        "Property taxes and HOAs",
        "Inspection issues common to the area",
        "Typical timeline from offer to close",
        "Mistakes first-time buyers make here",
      ],
      h2s: ["Prices and property taxes", "What inspections find here", "How long it takes", "Common mistakes"],
    };
  }
  if (t.startsWith("Most desirable neighborhoods")) {
    return {
      talking_points: [
        "Top three neighborhoods and why",
        "Price range in each",
        "Style of homes available",
        "Schools and walkability",
        "Who tends to buy in each",
      ],
      h2s: ["The most-asked-about neighborhoods", "Prices and home styles", "Schools and lifestyle", "Who buys where"],
    };
  }
  if (t.startsWith("What homes cost")) {
    return {
      talking_points: [
        "Median sale price and recent trend",
        "Entry-level vs mid vs luxury bands",
        "Cost per square foot",
        "Property taxes and insurance",
        "What the next year likely looks like",
      ],
      h2s: ["Where prices sit today", "What you get at each price band", "Taxes and ongoing costs", "Where prices may go"],
    };
  }
  if (t.startsWith("First-time homebuyer guide")) {
    return {
      talking_points: [
        "Down payment and loan options that work locally",
        "Realistic price expectations",
        "Best neighborhoods for first-time buyers",
        "Inspection and closing process",
        "Mistakes to avoid",
      ],
      h2s: ["What you'll actually need to buy", "Where first-timers should look", "How the process works here", "What to avoid"],
    };
  }
  if (t.startsWith("Selling a home")) {
    return {
      talking_points: [
        "Current days on market and pricing strategy",
        "Pre-list prep that matters in this area",
        "Photography and showing approach",
        "Negotiation and contingencies",
        "Closing timeline",
      ],
      h2s: ["What sellers should expect right now", "Prep work that pays off", "How offers and negotiation work", "From offer to close"],
    };
  }
  if (t.startsWith("Investment properties")) {
    return {
      talking_points: [
        "Realistic rents and cap rates",
        "Best neighborhoods for cash flow vs appreciation",
        "Property tax and regulatory landscape",
        "Single-family vs multi-family supply",
        "Common pitfalls for out-of-area investors",
      ],
      h2s: ["What the numbers look like", "Where to focus", "Rules and taxes to know", "What out-of-area investors miss"],
    };
  }
  if (t.startsWith("Relocating")) {
    return {
      talking_points: [
        "Neighborhood quick-tour by lifestyle",
        "Schools and family considerations",
        "Commute, transit, and airport access",
        "Cost of living vs common origin cities",
        "How to buy from out of state",
      ],
      h2s: ["Where to live based on your lifestyle", "Schools and family life", "Getting around", "How to buy from out of state"],
    };
  }
  // Seasonal fallback
  return {
    talking_points: [
      "What's different about this season here",
      "Inventory and price movement",
      "Buyer and seller behavior",
      "What to do this season",
      "How to get started",
    ],
    h2s: ["What this season looks like", "Inventory and prices", "Who's buying and selling", "What to do now"],
  };
}

function primaryKeyword(template: string, area: string): string {
  // Strip braces and lowercase for a clean keyword string.
  return template.replace("{area}", area).toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function buildRow(client_id: string, template: string, area: string, position: number) {
  const title = template.replace("{area}", area);
  const { talking_points, h2s } = scaffoldFor(template);
  return {
    client_id,
    kind: "geo" as const,
    title,
    primary_keyword: primaryKeyword(template, area),
    secondary_keywords: [],
    talking_points,
    h2s,
    geo_scope: area,
    niche: null,
    word_count: 800,
    status: "queued" as const,
    position,
  };
}

function uniqueAreas(market: any): string[] {
  const set = new Set<string>();
  const push = (v: string | null | undefined) => {
    if (!v) return;
    const s = String(v).trim();
    if (s) set.add(s);
  };
  push(market?.primary_city);
  for (const c of market?.cities ?? []) push(c);
  for (const n of market?.neighborhoods ?? []) push(n);
  for (const c of market?.counties ?? []) push(c);
  return [...set];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, replenish = false } = await req.json();
    if (!client_id) return json({ error: "client_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const admin = createClient(supabaseUrl, serviceKey);

    // Allow internal service-role calls (autopilot replenish); otherwise require admin.
    const isServiceRoleCall = authHeader === `Bearer ${serviceKey}`;
    if (!isServiceRoleCall) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);
    }

    const { data: market } = await admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle();
    const areas = uniqueAreas(market);
    if (areas.length === 0) {
      return json({ error: "client has no areas — fill cities/neighborhoods/counties first" }, 400);
    }

    // On admin trigger: wipe queued topics so the list is rebuilt cleanly.
    if (!replenish) {
      await admin.from("client_topics").delete().eq("client_id", client_id).eq("status", "queued");
    }

    // Build candidate titles. On replenish, skip anything that already exists in any status.
    const { data: existing } = await admin
      .from("client_topics")
      .select("title")
      .eq("client_id", client_id);
    const existingTitles = new Set((existing ?? []).map((r: any) => r.title));

    const { data: maxRow } = await admin
      .from("client_topics")
      .select("position")
      .eq("client_id", client_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    let pos = (maxRow?.position ?? -1) + 1;

    const rows: ReturnType<typeof buildRow>[] = [];

    // Pass 1: base templates × areas
    for (const tpl of BASE_TEMPLATES) {
      for (const area of areas) {
        const title = tpl.replace("{area}", area);
        if (existingTitles.has(title)) continue;
        rows.push(buildRow(client_id, tpl, area, pos++));
        existingTitles.add(title);
      }
    }

    // Pass 2 (only on replenish, only if base produced nothing): seasonal layer
    if (replenish && rows.length === 0) {
      const season = currentSeason();
      for (const tpl of SEASONAL_TEMPLATES[season]) {
        for (const area of areas) {
          const title = tpl.replace("{area}", area);
          if (existingTitles.has(title)) continue;
          rows.push(buildRow(client_id, tpl, area, pos++));
          existingTitles.add(title);
        }
      }
    }

    let inserted = 0;
    if (rows.length > 0) {
      const { data, error } = await admin.from("client_topics").insert(rows).select("id");
      if (error) throw error;
      inserted = data?.length ?? 0;
    }

    if (!replenish && inserted > 0) {
      await admin.from("clients").update({ pipeline_stage: "topics_ready" }).eq("id", client_id);
    }

    return json({ count: inserted, areas: areas.length, templates: BASE_TEMPLATES.length });
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
