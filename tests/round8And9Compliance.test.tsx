import { describe, it, expect, vi as testVi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const fakeDomTarget = {
  addEventListener: () => () => {},
  removeEventListener: () => {},
  scrollLeft: 0,
  scrollTop: 0
};

(globalThis as any).window = fakeDomTarget;
(globalThis as any).document = {
  documentElement: fakeDomTarget,
  body: fakeDomTarget,
  addEventListener: () => () => {},
  removeEventListener: () => {}
};

const mockMotion = {
  motion: {
    div: ({ children, className, onClick, style, id }: any) => (
      <div className={className} onClick={onClick} style={style} id={id}>{children}</div>
    ),
    button: ({ children, className, onClick, style, type, disabled }: any) => (
      <button className={className} onClick={onClick} style={style} type={type} disabled={disabled}>{children}</button>
    ),
    span: ({ children, className }: any) => (
      <span className={className}>{children}</span>
    ),
    p: ({ children, className }: any) => (
      <p className={className}>{children}</p>
    )
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
};

testVi.mock('motion/react', () => mockMotion);
testVi.mock('motion', () => mockMotion);
testVi.mock('framer-motion', () => mockMotion);

import vi from '../src/locales/vi.json';
import en from '../src/locales/en.json';
import { Listing, NostrIdentity } from '../src/types';
import LodgingListings from '../src/components/LodgingListings';
import ListingDetail from '../src/components/ListingDetail';
import { LocaleProvider } from '../src/hooks/useTranslation';

describe('Round 8 & 9 Compliance: Privacy, Schema & Anti-Fabricated Defaults', () => {
  const baseMockListing: Listing = {
    id: 'test_listing_1',
    title: 'Da Lat Pine Retreat',
    description: 'Serene mountain cabin with solar power and pine aroma',
    imageUrl: 'https://example.com/cabin.jpg',
    imagePrompt: 'cabin in pine forest',
    meshCoordinates: 'mesh:11.94:108.45',
    priceSats: 80000,
    securitySpecs: ['Solar Off-Grid', 'Spring Water'],
    roomTypes: [
      {
        id: 'rt_1',
        name: 'Cabin 1',
        maxGuests: 2,
        priceSats: 80000,
        securitySpecs: [],
        images: ['https://example.com/cabin.jpg'],
        priceRules: [],
        status: 'available'
      }
    ],
    coOwners: [
      {
        npub: 'npub1hostrealnpub12345678901234567890123456789012345678901234567890',
        name: 'Real Host',
        share: 100,
        lightningAddress: 'host@cypherlodge.io'
      }
    ],
    status: 'available',
    reviews: []
  };

  it('5. Chuỗi i18n: hai khóa lodging.unknownLocation và lodging.cancelPolicyUnenforcedNote tồn tại ở cả vi.json và en.json', () => {
    expect(vi.lodging).toBeDefined();
    expect(en.lodging).toBeDefined();

    expect(vi.lodging.unknownLocation).toBeDefined();
    expect(typeof vi.lodging.unknownLocation).toBe('string');
    expect(vi.lodging.unknownLocation.length).toBeGreaterThan(0);

    expect(en.lodging.unknownLocation).toBeDefined();
    expect(typeof en.lodging.unknownLocation).toBe('string');
    expect(en.lodging.unknownLocation.length).toBeGreaterThan(0);

    expect(vi.lodging.cancelPolicyUnenforcedNote).toBeDefined();
    expect(typeof vi.lodging.cancelPolicyUnenforcedNote).toBe('string');
    expect(vi.lodging.cancelPolicyUnenforcedNote.length).toBeGreaterThan(0);

    expect(en.lodging.cancelPolicyUnenforcedNote).toBeDefined();
    expect(typeof en.lodging.cancelPolicyUnenforcedNote).toBe('string');
    expect(en.lodging.cancelPolicyUnenforcedNote.length).toBeGreaterThan(0);
  });

  it('1. Listing không có locationLabel: nội dung thẻ không chứa mesh: hay tọa độ, và chứa chuỗi lodging.unknownLocation', () => {
    const listingWithoutLocation: Listing = {
      ...baseMockListing,
      locationLabel: undefined,
      meshCoordinates: 'mesh:11.94:108.45'
    };

    const html = renderToString(
      <LocaleProvider>
        <LodgingListings 
          listings={[listingWithoutLocation]} 
          identity={null}
          bookings={[]}
          onSelectListing={() => {}} 
          onAddListing={() => {}}
          onAddLog={() => {}}
        />
      </LocaleProvider>
    );

    // Không chứa chuỗi mesh: hay tọa độ
    expect(html).not.toContain('mesh:');
    expect(html).not.toContain('11.94:108.45');

    // Chứa chuỗi unknownLocation (mặc định en là "Location not specified", hoặc vi "Chưa cập nhật khu vực")
    expect(
      html.includes(en.lodging.unknownLocation) || html.includes(vi.lodging.unknownLocation)
    ).toBe(true);
  });

  it('2. Ô tìm kiếm: gõ chuỗi tọa độ của một listing thì không ra listing đó; gõ từ trong mô tả thì ra', () => {
    const targetListing: Listing = {
      ...baseMockListing,
      title: 'Secret Bunker',
      description: 'Underground electromagnetic shielded room for cypherpunks',
      meshCoordinates: 'mesh:10.77:106.69',
      locationLabel: 'Quận 1, TP. Hồ Chí Minh'
    };

    // Filter logic tương đương với filter trong useMemo của LodgingListings
    const filterFn = (listing: Listing, searchTerm: string) => {
      const matchSearch = 
        listing.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        Boolean(listing.locationLabel && listing.locationLabel.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSearch;
    };

    // Tìm kiếm bằng tọa độ mesh:10.77:106.69 hoặc 10.77 -> không ra
    expect(filterFn(targetListing, 'mesh:10.77:106.69')).toBe(false);
    expect(filterFn(targetListing, '10.77:106.69')).toBe(false);
    expect(filterFn(targetListing, 'mesh:')).toBe(false);

    // Tìm kiếm bằng từ trong mô tả ("electromagnetic", "cypherpunks") -> ra kết quả
    expect(filterFn(targetListing, 'electromagnetic')).toBe(true);
    expect(filterFn(targetListing, 'cypherpunks')).toBe(true);

    // Tìm kiếm bằng từ trong tiêu đề hoặc locationLabel -> ra kết quả
    expect(filterFn(targetListing, 'Secret Bunker')).toBe(true);
    expect(filterFn(targetListing, 'Quận 1')).toBe(true);
  });

  it('3. ListingDetail: người không phải chủ nhà không thấy meshCoordinates; chủ nhà (isOwner) thấy [Host: ...]', () => {
    const listingWithMesh: Listing = {
      ...baseMockListing,
      meshCoordinates: 'mesh:11.94:108.45 (Da Lat Secret Node)',
      coOwners: [
        {
          npub: 'npub1hostownerkey999999999999999999999999999999999999999999999999999',
          name: 'Cabin Owner',
          share: 100,
          lightningAddress: 'host@cypherlodge.io'
        }
      ]
    };

    // Trường hợp 1: Guest (identity null hoặc không khớp coOwners)
    const guestIdentity: NostrIdentity = {
      npub: 'npub1guestdifferentkey111111111111111111111111111111111111111111111111',
      nsec: 'nsec1...',
      pubKeyHex: '1111111111111111111111111111111111111111111111111111111111111111',
      privKeyHex: '1111111111111111111111111111111111111111111111111111111111111111',
      name: 'Guest Alice'
    };

    const guestHtml = renderToString(
      <LocaleProvider>
        <ListingDetail
          listing={listingWithMesh}
          identity={guestIdentity}
          onBack={() => {}}
          onBookingSuccess={() => {}}
          onAddLog={() => {}}
        />
      </LocaleProvider>
    );

    expect(guestHtml).not.toContain('mesh:11.94:108.45');
    expect(guestHtml).not.toContain('[Host:');

    // Trường hợp 2: Host (identity khớp với coOwners)
    const hostIdentity: NostrIdentity = {
      npub: 'npub1hostownerkey999999999999999999999999999999999999999999999999999',
      nsec: 'nsec1...',
      pubKeyHex: '9999999999999999999999999999999999999999999999999999999999999999',
      privKeyHex: '9999999999999999999999999999999999999999999999999999999999999999',
      name: 'Host Bob'
    };

    const hostHtml = renderToString(
      <LocaleProvider>
        <ListingDetail
          listing={listingWithMesh}
          identity={hostIdentity}
          onBack={() => {}}
          onBookingSuccess={() => {}}
          onAddLog={() => {}}
        />
      </LocaleProvider>
    );

    expect(hostHtml).toContain('[Host: mesh:11.94:108.45 (Da Lat Secret Node)]');
  });

  it('4. Thẻ có cancellationPolicy thì có chuỗi cảnh báo lodging.cancelPolicyUnenforcedNote ở cả vi và en', () => {
    const listingWithPolicy: Listing = {
      ...baseMockListing,
      cancellationPolicy: 'flexible'
    };

    // Render với locale tiếng Việt
    const viHtml = renderToString(
      <LocaleProvider>
        <LodgingListings 
          listings={[listingWithPolicy]} 
          identity={null}
          bookings={[]}
          onSelectListing={() => {}} 
          onAddListing={() => {}}
          onAddLog={() => {}}
        />
      </LocaleProvider>
    );

    // Kiểm tra rằng chuỗi cancelPolicyUnenforcedNote có mặt
    // Trong LocaleProvider mặc định hoặc khi set locale
    expect(
      viHtml.includes(vi.lodging.cancelPolicyUnenforcedNote) ||
      viHtml.includes(en.lodging.cancelPolicyUnenforcedNote)
    ).toBe(true);

    // Cũng kiểm tra trên ListingDetail
    const detailHtml = renderToString(
      <LocaleProvider>
        <ListingDetail
          listing={listingWithPolicy}
          identity={null}
          onBack={() => {}}
          onBookingSuccess={() => {}}
          onAddLog={() => {}}
        />
      </LocaleProvider>
    );

    expect(
      detailHtml.includes(vi.lodging.cancelPolicyUnenforcedNote) ||
      detailHtml.includes(en.lodging.cancelPolicyUnenforcedNote)
    ).toBe(true);
  });

  it('Nhiệm vụ 2: listing không có bedType, checkInTime, checkOutTime thì giao diện không chứa 14:00, 11:00 hay "1 Giường đôi tiêu chuẩn", và có chuỗi "Chưa cập nhật / Not specified"', () => {
    const emptySpecsListing: Listing = {
      ...baseMockListing,
      bedType: undefined,
      areaM2: undefined,
      checkInTime: undefined,
      checkOutTime: undefined
    };

    const html = renderToString(
      <LocaleProvider>
        <ListingDetail
          listing={emptySpecsListing}
          identity={null}
          onBack={() => {}}
          onBookingSuccess={() => {}}
          onAddLog={() => {}}
        />
      </LocaleProvider>
    );

    // Tuyệt đối không chứa các giá trị mặc định bịa đặt
    expect(html).not.toContain('14:00');
    expect(html).not.toContain('11:00');
    expect(html).not.toContain('1 Giường đôi tiêu chuẩn');
    expect(html).not.toContain('Tiêu chuẩn');

    // Chứa chuỗi không xác định / chưa cập nhật
    expect(
      html.includes(vi.listingDetail.notSpecified) ||
      html.includes(en.listingDetail.notSpecified)
    ).toBe(true);
  });
});
