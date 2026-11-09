import { queryOptions } from '@tanstack/react-query';
import { db } from '@/db/client';
import { getDashboard } from '@/db/dashboard';
import {
  getProfile,
  getSettings,
  listActivePlaySessions,
  listRecentHands,
} from '@/db/repositories';

export const profileQuery = queryOptions({
  queryKey: ['profile'],
  queryFn: () => getProfile(db),
});

export const settingsQuery = queryOptions({
  queryKey: ['settings'],
  queryFn: () => getSettings(db),
});

export const dashboardQuery = queryOptions({
  queryKey: ['dashboard'],
  queryFn: () => getDashboard(db),
});

export const activeSessionsQuery = queryOptions({
  queryKey: ['play-sessions', 'active'],
  queryFn: () => listActivePlaySessions(db),
});

export const handHistoryQuery = queryOptions({
  queryKey: ['hand-history'],
  queryFn: () => listRecentHands(db, 2000),
});
