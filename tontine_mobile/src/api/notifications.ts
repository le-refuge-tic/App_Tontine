import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, notificationsDemo } from "./fixtures";
import { requete } from "./client";
import type { Notification } from "./types";

/** GET /notifications — notifications du membre. */
export async function listerNotifications(): Promise<Notification[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return notificationsDemo;
  }
  return requete<Notification[]>("/notifications");
}

/** PATCH /notifications/:id/lue — marque une notification comme lue. */
export async function marquerLue(id: number): Promise<void> {
  if (EST_MODE_DEMO) {
    await delaiDemo(150);
    return;
  }
  await requete<never>(`/notifications/${id}/lue`, { method: "PATCH" });
}
