import webpush from "web-push";
import { prisma } from "../../config/db";
import { env } from "../../config/env";

export const pushEnabled = Boolean(env.vapidPublicKey && env.vapidPrivateKey);
if (pushEnabled) webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);

export async function notifyChantierAssignment(userId: string, chantier: { id: string; reference: string; name: string }): Promise<void> {
  if (!pushEnabled) return;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = JSON.stringify({ title: "Nouveau chantier affecté", body: `${chantier.reference} · ${chantier.name}`, url: `/chantiers/${chantier.id}` });
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } });
      else console.error("Échec de notification push", error);
    }
  }));
}
