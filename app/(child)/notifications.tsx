import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { NotificationsScreen } from '@/components/notifications/notifications-screen';
import { useChildNotifInbox } from '@/hooks/use-notification-inbox';

export default function ChildNotificationsScreen() {
  const router = useRouter();
  const { items, isLoading } = useChildNotifInbox();

  const handleBack = useCallback(() => router.back(), [router]);

  const handleNavigate = useCallback((route: string) => router.push(route as never), [router]);

  return (
    <NotificationsScreen
      items={items}
      isLoading={isLoading}
      onBack={handleBack}
      onNavigate={handleNavigate}
    />
  );
}
