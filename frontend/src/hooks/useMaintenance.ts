import useSWR from 'swr';
import {
  MaintenanceWithAppliance,
  MaintenanceCounts,
  MaintenanceListResponse,
} from '@/types/appliance';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch maintenance');
  return res.json();
});

export function useMaintenance(status?: string) {
  const url = status
    ? `/api/maintenance?status=${status}`
    : '/api/maintenance';

  const { data, error, isLoading, mutate } = useSWR<MaintenanceListResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      errorRetryCount: 2,
    }
  );

  return {
    items: data?.items || [],
    counts: data?.counts || { overdue: 0, upcoming: 0, scheduled: 0, manual: 0, total: 0 },
    isLoading,
    error,
    refetch: mutate,
  };
}
