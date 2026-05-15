'use client';

import { createContext, useContext } from 'react';
import type { UserProfile } from '@/types';

const UserProfileContext = createContext<UserProfile | null>(null);

export function UserProfileProvider({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <UserProfileContext.Provider value={profile}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfile {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be called within UserProfileProvider');
  return ctx;
}
