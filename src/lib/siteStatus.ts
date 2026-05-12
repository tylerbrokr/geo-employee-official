const SUBDOMAIN_HOST = "mygeosite.com";

export interface ClientSiteRow {
  subdomain: string | null;
  custom_domain: string | null;
  dns_verified: boolean;
}

export function deriveSiteLiveness(site: ClientSiteRow | null | undefined): {
  isLive: boolean;
  liveUrl: string | null;
  subdomainUrl: string | null;
  customDomainLive: boolean;
} {
  if (!site) return { isLive: false, liveUrl: null, subdomainUrl: null, customDomainLive: false };
  const subdomainUrl = site.subdomain ? `https://${site.subdomain}.${SUBDOMAIN_HOST}` : null;
  const customDomainLive = !!(site.custom_domain && site.dns_verified);
  const liveUrl = customDomainLive ? `https://${site.custom_domain}` : subdomainUrl;
  return { isLive: !!liveUrl, liveUrl, subdomainUrl, customDomainLive };
}
