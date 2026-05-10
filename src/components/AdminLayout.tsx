import { NavLink, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BrandLockup } from "./BrandMark";

const items = [
  { label: "Clients", path: "/admin", end: true },
  { label: "Posts queue", path: "/admin/posts" },
  { label: "Change requests", path: "/admin/change-requests" },
  { label: "Emails", path: "/admin/emails" },
];

export function AdminLayout() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen flex bg-white">
      <aside className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50 bg-white border-r border-ink/[0.08]">
        {/* Logo lockup with admin label */}
        <div className="px-5 py-7 flex items-center justify-between">
          <BrandLockup markSize={26} wordmarkSize={20} />
          <span className="section-label">Admin</span>
        </div>

        <div className="fading-divider mx-5" />

        <nav className="flex-1 mt-5">
          <div className="space-y-px">
            {items.map((it) => {
              const active = it.end
                ? location.pathname === it.path
                : location.pathname.startsWith(it.path);
              return (
                <NavLink
                  key={it.path}
                  to={it.path}
                  end={it.end}
                  className={`relative flex items-center gap-3 px-5 py-2.5 font-ui text-[13px] transition-opacity duration-150 ${
                    active ? "text-ink" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-gold" />}
                  {it.label}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="px-5 py-5 border-t border-ink/[0.08]">
          <div className="font-ui text-[11px] text-ink/50 truncate mb-2">{user?.email}</div>
          <button
            onClick={signOut}
            className="font-ui text-[12px] text-ink/50 hover:text-ink transition-opacity"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-[260px] min-h-screen bg-white">
        <div className="max-w-[1100px] mx-auto px-10 py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
