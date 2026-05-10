import { NavLink, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { label: "Clients", path: "/admin" },
  { label: "Posts Queue", path: "/admin/posts" },
  { label: "Change Requests", path: "/admin/change-requests" },
];

export function AdminLayout() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen flex">
      <aside
        className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50"
        style={{
          background: "linear-gradient(180deg, hsl(222 47% 11%) 0%, hsl(222 55% 7%) 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="px-6 py-6 flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald emerald-pulse" />
          <span className="text-xl font-bold text-white tracking-tight">GEO</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-sidebar-foreground bg-white/[0.08] px-1.5 py-0.5 rounded">Admin</span>
        </div>
        <nav className="flex-1 px-3 mt-2 space-y-0.5">
          {items.map((it) => {
            const active = it.path === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(it.path);
            return (
              <NavLink
                key={it.path}
                to={it.path}
                end={it.path === "/admin"}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative ${
                  active ? "text-white" : "text-sidebar-foreground hover:text-white hover:bg-white/[0.06]"
                }`}
                style={active ? { background: "linear-gradient(90deg, rgba(5,150,105,0.15) 0%, transparent 100%)" } : undefined}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald" />}
                {it.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-5 py-5 border-t border-white/[0.06]">
          <div className="text-xs text-sidebar-foreground truncate mb-2">{user?.email}</div>
          <button onClick={signOut} className="text-xs text-sidebar-foreground hover:text-white">Sign out</button>
        </div>
      </aside>
      <main
        className="flex-1 ml-[260px] min-h-screen"
        style={{
          background: `radial-gradient(ellipse at top right, rgba(5,150,105,0.06), transparent 50%), hsl(216 20% 95%)`,
        }}
      >
        <div className="max-w-[1200px] mx-auto px-10 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
