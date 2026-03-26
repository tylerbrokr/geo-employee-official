import { AppSidebar } from "@/components/AppSidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <main
        className="flex-1 ml-[260px] min-h-screen"
        style={{
          background: `
            radial-gradient(ellipse at top right, rgba(5,150,105,0.06), transparent 50%),
            radial-gradient(ellipse at bottom left, rgba(15,23,42,0.03), transparent 60%),
            hsl(216 20% 95%)
          `,
        }}
      >
        <div className="max-w-[1100px] mx-auto px-10 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
