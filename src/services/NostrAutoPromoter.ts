import { finalizeEvent } from 'nostr-tools';
import { useAppStore } from '../store/useAppStore';
import { hexToBytes } from '../utils/crypto';
import { translate } from '../hooks/useTranslation';

export function setupNostrAutoPromoter() {
  let previousListingsCount = useAppStore.getState().listings.length;

  useAppStore.subscribe((state) => {
    const currentListings = state.listings;
    // Check if a new listing was added
    if (currentListings.length > previousListingsCount) {
      // Find the difference (assuming new listings are added to the beginning)
      const newListing = currentListings[0];
      
      const { identity, addLog } = state;
      
      if (identity) {
        try {
          const secretKey = hexToBytes(identity.privKeyHex);
          const eventTemplate = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['t', 'cypherlodge'], ['t', 'homestay'], ['t', 'mesh']],
            content: translate('promoter.postContent', {
              title: newListing.title,
              coords: newListing.meshCoordinates,
              price: newListing.priceSats,
              id: newListing.id
            })
          };

          const signedEvent = finalizeEvent(eventTemplate, secretKey);
          
          console.log('[NostrAutoPromoter] Generated event:', signedEvent);
          addLog('relay', translate('promoter.broadcastSuccess', {
            title: newListing.title,
            id: signedEvent.id.slice(0, 8)
          }));
        } catch (error) {
          console.error('[NostrAutoPromoter] Error generating event:', error);
          addLog('relay', translate('promoter.broadcastError'));
        }
      } else {
        console.warn('[NostrAutoPromoter] No identity available to sign event.');
      }
      
      previousListingsCount = currentListings.length;
    } else if (currentListings.length < previousListingsCount) {
      previousListingsCount = currentListings.length;
    }
  });
}
