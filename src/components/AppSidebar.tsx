import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClient } from "@/hooks/useClient";
import { ChangeRequestModal } from "./ChangeRequestModal";
import { BrandLockup } from "./BrandMark";

const navItems = [
  { label: "Dashboard", path: "/portal", icon: DashboardIcon, end: true },
  { label: "Posts", path: "/portal/posts", icon: PostsIcon },
  { label: "My Site", path: "/portal/my-site", icon: SiteIcon },
  { label: "Market", path: "/portal/market", icon: MarketIcon },
  { label: "Profiles", path: "/portal/profiles", icon: ProfilesIcon },
];

function ProfilesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M2.5 15.5l3-3 2.5 2 4-4 3.5 3" />
      <rect x="1.5" y="2.5" width="15" height="13" />
    </svg>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="1.5" y="1.5" width="6.5" height="6.5" />
      <rect x="10" y="1.5" width="6.5" height="3.5" />
      <rect x="1.5" y="10" width="6.5" height="3.5" />
      <rect x="10" y="7" width="6.5" height="6.5" />
    </svg>
  );
}
function PostsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square">
      <path d="M3 4h12M3 7.5h8M3 11h10M3 14.5h6" />
    </svg>
  );
}
function SiteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square">
      <rect x="1.5" y="2.5" width="15" height="13" />
      <path d="M1.5 6.5h15" />
    </svg>
  );
}
function MarketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter">
      <circle cx="9" cy="8" r="2.5" />
      <path d="M9 17s-6-4-6-9a6 6 0 0 1 12 0c0 5-6 9-6 9z" />
    </svg>
  );
}
function AccountIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square">
      <circle cx="9" cy="6" r="3" />
      <path d="M2.5 16.5c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
    </svg>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { client } = useClient();
  const [crOpen, setCrOpen] = useState(false);

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Member";
  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const subtitle = client?.brokerage || "Inner Cirql member";

  const renderNavItem = (
    item: { label: string; path: string; icon: (p: { className?: string }) => JSX.Element; end?: boolean },
    active: boolean,
  ) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.end}
      className={`relative flex items-center gap-3 px-5 py-2.5 font-ui text-[13px] transition-opacity duration-150 ${
        active ? "text-ink" : "text-ink/50 hover:text-ink"
      }`}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-gold" />}
      <item.icon className="shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <>
      <aside className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50 bg-white border-r border-ink/[0.08]">
        {/* Logo lockup */}
        <div className="px-5 py-7 flex items-center gap-3">
          <BrandLockup markSize={26} wordmarkSize={20} />
        </div>

        <div className="fading-divider mx-5" />

        <nav className="flex-1 mt-5">
          <div className="space-y-px">
            {navItems.map((item) => {
              const active = item.end
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return renderNavItem(item, active);
            })}
          </div>

          <div className="fading-divider mx-5 my-5" />

          <div className="space-y-px">
            {renderNavItem(
              { label: "Account", path: "/portal/account", icon: AccountIcon, end: true },
              location.pathname === "/portal/account",
            )}
          </div>
        </nav>

        <div className="px-5 py-3 space-y-1">
          <button
            onClick={() => setCrOpen(true)}
            className="w-full flex items-center gap-2 px-0 py-2 font-ui text-[12px] text-ink/50 hover:text-ink transition-opacity"
          >
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square">
              <path d="M3 14l4-1 9-9-3-3-9 9-1 4z" />
            </svg>
            Request a change
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-0 py-2 font-ui text-[12px] text-ink/50 hover:text-ink transition-opacity"
          >
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square">
              <path d="M11 14l4-5-4-5M15 9H4M7 15H3V3h4" />
            </svg>
            Sign out
          </button>
        </div>

        <div className="px-5 py-5 border-t border-ink/[0.08] flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center font-ui text-[11px] font-medium text-ink bg-off-white border border-ink/[0.08]">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-ui text-[13px] font-medium text-ink truncate">{fullName}</div>
            <div className="font-ui text-[11px] text-ink/50 truncate">{subtitle}</div>
          </div>
        </div>
      </aside>

      <ChangeRequestModal open={crOpen} onClose={() => setCrOpen(false)} />
    </>
  );
}
