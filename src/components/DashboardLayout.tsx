import { AppSidebar } from "@/components/AppSidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <main className="flex-1 ml-[260px] bg-background min-h-screen">
        <div className="max-w-[1100px] mx-auto px-10 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
