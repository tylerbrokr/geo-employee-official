import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: DashboardIcon },
  { label: "Posts", path: "/posts", icon: PostsIcon },
  { label: "My Site", path: "/my-site", icon: SiteIcon },
  { label: "Market", path: "/market", icon: MarketIcon },
];

const bottomItems = [
  { label: "Account", path: "/account", icon: AccountIcon },
];

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="7" height="7" rx="1.5" />
      <rect x="10" y="1" width="7" height="4" rx="1.5" />
      <rect x="1" y="10" width="7" height="4" rx="1.5" />
      <rect x="10" y="7" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function PostsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h12M3 7.5h8M3 11h10M3 14.5h6" />
    </svg>
  );
}

function SiteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" />
      <path d="M1.5 6.5h15" />
      <circle cx="4" cy="4.5" r="0.5" fill="currentColor" />
      <circle cx="6" cy="4.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function MarketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M9 1v2M9 13v4M1 8h2M15 8h2" />
      <path d="M9 17s-6-4-6-9a6 6 0 0 1 12 0c0 5-6 9-6 9z" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="6" r="3.5" />
      <path d="M2.5 16.5c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
    </svg>
  );
}

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-sidebar flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald" />
        <span className="text-xl font-bold text-white tracking-tight">FindR</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
                  active
                    ? "text-white bg-white/5"
                    : "text-sidebar-foreground hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald" />
                )}
                <item.icon className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="my-4 mx-3 h-px bg-white/10" />

        <div className="space-y-0.5">
          {bottomItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
                  active
                    ? "text-white bg-white/5"
                    : "text-sidebar-foreground hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald" />
                )}
                <item.icon className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="px-5 py-5 border-t border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-white">
          SJ
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-white truncate">Sarah Jones</div>
          <div className="text-xs text-sidebar-foreground truncate">Realtor · Omaha</div>
        </div>
      </div>
    </aside>
  );
}
