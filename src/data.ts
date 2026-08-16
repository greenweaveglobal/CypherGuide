import { Listing } from './types';

export const INITIAL_LISTINGS: Listing[] = [
  {
    id: 'LIST_ZEN_01',
    title: 'Anatta Zen Forest Sanctuary (RFC-0008 Dana Retreat)',
    description: 'A secluded forest monastery hermitage dedicated to mindfulness, digital detox, and stillness. Operating entirely on the Buddhist principle of Dana (voluntary offering / non-attachment). Off-grid solar power, natural spring water, and mesh relay connectivity.',
    imagePrompt: 'Zen forest hermitage with bamboo trees and stone lantern',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    meshCoordinates: 'mesh:11.94:108.45 (Da Lat Pine Valley)',
    priceSats: 0,
    priceModel: 'dana',
    maxGuests: 2,
    securitySpecs: [
      'Digital Detox',
      'Solar Off-Grid',
      'LoRa Mesh Node',
      'No-KYC Required',
      'Spring Water'
    ],
    coOwners: [
      {
        npub: 'npub1zenhermitage892348923478923478923478923478923478923478923478923478',
        name: 'Venerable Dhammapala (Host)',
        share: 100,
        lightningAddress: 'dana@cypherlodge.io'
      }
    ],
    status: 'available',
    reviews: [
      {
        id: 'rev_zen_01',
        guestNpub: 'npub1guestquietmind78923478923478923478923478923478923478923478923478',
        rating: 5,
        text: 'Practicing the 369s stillness ritual at sunset surrounded by pine forest was deeply healing. Truly grateful for the Dana stay.',
        signature: 'sig_mock_zen_proof_01',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
      }
    ]
  },
  {
    id: 'LIST_CYPHER_02',
    title: 'Faraday Bunker & Bitcoin Mesh Lab',
    description: 'High-security underground Cypherpunk homestay equipped with Starlink failover, RF shielded bedroom (Faraday cage), hardware multisig recovery station, and 24/7 dedicated Nostr relay node.',
    imagePrompt: 'Cyberpunk concrete loft with neon accents and server rack',
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    meshCoordinates: 'mesh:10.77:106.69 (Saigon District 1)',
    priceSats: 120000,
    priceModel: 'fixed',
    maxGuests: 2,
    securitySpecs: [
      'Faraday Shielding',
      'Dual Starlink Uplink',
      'Local Nostr Relay',
      'NUT-11 2-of-3 Escrow',
      'Zero-Log Routing'
    ],
    coOwners: [
      {
        npub: 'npub1cypherhost019283019283019283019283019283019283019283019283019283',
        name: 'Satoshi Nest (Primary Host)',
        share: 70,
        lightningAddress: 'host@cypherlodge.io'
      },
      {
        npub: 'npub1meshnodekeeper28301928301928301928301928301928301928301928301928',
        name: 'Mesh Maintainer',
        share: 30,
        lightningAddress: 'meshkeeper@cypherlodge.io'
      }
    ],
    status: 'available',
    reviews: [
      {
        id: 'rev_cypher_01',
        guestNpub: 'npub1guestalpha91823019283019283019283019283019283019283019283019283',
        rating: 5,
        text: 'Super solid Starlink speeds and the Faraday cage gave the most tranquil sleep with zero electromagnetic noise.',
        signature: 'sig_mock_cypher_proof_01',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
      }
    ]
  }
];

export const INITIAL_PROPOSALS: any[] = [];
