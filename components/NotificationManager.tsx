import React, { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  addNotificationListener, 
  addNotificationResponseListener, 
  useLastNotificationResponse 
} from '../lib/notifications';
import { useSubscription } from '../app/context/SubscriptionContext';
import { useMovies } from '../app/context/MovieContext';
import { useUser } from '../app/context/UserContext';
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
  const { isGuest, allMoviesFree, setIsNotificationVisible, favorites, toggleFavorite } = useSubscription();
  const { movies: liveMovies, series: liveSeries } = useMovies();
  const { profile } = useUser();

  const findLinkedContent = (movieId?: string) => {
    if (!movieId) return null;
    return (
      liveMovies.find((m: any) => m.id === movieId) ||
      liveSeries.find((s: any) => s.id === movieId) ||
      null
    );
  };

  const isPromotionalNotification = (data: any) => (
    data?.type === 'holiday' ||
    data?.type === 'promotion' ||
    (allMoviesFree && data?.type === 'alert')
  );

  const isAllowedByPreferences = (data: any) => {
    const prefs = profile.notificationPrefs || {};
    const type = data?.type || data?.category;

    if ((type === 'movie_release' || type === 'new_release' || type === 'New Release') && prefs.newReleases === false) {
      return false;
    }
    if ((type === 'my_list' || type === 'myListUpdates') && prefs.myListUpdates === false) {
      return false;
    }
    if ((type === 'recommendation' || type === 'promotion') && prefs.recommendations === false) {
      return false;
    }
    if ((type === 'subscription' || type === 'billing' || type === 'account') && prefs.billingAccount === false) {
      return false;
    }

    return true;
  };

  const openLinkedContent = (data: any, autoplay = false) => {
    if (!data?.movieId) return;
    const movieId = String(data.movieId);
    const linkedContent = findLinkedContent(movieId);
    const isSeries = linkedContent && (
      'seasons' in (linkedContent as any) ||
      (linkedContent as any).type === 'Series' ||
      (linkedContent as any).type === 'series' ||
      (linkedContent as any).isMiniSeries
    );

    DeviceEventEmitter.emit("previewOpening");

    if (isSeries) {
      router.push({
        pathname: '/(tabs)/saved',
        params: { seriesId: movieId }
      });
      return;
    }

    router.push('/(tabs)' as any);
    if (linkedContent) {
      DeviceEventEmitter.emit("movieSelected", linkedContent);
      return;
    }

    router.push({
      pathname: '/(tabs)',
      params: { movieId, autoplay: autoplay ? 'true' : 'false' }
    });
  };

  const addLinkedContentToList = (data: any) => {
    if (!data?.movieId) return;
    const movieId = String(data.movieId);
    const linkedContent = findLinkedContent(movieId);
    const fallbackContent = {
      id: movieId,
      title: data.title || data.movieTitle || 'Saved title',
      poster: data.imageUrl || data.image || '',
      type: data.contentType || data.type || 'movie',
    };
    const content = linkedContent || fallbackContent;

    if (!favorites.some((item: any) => item.id === movieId)) {
      toggleFavorite(content as any);
    }
  };

  const handleNotificationAction = (data: any, actionId?: string) => {
    if (!data || data?.type === 'download' || !isAllowedByPreferences(data)) return;
    if (isGuest && isPromotionalNotification(data)) return;

    if (actionId === 'dismiss') return;
    if (actionId === 'add_to_list') {
      addLinkedContentToList(data);
      return;
    }

    if (data?.movieId) {
      setTimeout(() => {
        openLinkedContent(data, actionId === 'watch_now');
      }, 500);
    }
  };

  // Sync with global state
  useEffect(() => {
    setIsNotificationVisible(activeNotification !== null);
  }, [activeNotification, setIsNotificationVisible]);

  // Handle notification response (tapping from background/killed state)
  useEffect(() => {
    if (lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;
      const actionId = lastNotificationResponse.actionIdentifier;
      handleNotificationAction(data, actionId);
    }
  }, [lastNotificationResponse, isGuest, allMoviesFree, liveMovies, liveSeries, favorites, profile.notificationPrefs]);

  // Handle incoming notifications (foreground)
  useEffect(() => {
    // Listen for notifications while app is foregrounded
    const subscription = addNotificationListener(notification => {
      const content = notification.request.content;
      const data = content.data;

      // Ignore download progress notifications
      if (data?.type === 'download' || !isAllowedByPreferences(data)) return;

      // Protect promotional event notifications from appearing to guests
      // We assume that if holiday mode is active, any 'alert' or 'promotion' type is holiday-related
      if (isGuest && isPromotionalNotification(data)) {
        console.log('Skipping promotional notification for guest');
        return;
      }

      const mid = data?.movieId;
      const linkedMovie = mid ? (liveMovies.find((m: any) => m.id === mid) || liveSeries.find((s: any) => s.id === mid)) : null;

      setActiveNotification({
        title: content.title || 'Notification',
        body: content.body || '',
        imageUrl: data?.imageUrl || data?.image || (content.attachments?.[0]?.url) || linkedMovie?.poster,
        data: data
      });
    });

    // Listen for notification clicks (foreground state)
    const responseSubscription = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;
      handleNotificationAction(data, actionId);
    });

    // Manual trigger for in-app notification banner (e.g. from app logic)
    const localNotifSub = DeviceEventEmitter.addListener("showLocalNotification", (notif: LocalNotification) => {
      // Manual triggers should probably be allowed, but we apply the same logic just in case
      if (isGuest && isPromotionalNotification(notif.data)) return;
      if (!isAllowedByPreferences(notif.data)) return;
      
      setActiveNotification(notif);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
      localNotifSub.remove();
    };
  }, [isGuest, allMoviesFree, liveMovies, liveSeries, favorites, profile.notificationPrefs]);

  return (
    <InAppNotification 
      notification={activeNotification} 
      onClose={() => setActiveNotification(null)} 
      onAddToList={(notification) => addLinkedContentToList(notification.data)}
    />
  );
}
