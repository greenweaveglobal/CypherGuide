import React from 'react';

/**
 * Resilient wrapper for React.lazy that retries dynamic import on transient network
 * or chunk loading failures (common in Cloud Run / container sleep cycles).
 */
export function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  intervalMs = 500
): React.LazyExoticComponent<T> {
  return React.lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((err) => {
            if (remaining > 0) {
              setTimeout(() => attempt(remaining - 1), intervalMs);
            } else {
              console.error('[Dynamic Import Failed]', err);
              reject(err);
            }
          });
      };
      attempt(retries);
    });
  });
}
