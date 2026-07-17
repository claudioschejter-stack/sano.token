import { prisma } from '@sanova/database';

export type NotificationType =
  | 'kyc_approved'
  | 'purchase_confirmed'
  | 'withdrawal_confirmed'
  | 'withdrawal_rejected';

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link
    }
  });
}

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false }
  });
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() }
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() }
  });
}
