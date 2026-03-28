import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the limits per plan type
const planLimits: Record<string, number> = {
  '1 week': 3,
  '2 week': 5,
  '1 Month': 10,
  '2 months': 20,
  'Premium': 20,
  'None': 0
};

interface SubscriptionContextType {
  subscriptionBundle: string;
  setSubscriptionBundle: (bundle: string) => void;
  downloadsUsedToday: number;
  recordExternalDownload: (movieTitle: string) => { success: boolean, message: string }; 
  recordInAppDownload: (movieTitle: string) => { success: boolean, message: string };
  getExternalDownloadLimit: () => number;
  getRemainingDownloads: () => number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscriptionBundle, setSubscriptionBundle] = useState('2 week');
  const [downloadsUsedToday, setDownloadsUsedToday] = useState(0);
  const [lastDownloadDate, setLastDownloadDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const getExternalDownloadLimit = () => {
    return planLimits[subscriptionBundle] || 0;
  };

  const getRemainingDownloads = () => {
    return Math.max(0, getExternalDownloadLimit() - downloadsUsedToday);
  };

  const recordExternalDownload = (movieTitle: string) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Day reset logic
    let currentUsed = downloadsUsedToday;
    if (lastDownloadDate !== today) {
      currentUsed = 0;
      setDownloadsUsedToday(0);
      setLastDownloadDate(today);
    }

    const limit = getExternalDownloadLimit();
    if (currentUsed < limit) {
      setDownloadsUsedToday(currentUsed + 1);
      return { 
        success: true, 
        message: `"${movieTitle}" is being saved to your phone storage (MP4).\nRemaining today: ${limit - (currentUsed + 1)}` 
      };
    }
    return { 
      success: false, 
      message: `Daily Limit Reached: You've used your ${limit} external downloads for today. In-app downloads remain unlimited!` 
    };
  };

  const recordInAppDownload = (movieTitle: string) => {
    return { 
      success: true, 
      message: `"${movieTitle}" saved to secure app storage for offline viewing. This file is hidden from your gallery.` 
    };
  };

  return (
    <SubscriptionContext.Provider value={{
      subscriptionBundle,
      setSubscriptionBundle,
      downloadsUsedToday,
      recordExternalDownload,
      recordInAppDownload,
      getExternalDownloadLimit,
      getRemainingDownloads
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
