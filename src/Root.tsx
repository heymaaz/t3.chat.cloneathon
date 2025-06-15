import AppLayout from "@/components/app-layout";
import { Outlet } from "@tanstack/react-router";

export function Root() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
