import React, { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  addNotificationListener, 
  addNotificationResponseListener, 
  useLastNotificationResponse 
} from '../lib/notifications';
import { useSubscription } from '../app/context/SubscriptionContext';
import InAppNotification from './InAppNotification';

export interface LocalNotification {
  title: string;
  body: string;
  imageUrl?: string;
  data?: any;
}

export default function NotificationManager() {
  const router = useRouter();
  const [activeNotification, setActiveNotification] = useState<LocalNotification | null>(null);
  const lastNotificationResponse = useLastNotificationResponse();
  const { isGuest, allMoviesFree } = useSubscription();

  // Handle notification response (tapping from background/killed state)
  useEffect(() => {
    if (lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;
      const actionId = lastNotificationResponse.actionIdentifier;
      
      // Filter promotional content for guests
      const isPromotional = data?.type === 'holiday' || data?.type === 'promotion' || (allMoviesFree && data?.type === 'alert');
      if (isGuest && isPromotional) return;

      if (data?.movieId) {
        setTimeout(() => {
          router.push({
            pathname: '/(tabs)',
            params: { movieId: String(data.movieId), autoplay: actionId === 'watch_now' ? 'true' : 'false' }
          });
        }, 500);
      }
    }
  }, [lastNotificationResponse, isGuest, allMoviesFree]);

  // Handle incoming notifications (foreground)
  useEffect(() => {
    // Listen for notifications while app is foregrounded
    const subscription = addNotificationListener(notification => {
      const content = notification.request.content;
      const data = content.data;

      // Ignore download progress notifications
      if (data?.type === 'download') return;

      // Protect promotional event notifications from appearing to guests
      // We assume that if holiday mode is active, any 'alert' or 'promotion' type is holiday-related
      const isPromotional = data?.type === 'holiday' || data?.type === 'promotion' || (allMoviesFree && data?.type === 'alert');
      
      if (isGuest && isPromotional) {
        console.log('Skipping promotional notification for guest');
        return;
      }

      setActiveNotification({
        title: content.title || 'Notification',
        body: content.body || '',
        imageUrl: data?.imageUrl || data?.image || (content.attachments?.[0]?.url),
        data: data
      });
    });

    // Listen for notification clicks (foreground state)
    const responseSubscription = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      const isPromotional = data?.type === 'holiday' || data?.type === 'promotion' || (allMoviesFree && data?.type === 'alert');
      if (isGuest && isPromotional) return;

      if (data?.movieId) {
        setTimeout(() => {
          router.push({
            pathname: '/(tabs)',
            params: { movieId: String(data.movieId), autoplay: actionId === 'watch_now' ? 'true' : 'false' }
          });
        }, 500);
      }
    });

    // Manual trigger for in-app notification banner (e.g. from app logic)
    const localNotifSub = DeviceEventEmitter.addListener("showLocalNotification", (notif: LocalNotification) => {
      // Manual triggers should probably be allowed, but we apply the same logic just in case
      const isPromotional = notif.data?.type === 'holiday' || notif.data?.type === 'promotion' || (allMoviesFree && notif.data?.type === 'alert');
      if (isGuest && isPromotional) return;
      
      setActiveNotification(notif);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
      localNotifSub.remove();
    };
  }, [isGuest, allMoviesFree]);

  return (
    <InAppNotification 
      notification={activeNotification} 
      onClose={() => setActiveNotification(null)} 
    />
  );
}
