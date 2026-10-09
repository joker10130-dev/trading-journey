import { redirect } from "next/navigation";
import DashboardClient from "@/app/dashboard/dashboard-client";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <DashboardClient user={user} />;
}
