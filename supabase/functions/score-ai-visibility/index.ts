// Admin-only: compute an AI Visibility Score (0-100) for a client.
// Combines DB completeness checks with live fetches of the rendered site
// (robots.txt, sitemap.xml, llms.txt, homepage, about, blog, sampled post,
// sampled area). Parses HTML for meta tags + JSON-LD and validates shape.
// Persists one row into client_visibility_reports.
//
// Body: { client_id: string, internal?: boolean }
// - internal=true + service-role key skips the admin-user check (used by
//   fire-and-forget calls from other edge functions).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckStatus = "pass" | "fail" | "partial";
type Category = "profile" | "infra" | "schema" | "content";

interface Check {
  id: string;
  label: string;
  category: Category;
  points: number;
  max: number;
  status: CheckStatus;
  detail: string;
  fix_hint: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function check(
  id: string,
  label: string,
  category: Category,
  max: number,
  ok: boolean | "partial",
  detail: string,
  fix_hint: string,
  partialPoints?: number,
): Check {
  const status: CheckStatus = ok === true ? "pass" : ok === "partial" ? "partial" : "fail";
  const points = ok === true ? max : ok === "partial" ? (partialPoints ?? Math.floor(max / 2)) : 0;
  return { id, label, category, points, max, status, detail, fix_hint };
}

async function fetchText(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; text: string; ct: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "GEO-Visibility-Bot/1.0" },
      redirect: "follow",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, ct: res.headers.get("content-type") ?? "" };
  } catch (_e) {
    return { ok: false, status: 0, text: "", ct: "" };
  } finally {
    clearTimeout(t);
  }
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed?.["@graph"] && Array.isArray(parsed["@graph"])) out.push(...parsed["@graph"]);
      else out.push(parsed);
    } catch {/* ignore malformed */}
  }
  return out;
}

function hasType(nodes: any[], type: string): any | null {
  for (const n of nodes) {
    const t = n?.["@type"];
    if (!t) continue;
    if (Array.isArray(t) ? t.includes(type) : t === type) return n;
  }
  return null;
}

function extractMeta(html: string) {
  const get = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    title: get(/<title[^>]*>([^<]*)<\/title>/i),
    description: get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    canonical: get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
    ogTitle: get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i),
    ogDescription: get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i),
    ogType: get(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)["']/i),
    ogUrl: get(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']*)["']/i),
    ogImage: get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i),
  };
}

function pageMetaOK(meta: ReturnType<typeof extractMeta>) {
  return !!(meta.title && meta.description && meta.canonical && meta.ogTitle && meta.ogDescription && meta.ogUrl);
}

function wordCount(s: string | undefined | null): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const client_id = body?.client_id as string | undefined;
    const internal = body?.internal === true;
    if (!client_id) return json({ error: "client_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth — admin user OR internal (service-role) call.
    if (!internal) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);
    }

    // Load everything we need in parallel.
    const [
      { data: client },
      { data: market },
      { data: site },
      { data: siteCopy },
      { data: specialties },
      { data: areas },
      { data: posts },
      { data: napItems },
    ] = await Promise.all([
      admin.from("clients").select("*").eq("id", client_id).maybeSingle(),
      admin.from("client_markets").select("*").eq("client_id", client_id).maybeSingle(),
      admin.from("client_sites").select("*").eq("client_id", client_id).maybeSingle(),
      admin.from("site_copy").select("*").eq("client_id", client_id).maybeSingle(),
      admin.from("client_specialties").select("specialty").eq("client_id", client_id),
      admin.from("client_areas").select("*").eq("client_id", client_id),
      admin.from("posts").select("*").eq("client_id", client_id),
      admin.from("nap_checklist").select("item_key,status").eq("client_id", client_id),
    ]);

    if (!client) return json({ error: "client not found" }, 404);

    const checks: Check[] = [];

    // ────────── Profile completeness (25) ──────────
    const napFields = ["phone_e164", "street_address", "city", "state", "postal_code"];
    const napFilled = napFields.filter((k) => client[k]).length;
    checks.push(check(
      "nap", "NAP filled (phone, street, city, state, postal)", "profile", 5,
      napFilled === 5 ? true : napFilled >= 3 ? "partial" : false,
      `${napFilled}/5 NAP fields populated`,
      "Open the client's Overview tab and complete the Public NAP block.",
      napFilled >= 3 ? 3 : 0,
    ));

    const napDone = (napItems ?? []).filter((r: any) => r.status === "done").length;
    const napTotal = (napItems ?? []).length || 6;
    checks.push(check(
      "nap_consistency", "Profile NAP verified across GMB, Bing, Zillow, Realtor, Facebook", "profile", 5,
      napDone >= 5 ? true : napDone >= 3 ? "partial" : false,
      `${napDone}/${napTotal} profile checklist items confirmed`,
      "Have the client open Portal → Profiles and confirm each item matches the canonical NAP.",
      napDone >= 3 ? 3 : 0,
    ));

    const headshot = !!client.headshot_url;
    const logo = !!client.logo_url;
    checks.push(check(
      "images", "Headshot + logo uploaded", "profile", 3,
      headshot && logo ? true : headshot || logo ? "partial" : false,
      `headshot ${headshot ? "✓" : "missing"}, logo ${logo ? "✓" : "missing"}`,
      "Have the client upload both in their portal (or upload from admin Overview).",
      1,
    ));

    const bioShort = !!siteCopy?.bio_short && siteCopy.bio_short.length > 50;
    const bioLong = !!siteCopy?.bio_long && siteCopy.bio_long.length > 200;
    const tagline = !!siteCopy?.tagline;
    const bioCount = [bioShort, bioLong, tagline].filter(Boolean).length;
    checks.push(check(
      "bios", "Bio short, bio long, tagline filled", "profile", 5,
      bioCount === 3 ? true : bioCount >= 1 ? "partial" : false,
      `${bioCount}/3 copy fields present`,
      "Site copy tab → Generate or fill bio_short, bio_long, tagline.",
      Math.round((bioCount / 3) * 5),
    ));

    const metaTitle = !!siteCopy?.meta_title;
    const metaDesc = !!siteCopy?.meta_description;
    checks.push(check(
      "site_meta", "Site meta_title + meta_description set", "profile", 3,
      metaTitle && metaDesc ? true : metaTitle || metaDesc ? "partial" : false,
      `meta_title ${metaTitle ? "✓" : "missing"}, meta_description ${metaDesc ? "✓" : "missing"}`,
      "Site copy tab → set meta title and description.",
      1,
    ));

    const colorsCustom = client.primary_color !== "#059669" || client.accent_color !== "#0F172A";
    checks.push(check(
      "colors", "Brand colors customized (not defaults)", "profile", 2,
      colorsCustom,
      colorsCustom ? "client picked brand colors" : "still using default colors",
      "Have the client pick brand colors in onboarding or set them in admin.",
    ));

    const specCount = (specialties ?? []).length;
    const propCount = (client.property_types ?? []).length;
    const specsOK = specCount >= 3 && propCount >= 1;
    checks.push(check(
      "specs", "≥3 specialties and ≥1 property type", "profile", 3,
      specsOK ? true : specCount >= 1 || propCount >= 1 ? "partial" : false,
      `${specCount} specialties, ${propCount} property types`,
      "Add specialties and property types on the Overview tab.",
      1,
    ));

    const voiceFields = ["voice", "values_text", "ideal_client", "brokerage_story"];
    const voiceFilled = voiceFields.filter((k) => client[k] && String(client[k]).trim().length > 20).length;
    checks.push(check(
      "voice", "Voice, values, ideal client, story filled", "profile", 4,
      voiceFilled === 4 ? true : voiceFilled >= 2 ? "partial" : false,
      `${voiceFilled}/4 narrative fields populated`,
      "Complete the Voice & Story section on Overview.",
      Math.round((voiceFilled / 4) * 4),
    ));

    // ────────── Resolve live hostname ──────────
    let hostname: string | null = null;
    if (site?.dns_verified && site?.custom_domain) hostname = site.custom_domain;
    else if (site?.subdomain) hostname = `${site.subdomain}.mygeosite.com`;

    const liveOK = !!hostname;
    checks.push(check(
      "site_live", "Site is live (custom domain verified or subdomain provisioned)", "infra", 5,
      liveOK ? (site?.dns_verified ? true : "partial") : false,
      liveOK ? `https://${hostname}` : "no live hostname",
      "Provision the site on the Domain tab.",
      3,
    ));

    // ────────── Live fetches (parallel) ──────────
    let robotsTxt = "", sitemapXml = "", llmsTxt = "";
    const sampledPost = (posts ?? []).find((p: any) => p.status === "published");
    const sampledArea = (areas ?? [])[0];

    let homeHtml = "", aboutHtml = "", blogHtml = "", postHtml = "", areaHtml = "";
    let homeStatus = 0, aboutStatus = 0, blogStatus = 0, postStatus = 0, areaStatus = 0;
    let robotsStatus = 0, sitemapStatus = 0, llmsStatus = 0;

    if (hostname) {
      const base = `https://${hostname}`;
      const results = await Promise.all([
        fetchText(`${base}/robots.txt`),
        fetchText(`${base}/sitemap.xml`),
        fetchText(`${base}/llms.txt`),
        fetchText(`${base}/`),
        fetchText(`${base}/about`),
        fetchText(`${base}/blog`),
        sampledPost ? fetchText(`${base}/blog/${sampledPost.slug}`) : Promise.resolve({ ok: false, status: 0, text: "", ct: "" }),
        sampledArea ? fetchText(`${base}/areas/${sampledArea.slug}`) : Promise.resolve({ ok: false, status: 0, text: "", ct: "" }),
      ]);
      [robotsTxt, sitemapXml, llmsTxt] = [results[0].text, results[1].text, results[2].text];
      [robotsStatus, sitemapStatus, llmsStatus] = [results[0].status, results[1].status, results[2].status];
      homeHtml = results[3].text; homeStatus = results[3].status;
      aboutHtml = results[4].text; aboutStatus = results[4].status;
      blogHtml = results[5].text; blogStatus = results[5].status;
      postHtml = results[6].text; postStatus = results[6].status;
      areaHtml = results[7].text; areaStatus = results[7].status;
    }

    // robots.txt — must mention AI bots
    const aiBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
    const robotsHits = aiBots.filter((b) => robotsTxt.includes(b)).length;
    checks.push(check(
      "robots", "robots.txt allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)", "infra", 5,
      robotsHits === 4 ? true : robotsHits >= 2 ? "partial" : false,
      hostname ? `${robotsHits}/4 AI bots listed (HTTP ${robotsStatus})` : "no live hostname",
      "Renderer needs to publish a robots.txt listing AI bots. See docs/renderer-handoff.md §10.",
      Math.round((robotsHits / 4) * 5),
    ));

    // sitemap.xml
    const sitemapLooksValid = sitemapStatus === 200 && /<urlset/i.test(sitemapXml) && /<loc>/i.test(sitemapXml);
    const publishedSlugs = (posts ?? []).filter((p: any) => p.status === "published").map((p: any) => p.slug);
    const slugsInSitemap = publishedSlugs.filter((s: string) => sitemapXml.includes(`/blog/${s}`)).length;
    const sitemapComplete = sitemapLooksValid && publishedSlugs.length > 0 && slugsInSitemap === publishedSlugs.length;
    checks.push(check(
      "sitemap", "sitemap.xml served and lists every published post", "infra", 5,
      sitemapComplete ? true : sitemapLooksValid ? "partial" : false,
      hostname
        ? `HTTP ${sitemapStatus}, ${slugsInSitemap}/${publishedSlugs.length} posts listed`
        : "no live hostname",
      "Renderer must serve a dynamic sitemap.xml. See docs/renderer-handoff.md §9.",
      sitemapLooksValid ? 3 : 0,
    ));

    // llms.txt
    const llmsValid = llmsStatus === 200 && /^#\s/m.test(llmsTxt);
    checks.push(check(
      "llms", "llms.txt present and well-formed", "infra", 5,
      llmsValid,
      hostname ? `HTTP ${llmsStatus}, ${llmsTxt.length} bytes` : "no live hostname",
      "Renderer must serve /llms.txt. See docs/renderer-handoff.md.",
    ));

    // Key routes 200
    const routeChecks = [
      { name: "/", status: homeStatus },
      { name: "/about", status: aboutStatus },
      { name: "/blog", status: blogStatus },
      ...(sampledPost ? [{ name: `/blog/${sampledPost.slug}`, status: postStatus }] : []),
      ...(sampledArea ? [{ name: `/areas/${sampledArea.slug}`, status: areaStatus }] : []),
    ];
    const routes200 = routeChecks.filter((r) => r.status === 200).length;
    checks.push(check(
      "routes", `All sampled routes return 200 (${routes200}/${routeChecks.length})`, "infra", 5,
      routeChecks.length > 0 && routes200 === routeChecks.length ? true : routes200 > 0 ? "partial" : false,
      routeChecks.map((r) => `${r.name}: ${r.status || "fail"}`).join(", "),
      "Investigate failing routes in the renderer.",
      Math.round((routes200 / Math.max(routeChecks.length, 1)) * 5),
    ));

    // ────────── Schema + meta (25) ──────────
    const homeLd = extractJsonLd(homeHtml);
    const homeAgent = hasType(homeLd, "RealEstateAgent") ?? hasType(homeLd, "Person");
    const homeBiz = hasType(homeLd, "LocalBusiness") ?? homeAgent;
    const homeSchemaOK = !!homeAgent && !!homeBiz;
    checks.push(check(
      "schema_home", "Homepage JSON-LD includes RealEstateAgent/Person + LocalBusiness", "schema", 6,
      homeSchemaOK ? true : homeAgent || homeBiz ? "partial" : false,
      `agent ${homeAgent ? "✓" : "missing"}, business ${homeBiz ? "✓" : "missing"}`,
      "Renderer must emit Person/RealEstateAgent + LocalBusiness JSON-LD on the homepage. See §7.",
      3,
    ));

    const postLd = extractJsonLd(postHtml);
    const article = hasType(postLd, "Article") ?? hasType(postLd, "BlogPosting");
    const articleOK = !!article
      && !!article.articleBody
      && (typeof article.wordCount === "number" || /\d/.test(String(article.wordCount ?? "")))
      && !!article.author
      && !!article.datePublished;
    checks.push(check(
      "schema_article", "Sampled post has Article schema with articleBody, wordCount, author, datePublished", "schema", 6,
      articleOK ? true : article ? "partial" : false,
      sampledPost ? (article ? "Article present; fields: " + ["articleBody","wordCount","author","datePublished"].filter((k)=>article[k]).join(",") : "no Article schema found") : "no published post to sample",
      "Renderer must emit complete Article JSON-LD on every post. See §15b.",
      3,
    ));

    const areaLd = extractJsonLd(areaHtml);
    const faqPage = hasType(areaLd, "FAQPage");
    checks.push(check(
      "schema_faq", "Area pages emit FAQPage JSON-LD", "schema", 4,
      !!faqPage,
      sampledArea ? (faqPage ? "FAQPage present" : "no FAQPage schema found") : "no area to sample",
      "Renderer must emit FAQPage JSON-LD on /areas/[slug]. See §6.",
    ));

    const breadHome = !!hasType(homeLd, "BreadcrumbList");
    const breadPost = !!hasType(postLd, "BreadcrumbList");
    const breadArea = !!hasType(areaLd, "BreadcrumbList");
    const breadHits = [breadPost, breadArea].filter(Boolean).length; // home doesn't strictly need it
    checks.push(check(
      "schema_breadcrumb", "BreadcrumbList on inner pages (post, area)", "schema", 3,
      breadHits === 2 ? true : breadHits === 1 ? "partial" : false,
      `post ${breadPost ? "✓" : "missing"}, area ${breadArea ? "✓" : "missing"}${breadHome ? ", home ✓" : ""}`,
      "Renderer should emit BreadcrumbList on inner pages.",
      1,
    ));

    const pageMetas = [
      { name: "/", html: homeHtml },
      { name: "/about", html: aboutHtml },
      { name: "/blog", html: blogHtml },
      ...(sampledPost ? [{ name: `/blog/${sampledPost.slug}`, html: postHtml }] : []),
      ...(sampledArea ? [{ name: `/areas/${sampledArea.slug}`, html: areaHtml }] : []),
    ];
    const REQUIRED_FIELDS: Array<{ key: keyof ReturnType<typeof extractMeta>; label: string }> = [
      { key: "title", label: "title" },
      { key: "description", label: "description" },
      { key: "canonical", label: "canonical" },
      { key: "ogTitle", label: "og:title" },
      { key: "ogDescription", label: "og:description" },
      { key: "ogUrl", label: "og:url" },
    ];
    const perPage = pageMetas.map((p) => {
      const m = extractMeta(p.html);
      const missing = REQUIRED_FIELDS.filter((f) => !m[f.key]).map((f) => f.label);
      return { name: p.name, title: m.title, missing, fetched: !!p.html, hasOgImage: !!m.ogImage };
    });
    const fetchedPages = perPage.filter((p) => p.fetched);
    const metasOK = fetchedPages.filter((p) => p.missing.length === 0).length;
    const titles = fetchedPages.map((p) => p.title).filter(Boolean);
    const titlesUnique = new Set(titles).size === titles.length;
    const metaPass = fetchedPages.length > 0 && metasOK === fetchedPages.length && titlesUnique;
    const failingDetail = fetchedPages
      .filter((p) => p.missing.length > 0)
      .map((p) => `${p.name}: missing ${p.missing.join(", ")}`)
      .join("; ");
    const ogImageCoverage = fetchedPages.filter((p) => p.hasOgImage).length;
    const detailParts = [
      `${metasOK}/${fetchedPages.length} pages fully tagged`,
      `titles ${titlesUnique ? "unique" : "DUPLICATE"}`,
      `og:image on ${ogImageCoverage}/${fetchedPages.length} (informational)`,
    ];
    if (failingDetail) detailParts.push(failingDetail);
    checks.push(check(
      "page_meta", "Every sampled page has title, description, canonical, og:* (and unique titles)", "schema", 4,
      metaPass ? true : metasOK > 0 ? "partial" : false,
      detailParts.join(" — "),
      "Renderer must emit a full per-page head. See docs/renderer-handoff.md §8 for the per-route source-of-truth table.",
      Math.round((metasOK / Math.max(fetchedPages.length, 1)) * 4),
    ));

    const schemaPhone = homeBiz?.telephone ?? homeAgent?.telephone ?? "";
    const napMatch = !!client.phone_e164 && !!schemaPhone && schemaPhone.replace(/\D/g, "").includes(client.phone_e164.replace(/\D/g, "").slice(-10));
    checks.push(check(
      "schema_nap", "NAP phone in schema matches DB", "schema", 2,
      napMatch,
      client.phone_e164 ? (schemaPhone ? `schema: ${schemaPhone}` : "phone missing from schema") : "no phone_e164 in DB",
      "Fill phone_e164 on Overview; renderer should put it in LocalBusiness.telephone.",
    ));

    // ────────── Content + freshness (25) ──────────
    const publishedPosts = (posts ?? []).filter((p: any) => p.status === "published");
    const publishedCount = publishedPosts.length;
    checks.push(check(
      "post_count", "≥4 published posts", "content", 5,
      publishedCount >= 4 ? true : publishedCount >= 1 ? "partial" : false,
      `${publishedCount} published`,
      "Generate more posts or wait for autopilot to publish.",
      Math.min(publishedCount, 4),
    ));

    const now = Date.now();
    const recent = publishedPosts.some((p: any) =>
      p.published_at && now - new Date(p.published_at).getTime() < 14 * 24 * 3600 * 1000,
    );
    checks.push(check(
      "post_freshness", "At least 1 post published in the last 14 days", "content", 5,
      recent,
      recent ? "recent activity" : publishedCount > 0 ? "stale — no post in 14 days" : "no published posts",
      "Enable autopilot or generate a new post.",
    ));

    const buffer = (posts ?? []).filter((p: any) => ["draft", "pending_review", "scheduled"].includes(p.status)).length;
    const autoOK = !!client.autopilot_enabled && buffer >= 4;
    checks.push(check(
      "autopilot", "Autopilot enabled with ≥4 drafts buffered", "content", 5,
      autoOK ? true : client.autopilot_enabled || buffer > 0 ? "partial" : false,
      `autopilot ${client.autopilot_enabled ? "on" : "off"}, ${buffer} buffered drafts`,
      "Click Go Live on the client header; ensure topics are queued.",
      client.autopilot_enabled ? 3 : 1,
    ));

    const areaCount = (areas ?? []).length;
    const staleAreas = (areas ?? []).filter((a: any) => a.stale).length;
    const areasOK = areaCount > 0 && staleAreas === 0;
    checks.push(check(
      "areas", "All area pages generated and fresh", "content", 5,
      areasOK ? true : areaCount > 0 ? "partial" : false,
      `${areaCount} areas, ${staleAreas} stale`,
      "Areas tab → regenerate stale areas.",
      areaCount > 0 ? 3 : 0,
    ));

    const copyStale = !!siteCopy?.stale;
    checks.push(check(
      "copy_fresh", "Site copy not stale", "content", 3,
      siteCopy && !copyStale,
      siteCopy ? (copyStale ? "stale — regenerate" : "fresh") : "no site_copy row",
      "Site copy tab → regenerate.",
    ));

    const avgWords = publishedPosts.length
      ? Math.round(publishedPosts.reduce((s: number, p: any) => s + wordCount(p.body), 0) / publishedPosts.length)
      : 0;
    checks.push(check(
      "post_length", "Average published post length ≥800 words", "content", 2,
      avgWords >= 800 ? true : avgWords >= 500 ? "partial" : false,
      `avg ${avgWords} words across ${publishedPosts.length} posts`,
      "Increase target word count in post generation.",
      1,
    ));

    // ────────── Aggregate ──────────
    const sumBy = (cat: Category) => checks.filter((c) => c.category === cat).reduce((s, c) => s + c.points, 0);
    const profile_score = sumBy("profile");
    const infra_score = sumBy("infra");
    const schema_score = sumBy("schema");
    const content_score = sumBy("content");
    const total_score = profile_score + infra_score + schema_score + content_score;

    const { data: inserted, error: insertErr } = await admin
      .from("client_visibility_reports")
      .insert({
        client_id,
        total_score,
        profile_score,
        infra_score,
        schema_score,
        content_score,
        checks,
        hostname,
      })
      .select("*")
      .single();

    if (insertErr) return json({ error: insertErr.message }, 500);
    return json({ report: inserted });
  } catch (e: any) {
    console.error("score-ai-visibility error", e);
    return json({ error: e?.message ?? "unknown error" }, 500);
  }
});
