import useSWR from 'swr';
import { UserApplianceWithDetails } from '@/types/appliance';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch appliances');
  return res.json();
});

export function useAppliances() {
  const { data, error, isLoading, mutate } = useSWR<UserApplianceWithDetails[]>(
    '/api/appliances',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 60秒間は再リクエストしない
      errorRetryCount: 2,
    }
  );

  return {
    appliances: data || [],
    isLoading,
    error,
    refetch: mutate,
  };
}
