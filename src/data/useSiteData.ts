import { useEffect, useState } from 'react';
import type { SiteData } from './types';
import { sampleData } from './sample';

// Loads the data the robot published. Falls back to sample data when there is none.
export function useSiteData(): SiteData | undefined {
  const [data, setData] = useState<SiteData>();
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/site.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SiteData) => setData(d))
      .catch(() => setData(sampleData));
  }, []);
  return data;
}

// Images saved by the robot live under the site root.
export const asset = (path?: string) => (path ? `${import.meta.env.BASE_URL}${path}` : undefined);
