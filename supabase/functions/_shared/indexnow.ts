// Submit URLs to IndexNow (Bing/Yandex/Seznam/Naver/Yep).
// The renderer must serve the key as plain text at https://{host}/{key}.txt.
// Failures are logged but never thrown — IndexNow is best-effort.

export async function submitIndexNow(
  admin: any,
  client_id: string,
  paths: string[],
): Promise<{ ok: boolean; host?: string; count: number; status?: number; error?: string }> {
  try {
    const { data: site } = await admin
      .from("client_sites")
      .select("custom_domain, subdomain, dns_verified, indexnow_key")
      .eq("client_id", client_id)
      .maybeSingle();
    if (!site) return { ok: false, count: 0, error: "no site row" };

    const host =
      site.dns_verified && site.custom_domain
        ? site.custom_domain
        : site.subdomain
        ? `${site.subdomain}.mygeosite.com`
        : null;
    if (!host) return { ok: false, count: 0, error: "no host" };
    if (!site.indexnow_key) return { ok: false, host, count: 0, error: "no indexnow_key" };

    const urlList = paths.map((p) =>
      p.startsWith("http") ? p : `https://${host}${p.startsWith("/") ? p : `/${p}`}`,
    );

    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: site.indexnow_key,
        keyLocation: `https://${host}/${site.indexnow_key}.txt`,
        urlList,
      }),
    });

    const ok = res.status >= 200 && res.status < 300;
    if (ok) {
      await admin
        .from("client_sites")
        .update({
          last_indexnow_at: new Date().toISOString(),
          last_indexnow_count: urlList.length,
        })
        .eq("client_id", client_id);
    } else {
      console.warn(`[indexnow] non-2xx for ${host}: ${res.status} ${await res.text().catch(() => "")}`);
    }

    return { ok, host, count: urlList.length, status: res.status };
  } catch (e: any) {
    console.warn(`[indexnow] failed for client=${client_id}: ${e?.message ?? e}`);
    return { ok: false, count: 0, error: e?.message ?? String(e) };
  }
}

// Standard publish ping: post URL + blog index + sitemap.
export function publishPaths(slug: string): string[] {
  return [`/blog/${slug}`, "/blog", "/sitemap.xml"];
}
