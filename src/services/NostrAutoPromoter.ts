import { finalizeEvent } from 'nostr-tools';
import { useAppStore } from '../store/useAppStore';
import { hexToBytes } from '../utils/crypto';

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
            content: `Vừa có một chỗ ở mới trên mạng lưới Cypherlodge Mesh: "${newListing.title}"!\n\n📍 ${newListing.meshCoordinates}\n💰 ${newListing.priceSats} Sats/đêm\n\nXem ngay: cypherlodge.io/l/${newListing.id}\n#cypherlodge #homestay`
          };

          const signedEvent = finalizeEvent(eventTemplate, secretKey);
          
          console.log('[NostrAutoPromoter] Generated event:', signedEvent);
          addLog('relay', `Auto-Promoter: Đã phát broadcast event Kind 1 quảng bá listing "${newListing.title}" (Event ID: ${signedEvent.id.slice(0, 8)}...)`);
        } catch (error) {
          console.error('[NostrAutoPromoter] Error generating event:', error);
          addLog('relay', `Auto-Promoter: Lỗi khi tạo Nostr event cho listing mới.`);
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
