import { useEffect, useState } from 'react';

// Loads one of the robot's data files. undefined = loading, null = not available.
export function useJson<T>(file: string): T | null | undefined {
  const [value, setValue] = useState<T | null>();
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setValue)
      .catch(() => setValue(null));
  }, [file]);
  return value;
}
