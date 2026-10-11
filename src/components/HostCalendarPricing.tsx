import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Zap, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Sliders, 
  Sparkles, 
  Clock, 
  AlertCircle,
  FileCheck,
  Tag,
  Info,
  Layers,
  ArrowRight,
  DoorOpen
} from 'lucide-react';
import { Listing, NostrIdentity, Booking, PriceRule, PriceRuleType, Proposal, EditHistoryEntry, RoomType } from '../types';
import { getEffectivePrice, getEffectivePriceRule, DAY_OF_WEEK_LABELS, getDayLabel, parseDate, migrateListingToRoomTypes } from '../utils/pricing';
import { signMessage, sha256 } from '../utils/crypto';
import { useTranslation } from '../hooks/useTranslation';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface Props {
  listings: Listing[];
  identity: NostrIdentity | null;
  bookings: Booking[];
  initialListingId?: string;
  onUpdateListing: (listing: Listing) => void;
  onAddProposal: (proposal: Proposal) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export const canEditDirectly = (listing: Listing, identity: NostrIdentity | null): boolean => {
  if (!identity || !listing.coOwners || listing.coOwners.length !== 1) return false;
  const owner = listing.coOwners[0];
  return owner.share === 100 && owner.npub === identity.npub;
};

export default function HostCalendarPricing({
  listings,
  identity,
  bookings,
  initialListingId,
  onUpdateListing,
  onAddProposal,
  onAddLog
}: Props) {
  const { t } = useTranslation();

  // Host listings filter
  const hostListings = useMemo(() => {
    return listings.filter(l => 
      !identity ? true : l.coOwners?.some(co => co.npub === identity.npub)
    );
  }, [listings, identity]);

  const [selectedListingId, setSelectedListingId] = useState<string>(
    initialListingId || hostListings[0]?.id || listings[0]?.id || ''
  );

  React.useEffect(() => {
    if (initialListingId) {
      setSelectedListingId(initialListingId);
    }
  }, [initialListingId]);

  const selectedListing = useMemo(() => {
    const raw = listings.find(l => l.id === selectedListingId) || listings[0];
    return raw ? migrateListingToRoomTypes(raw) : raw;
  }, [listings, selectedListingId]);

  // Calendar view state (year & month: 0-11)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 1)); // Default Sept 2026

  // Room Types draft state
  const [draftRoomTypes, setDraftRoomTypes] = useState<RoomType[]>(selectedListing?.roomTypes || []);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>(
    selectedListing?.roomTypes?.[0]?.id || ''
  );

  // Active room draft fields (Group A room-level)
  const [draftRoomName, setDraftRoomName] = useState<string>(selectedListing?.roomTypes?.[0]?.name || '');
  const [draftPriceSats, setDraftPriceSats] = useState<number>(selectedListing?.roomTypes?.[0]?.priceSats || 100000);
  const [draftMaxGuests, setDraftMaxGuests] = useState<number>(selectedListing?.roomTypes?.[0]?.maxGuests || 2);
  const [draftRoomSpecsStr, setDraftRoomSpecsStr] = useState<string>(
    (selectedListing?.roomTypes?.[0]?.securitySpecs || []).join(', ')
  );
  const [draftStatus, setDraftStatus] = useState<'available' | 'occupied'>(
    selectedListing?.roomTypes?.[0]?.status === 'occupied' ? 'occupied' : 'available'
  );
  const [draftRules, setDraftRules] = useState<PriceRule[]>(selectedListing?.roomTypes?.[0]?.priceRules || []);

  // Property-wide draft fields (Group B & general)
  const [draftDesc, setDraftDesc] = useState<string>(selectedListing?.description || '');
  const [draftImageUrl, setDraftImageUrl] = useState<string>(selectedListing?.imageUrl || '');
  const [draftTitle, setDraftTitle] = useState<string>(selectedListing?.title || '');
  const [draftVerifiersStr, setDraftVerifiersStr] = useState<string>(
    (selectedListing?.acceptedKycVerifiers || []).join(', ')
  );
  const [draftKycThreshold, setDraftKycThreshold] = useState<number>(
    selectedListing?.kycThresholdSats || 0
  );

  // Sync draft when selectedListing changes
  React.useEffect(() => {
    if (selectedListing) {
      const rts = selectedListing.roomTypes || [];
      setDraftRoomTypes(rts);
      const initialRt = rts[0];
      if (initialRt) {
        setSelectedRoomTypeId(initialRt.id);
        setDraftRoomName(initialRt.name);
        setDraftPriceSats(initialRt.priceSats);
        setDraftMaxGuests(initialRt.maxGuests || 2);
        setDraftRoomSpecsStr((initialRt.securitySpecs || []).join(', '));
        setDraftStatus(initialRt.status === 'occupied' ? 'occupied' : 'available');
        setDraftRules(initialRt.priceRules || []);
      }
      setDraftDesc(selectedListing.description);
      setDraftImageUrl(selectedListing.imageUrl);
      setDraftTitle(selectedListing.title);
      setDraftVerifiersStr((selectedListing.acceptedKycVerifiers || []).join(', '));
      setDraftKycThreshold(selectedListing.kycThresholdSats || 0);
    }
  }, [selectedListing?.id]);

  // Ownership & Risk Assessment
  const isSoloListing = useMemo(() => {
    if (!selectedListing || !selectedListing.coOwners) return false;
    return selectedListing.coOwners.length === 1 && selectedListing.coOwners[0].share === 100;
  }, [selectedListing]);

  const hasDirectEditAccess = useMemo(() => {
    if (!selectedListing) return false;
    return canEditDirectly(selectedListing, identity);
  }, [selectedListing, identity]);

  const soloOwner = selectedListing?.coOwners && selectedListing.coOwners.length === 1 ? selectedListing.coOwners[0] : null;
  const soloOwnerShortNpub = soloOwner ? `${soloOwner.npub.slice(0, 10)}...${soloOwner.npub.slice(-4)}` : '';

  const isUnauthorizedSolo = isSoloListing && !hasDirectEditAccess;

  // Active bookings check for Group B protection
  const activeBookings = useMemo(() => {
    if (!selectedListing) return [];
    return bookings.filter(b => 
      b.listingId === selectedListing.id && 
      (b.status === 'paid' || b.status === 'checked_in' || b.status === 'pending')
    );
  }, [bookings, selectedListing]);

  const isGroupBBlocked = activeBookings.length > 0;

  // Switch active Room Type with in-memory sync
  const handleSelectRoomType = (newId: string) => {
    if (newId === selectedRoomTypeId) return;

    const updatedRoomTypes = draftRoomTypes.map(rt => {
      if (rt.id === selectedRoomTypeId) {
        return {
          ...rt,
          name: draftRoomName.trim() || rt.name,
          priceSats: Number(draftPriceSats),
          maxGuests: Number(draftMaxGuests),
          securitySpecs: draftRoomSpecsStr.split(',').map(s => s.trim()).filter(Boolean),
          status: draftStatus,
          priceRules: draftRules
        };
      }
      return rt;
    });

    setDraftRoomTypes(updatedRoomTypes);

    const target = updatedRoomTypes.find(rt => rt.id === newId) || updatedRoomTypes[0];
    if (target) {
      setSelectedRoomTypeId(target.id);
      setDraftRoomName(target.name);
      setDraftPriceSats(target.priceSats);
      setDraftMaxGuests(target.maxGuests || 2);
      setDraftRoomSpecsStr((target.securitySpecs || []).join(', '));
      setDraftStatus(target.status === 'occupied' ? 'occupied' : 'available');
      setDraftRules(target.priceRules || []);
    }
  };

  // Add new Room Type
  const handleAddRoomType = () => {
    if (isUnauthorizedSolo) return;
    const currentFlushed = draftRoomTypes.map(rt => {
      if (rt.id === selectedRoomTypeId) {
        return {
          ...rt,
          name: draftRoomName.trim() || rt.name,
          priceSats: Number(draftPriceSats),
          maxGuests: Number(draftMaxGuests),
          securitySpecs: draftRoomSpecsStr.split(',').map(s => s.trim()).filter(Boolean),
          status: draftStatus,
          priceRules: draftRules
        };
      }
      return rt;
    });

    const newId = `rt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newRoom: RoomType = {
      id: newId,
      name: t('hostCalendar.newRoomDefaultName', { n: draftRoomTypes.length + 1 }),
      maxGuests: 2,
      priceSats: 100000,
      securitySpecs: [],
      priceRules: [],
      status: 'available'
    };

    const nextRoomTypes = [...currentFlushed, newRoom];
    setDraftRoomTypes(nextRoomTypes);
    setSelectedRoomTypeId(newId);
    setDraftRoomName(newRoom.name);
    setDraftPriceSats(newRoom.priceSats);
    setDraftMaxGuests(newRoom.maxGuests);
    setDraftRoomSpecsStr('');
    setDraftStatus('available');
    setDraftRules([]);
    setStatusNotice({
      message: t('hostCalendar.createdRoomNotice', { name: newRoom.name }),
      type: 'success'
    });
  };

  // Remove Room Type
  const handleDeleteRoomType = (roomTypeId: string) => {
    if (isUnauthorizedSolo) return;
    if (draftRoomTypes.length <= 1) {
      setStatusNotice({ message: t('hostCalendar.errMinOneRoom'), type: 'error' });
      return;
    }
    const remaining = draftRoomTypes.filter(rt => rt.id !== roomTypeId);
    setDraftRoomTypes(remaining);
    if (selectedRoomTypeId === roomTypeId) {
      const nextTarget = remaining[0];
      setSelectedRoomTypeId(nextTarget.id);
      setDraftRoomName(nextTarget.name);
      setDraftPriceSats(nextTarget.priceSats);
      setDraftMaxGuests(nextTarget.maxGuests || 2);
      setDraftRoomSpecsStr((nextTarget.securitySpecs || []).join(', '));
      setDraftStatus(nextTarget.status === 'occupied' ? 'occupied' : 'available');
      setDraftRules(nextTarget.priceRules || []);
    }
    setStatusNotice({ message: t('hostCalendar.removedRoomDraftNotice'), type: 'success' });
  };

  // New Rule form state
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [ruleLabel, setRuleLabel] = useState('');
  const [ruleType, setRuleType] = useState<PriceRuleType>('day_of_week');
  const [ruleStartDate, setRuleStartDate] = useState('2026-09-15');
  const [ruleEndDate, setRuleEndDate] = useState('2026-09-20');
  const [ruleDaysOfWeek, setRuleDaysOfWeek] = useState<string[]>(['SA', 'SU']);
  const [ruleStartMonth, setRuleStartMonth] = useState<number>(1);
  const [ruleEndMonth, setRuleEndMonth] = useState<number>(2);
  const [rulePriceSats, setRulePriceSats] = useState<number>(135000);
  const [rulePriority, setRulePriority] = useState<number>(10);

  // Signing feedback
  const [isSigning, setIsSigning] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Temporary preview listing with current active room draft rules and base price
  const previewListing: Listing = useMemo(() => {
    return {
      ...selectedListing,
      priceSats: draftPriceSats,
      priceRules: draftRules
    };
  }, [selectedListing, draftPriceSats, draftRules]);

  // Calendar calculation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateNumber: number;
      dateObj: Date;
      isCurrentMonth: boolean;
      effectivePrice: number;
      rule: PriceRule | null;
      isToday: boolean;
    }> = [];

    // Pad before
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        dateNumber: prevMonthDays - i,
        dateObj: d,
        isCurrentMonth: false,
        effectivePrice: getEffectivePrice(previewListing, d),
        rule: getEffectivePriceRule(previewListing, d),
        isToday: false
      });
    }

    // Days in current month
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const isToday = 
        today.getFullYear() === year && 
        today.getMonth() === month && 
        today.getDate() === i;

      days.push({
        dateNumber: i,
        dateObj: d,
        isCurrentMonth: true,
        effectivePrice: getEffectivePrice(previewListing, d),
        rule: getEffectivePriceRule(previewListing, d),
        isToday
      });
    }

    // Pad after to complete full 7-day rows (up to 35 or 42)
    const totalSlots = Math.ceil(days.length / 7) * 7;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        dateNumber: i,
        dateObj: d,
        isCurrentMonth: false,
        effectivePrice: getEffectivePrice(previewListing, d),
        rule: getEffectivePriceRule(previewListing, d),
        isToday: false
      });
    }

    return days;
  }, [currentDate, previewListing]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Add rule handler
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUnauthorizedSolo) {
      setStatusNotice({
        message: t('hostCalendar.notOwnerWarning', { npub: soloOwnerShortNpub }),
        type: 'error'
      });
      return;
    }
    if (!ruleLabel.trim() || rulePriceSats <= 0) return;

    const newRule: PriceRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: ruleLabel.trim(),
      type: ruleType,
      priceSats: Number(rulePriceSats),
      priority: Number(rulePriority) || 10
    };

    if (ruleType === 'date_range') {
      newRule.startDate = ruleStartDate;
      newRule.endDate = ruleEndDate;
    } else if (ruleType === 'day_of_week') {
      newRule.daysOfWeek = ruleDaysOfWeek;
    } else if (ruleType === 'recurring_month') {
      newRule.startMonth = Number(ruleStartMonth);
      newRule.endMonth = Number(ruleEndMonth);
    }

    setDraftRules(prev => [...prev, newRule]);
    setRuleLabel('');
    setShowAddRuleForm(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (isUnauthorizedSolo) return;
    setDraftRules(prev => prev.filter(r => r.id !== ruleId));
  };

  // Active composed room types (including current in-form draft edits)
  const currentFullRoomTypes: RoomType[] = useMemo(() => {
    return draftRoomTypes.map(rt => {
      if (rt.id === selectedRoomTypeId) {
        return {
          ...rt,
          name: draftRoomName.trim() || rt.name,
          priceSats: Number(draftPriceSats),
          maxGuests: Number(draftMaxGuests),
          securitySpecs: draftRoomSpecsStr.split(',').map(s => s.trim()).filter(Boolean),
          status: draftStatus,
          priceRules: draftRules
        };
      }
      return rt;
    });
  }, [draftRoomTypes, selectedRoomTypeId, draftRoomName, draftPriceSats, draftMaxGuests, draftRoomSpecsStr, draftStatus, draftRules]);

  // Detect changed fields between draft and selectedListing
  const changes = useMemo(() => {
    const listA: Array<{ field: string; label: string; oldVal: string; newVal: string }> = [];
    const listB: Array<{ field: string; label: string; oldVal: string; newVal: string }> = [];

    // Room Types changes
    const originalRoomTypes = selectedListing.roomTypes || [];
    if (currentFullRoomTypes.length !== originalRoomTypes.length) {
      listA.push({
        field: 'roomTypesCount',
        label: t('hostCalendar.diffRoomTypesList'),
        oldVal: t('hostCalendar.diffCountRooms', { count: originalRoomTypes.length }),
        newVal: t('hostCalendar.diffCountRooms', { count: currentFullRoomTypes.length })
      });
    }

    currentFullRoomTypes.forEach((rt) => {
      const orig = originalRoomTypes.find(o => o.id === rt.id);
      if (!orig) {
        listA.push({
          field: `roomType_${rt.id}_new`,
          label: t('hostCalendar.diffAddRoom', { name: rt.name }),
          oldVal: t('hostCalendar.diffNotSet'),
          newVal: t('hostCalendar.diffRoomSummary', { sats: rt.priceSats.toLocaleString(), guests: rt.maxGuests })
        });
      } else {
        if (orig.name !== rt.name) {
          listA.push({
            field: `roomType_${rt.id}_name`,
            label: t('hostCalendar.diffRoomName', { name: orig.name }),
            oldVal: orig.name,
            newVal: rt.name
          });
        }
        if (orig.priceSats !== rt.priceSats) {
          listA.push({
            field: `roomType_${rt.id}_price`,
            label: t('hostCalendar.diffBasePrice', { name: rt.name }),
            oldVal: `${orig.priceSats.toLocaleString()} Sats`,
            newVal: `${rt.priceSats.toLocaleString()} Sats`
          });
        }
        if (JSON.stringify(orig.priceRules || []) !== JSON.stringify(rt.priceRules || [])) {
          listA.push({
            field: `roomType_${rt.id}_rules`,
            label: t('hostCalendar.diffPriceRules', { name: rt.name }),
            oldVal: t('hostCalendar.diffRulesCount', { count: (orig.priceRules || []).length }),
            newVal: t('hostCalendar.diffRulesCount', { count: (rt.priceRules || []).length })
          });
        }
        if (orig.status !== rt.status) {
          listA.push({
            field: `roomType_${rt.id}_status`,
            label: t('hostCalendar.diffRoomStatus', { name: rt.name }),
            oldVal: orig.status || 'available',
            newVal: rt.status
          });
        }
        if (JSON.stringify(orig.securitySpecs || []) !== JSON.stringify(rt.securitySpecs || [])) {
          listA.push({
            field: `roomType_${rt.id}_specs`,
            label: t('hostCalendar.diffRoomSpecs', { name: rt.name }),
            oldVal: (orig.securitySpecs || []).join(', ') || t('hostCalendar.diffNone'),
            newVal: (rt.securitySpecs || []).join(', ') || t('hostCalendar.diffNone')
          });
        }
        if (orig.maxGuests !== rt.maxGuests) {
          listB.push({
            field: `roomType_${rt.id}_maxGuests`,
            label: t('hostCalendar.diffRoomCapacity', { name: rt.name }),
            oldVal: t('hostCalendar.diffGuestsCount', { count: orig.maxGuests }),
            newVal: t('hostCalendar.diffGuestsCount', { count: rt.maxGuests })
          });
        }
      }
    });

    originalRoomTypes.forEach(orig => {
      if (!currentFullRoomTypes.some(rt => rt.id === orig.id)) {
        listA.push({
          field: `roomType_${orig.id}_deleted`,
          label: t('hostCalendar.diffRemoveRoom', { name: orig.name }),
          oldVal: orig.name,
          newVal: t('hostCalendar.diffDeleted')
        });
      }
    });

    // Group A (Property-level)
    if (draftDesc.trim() !== selectedListing.description.trim()) {
      listA.push({
        field: 'description',
        label: t('hostCalendar.diffDesc'),
        oldVal: selectedListing.description.slice(0, 30) + '...',
        newVal: draftDesc.slice(0, 30) + '...'
      });
    }

    if (draftImageUrl.trim() !== selectedListing.imageUrl.trim()) {
      listA.push({
        field: 'imageUrl',
        label: t('hostCalendar.diffCoverImg'),
        oldVal: selectedListing.imageUrl.slice(0, 30) + '...',
        newVal: draftImageUrl.slice(0, 30) + '...'
      });
    }

    // Group B (Property-level)
    if (draftTitle.trim() !== selectedListing.title.trim()) {
      listB.push({
        field: 'title',
        label: t('hostCalendar.diffTitle'),
        oldVal: selectedListing.title,
        newVal: draftTitle.trim()
      });
    }

    const currentVerifiers = (selectedListing.acceptedKycVerifiers || []).join(', ');
    if (draftVerifiersStr.trim() !== currentVerifiers.trim()) {
      listB.push({
        field: 'acceptedKycVerifiers',
        label: t('hostCalendar.diffKycVerifiers'),
        oldVal: currentVerifiers || t('hostCalendar.diffNone'),
        newVal: draftVerifiersStr || t('hostCalendar.diffNone')
      });
    }

    if (draftKycThreshold !== (selectedListing.kycThresholdSats || 0)) {
      listB.push({
        field: 'kycThresholdSats',
        label: t('hostCalendar.diffKycThreshold'),
        oldVal: `${(selectedListing.kycThresholdSats || 0).toLocaleString()} Sats`,
        newVal: `${draftKycThreshold.toLocaleString()} Sats`
      });
    }

    return { listA, listB, hasChanges: listA.length > 0 || listB.length > 0 };
  }, [
    currentFullRoomTypes,
    draftDesc,
    draftImageUrl,
    draftTitle,
    draftVerifiersStr,
    draftKycThreshold,
    selectedListing
  ]);

  // Sign and apply changes
  const handleSignAndApply = async () => {
    if (!identity) {
      setStatusNotice({ message: t('hostCalendar.errConnectNostr'), type: 'error' });
      return;
    }

    if (isUnauthorizedSolo) {
      setStatusNotice({
        message: t('hostCalendar.notOwnerWarning', { npub: soloOwnerShortNpub }),
        type: 'error'
      });
      return;
    }

    if (!changes.hasChanges) {
      setStatusNotice({ message: t('hostCalendar.noChangesNotice'), type: 'error' });
      return;
    }

    if (changes.listB.length > 0 && isGroupBBlocked) {
      setStatusNotice({
        message: t('hostCalendar.errGroupBLockedActive'),
        type: 'error'
      });
      return;
    }

    setIsSigning(true);
    setStatusNotice(null);

    try {
      const timestamp = Date.now();
      const changePayload = JSON.stringify({
        listingId: selectedListing.id,
        hostNpub: identity.npub,
        timestamp,
        changesA: changes.listA,
        changesB: changes.listB
      });

      const hash = await sha256(changePayload);
      const signature = await signMessage(hash, identity);

      // Create editHistory entries
      const newHistoryEntries: EditHistoryEntry[] = [
        ...changes.listA,
        ...changes.listB
      ].map(c => ({
        timestamp,
        editedBy: identity.npub,
        field: c.label,
        oldValue: c.oldVal,
        newValue: c.newVal,
        signature
      }));

      const parsedVerifiers = draftVerifiersStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const updatedListing: Listing = {
        ...selectedListing,
        roomTypes: currentFullRoomTypes,
        // Backward compatibility sync
        priceSats: currentFullRoomTypes[0]?.priceSats || 0,
        maxGuests: currentFullRoomTypes[0]?.maxGuests || 2,
        priceRules: currentFullRoomTypes[0]?.priceRules || [],
        description: draftDesc.trim(),
        imageUrl: draftImageUrl.trim(),
        status: currentFullRoomTypes.some(rt => rt.status === 'available') ? 'available' : 'occupied',
        title: draftTitle.trim(),
        acceptedKycVerifiers: parsedVerifiers.length > 0 ? parsedVerifiers : undefined,
        kycThresholdSats: Number(draftKycThreshold) > 0 ? Number(draftKycThreshold) : undefined,
        editHistory: [...(selectedListing.editHistory || []), ...newHistoryEntries]
      };

      if (hasDirectEditAccess) {
        // Solo host
        if (changes.listB.length === 0) {
          // Only Group A changes: Direct apply
          onUpdateListing(updatedListing);
          onAddLog(
            'relay',
            t('hostCalendar.auditLogSoloApplied', { host: identity.name || identity.npub.slice(0, 10), count: changes.listA.length, title: selectedListing.title }),
            signature
          );
          setStatusNotice({
            message: t('hostCalendar.msgSoloApplied'),
            type: 'success'
          });
        } else {
          // Group B changes: create solo governance proposal and auto-approve
          const propId = `prop_solo_${Date.now()}`;
          const soloProposal: Proposal = {
            id: propId,
            listingId: selectedListing.id,
            listingTitle: selectedListing.title,
            title: t('hostCalendar.titleSoloB', { labels: changes.listB.map(b => b.label).join(', ') }),
            description: `${t('hostCalendar.descSoloB')}\n${changes.listB.map(b => `- ${b.label}: ${b.oldVal} → ${b.newVal}`).join('\n')}`,
            category: 'policy',
            creatorNpub: identity.npub,
            votes: { [identity.npub]: 'approve' },
            status: 'passed',
            createdAt: new Date().toISOString()
          };

          onAddProposal(soloProposal);
          onUpdateListing(updatedListing);
          onAddLog(
            'governance',
            t('hostCalendar.auditLogSoloBApproved'),
            signature
          );
          setStatusNotice({
            message: t('hostCalendar.msgSoloBApproved'),
            type: 'success'
          });
        }
      } else {
        // Multi-owner host: must go through Governance proposal
        const hasPriceChange = changes.listA.some(a => a.field === 'priceSats' || a.field === 'priceRules');
        const changedLabels = [...changes.listA, ...changes.listB].map(c => c.label).join(', ');

        const propId = `prop_extranet_${Date.now()}`;
        const multiProposal: Proposal = {
          id: propId,
          listingId: selectedListing.id,
          listingTitle: selectedListing.title,
          title: t('hostCalendar.titleProposalExtranet', { labels: changedLabels }),
          description: `${t('hostCalendar.descProposalExtranet', { host: identity.name || identity.npub.slice(0, 12) })}\n${[...changes.listA, ...changes.listB].map(c => `- ${c.label}: ${c.oldVal} → ${c.newVal}`).join('\n')}`,
          category: hasPriceChange ? 'finance' : 'policy',
          value: hasPriceChange ? `${draftPriceSats.toLocaleString()} Sats` : undefined,
          creatorNpub: identity.npub,
          votes: { [identity.npub]: 'approve' },
          status: 'active',
          createdAt: new Date().toISOString()
        };

        onAddProposal(multiProposal);
        onAddLog(
          'governance',
          t('hostCalendar.auditLogProposal', { title: selectedListing.title }),
          signature
        );
        setStatusNotice({
          message: t('hostCalendar.auditProposalNotice'),
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Sign and apply error:', err);
      setStatusNotice({ message: t('hostCalendar.errSchnorrSign', { msg: err.message || err }), type: 'error' });
    } finally {
      setIsSigning(false);
    }
  };

  if (!selectedListing) {
    return (
      <div className="glass-panel p-8 text-center text-text-secondary font-mono text-xs rounded-xl border border-border">
        {t('hostCalendar.noListingFound')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Listing Selector Bar */}
      <div className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 bg-primary/10 rounded-lg text-primary border border-primary/20 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2 truncate">
              <span>{selectedListing.title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-surface-hover text-text-secondary border border-border">
                {selectedListing.id}
              </span>
            </h3>
            <p className="text-xs text-text-secondary font-mono truncate">
              {selectedListing.meshCoordinates}
            </p>
          </div>
        </div>

        {(hostListings.length > 1 || listings.length > 1) && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-mono text-text-secondary shrink-0">{t('hostCalendar.selectListingLabel')}</span>
            <select
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              className="bg-black/50 border border-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary w-full md:w-auto"
            >
              {(hostListings.length > 0 ? hostListings : listings).map(l => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Risk Tier & Ownership Diagnostic Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-text-secondary mb-1">
              <span>{t('hostCalendar.ownershipMechanism')}</span>
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm font-bold font-mono text-white flex items-center gap-2 mt-1">
              {isSoloListing ? (
                hasDirectEditAccess ? (
                  <span className="text-success flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> {t('hostCalendar.soloHost100')}
                  </span>
                ) : (
                  <span className="text-danger flex items-center gap-1.5">
                    <Lock className="w-4 h-4" /> {t('hostCalendar.soloHostViewOnly')}
                  </span>
                )
              ) : (
                <span className="text-primary flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Multi-Owner ({selectedListing.coOwners?.length || 0} Co-Owners)
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] font-mono mt-2">
            {isUnauthorizedSolo ? (
              <span className="text-danger font-semibold">
                {t('hostCalendar.notOwnerWarning', { npub: soloOwnerShortNpub })}
              </span>
            ) : hasDirectEditAccess ? (
              <span className="text-text-secondary">
                {t('hostCalendar.groupARuleSolo')}
              </span>
            ) : (
              <span className="text-text-secondary">
                {t('hostCalendar.groupARuleMulti')}
              </span>
            )}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-text-secondary mb-1">
              <span>{t('hostCalendar.basePriceAndRules')}</span>
              <Zap className="w-4 h-4 text-warning" />
            </div>
            <div className="text-sm font-bold font-mono text-warning mt-1">
              {t('hostCalendar.satsPerNight', { sats: draftPriceSats.toLocaleString() })}
            </div>
          </div>
          <p className="text-[10px] text-text-secondary font-mono mt-2">
            <span dangerouslySetInnerHTML={{ __html: t('hostCalendar.configuringRules', { count: draftRules.length }) }} />
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-text-secondary mb-1">
              <span>{t('hostCalendar.activeBookingStatus')}</span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {activeBookings.length > 0 ? (
                <span className="text-warning flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {t('hostCalendar.activeBookingsCount', { count: activeBookings.length })}
                </span>
              ) : (
                <span className="text-success flex items-center gap-1">
                  <Check className="w-4 h-4" /> {t('hostCalendar.readyZeroActive')}
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-text-secondary font-mono mt-2">
            {isGroupBBlocked
              ? t('hostCalendar.groupBLockedReason')
              : t('hostCalendar.groupBEditableReason')}
          </p>
        </div>
      </div>

      {/* Room Type Selector & Management Panel */}
      <div className="glass-panel p-4 rounded-xl border border-border bg-surface space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
              {t('hostCalendar.roomTypesHeading', { count: draftRoomTypes.length })}
            </h3>
          </div>
          {!isUnauthorizedSolo && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={handleAddRoomType}
              className="text-xs font-mono py-1 px-3"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('hostCalendar.addNewRoomType')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {draftRoomTypes.map((rt) => {
            const isSelected = rt.id === selectedRoomTypeId;
            const displayName = rt.id === selectedRoomTypeId ? (draftRoomName || rt.name) : rt.name;
            const displayPrice = rt.id === selectedRoomTypeId ? draftPriceSats : rt.priceSats;
            const displayGuests = rt.id === selectedRoomTypeId ? draftMaxGuests : rt.maxGuests;
            const displayRules = rt.id === selectedRoomTypeId ? draftRules : (rt.priceRules || []);
            const displayStatus = rt.id === selectedRoomTypeId ? draftStatus : (rt.status || 'available');

            return (
              <div
                key={rt.id}
                onClick={() => handleSelectRoomType(rt.id)}
                className={`cursor-pointer p-3 rounded-xl border font-mono text-xs transition-all flex flex-col justify-between gap-2 relative ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.12)]'
                    : 'bg-black/30 border-border/60 hover:border-border hover:bg-black/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-sm truncate ${isSelected ? 'text-primary' : 'text-white'}`}>
                        {displayName}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary flex items-center gap-2">
                      <span>{t('hostCalendar.maxGuests', { count: displayGuests })}</span>
                      <span>•</span>
                      <span className={displayStatus === 'available' ? 'text-success' : 'text-danger'}>
                        {displayStatus === 'available' ? t('hostCalendar.statusOpen') : t('hostCalendar.statusClosed')}
                      </span>
                    </div>
                  </div>

                  {!isUnauthorizedSolo && draftRoomTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRoomType(rt.id);
                      }}
                      title={t('hostCalendar.deleteRoomTitle')}
                      className="p-1 rounded text-text-disabled hover:text-danger hover:bg-danger/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1 text-warning font-bold">
                    <Zap className="w-3 h-3" />
                    <span>{displayPrice.toLocaleString()} Sats</span>
                    <span className="text-[9px] font-normal text-text-secondary">/ {t('hostReg.perNight')}</span>
                  </div>
                  <span className="text-[10px] text-text-secondary">
                    {displayRules.length > 0 ? t('hostCalendar.seasonalRulesCount', { count: displayRules.length }) : t('hostCalendar.fixedPrice')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Extranet Grid: Calendar & Price Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Calendar View (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card variant="glass" className="border-border">
            <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                  {t('hostCalendar.priceCalendarTitle')} <span className="text-primary">{draftRoomName || t('listingDetail.roomTypeLabel')}</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 rounded bg-surface border border-border hover:bg-surface-hover text-text-secondary hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-white px-2">
                  {t('hostCalendar.monthFormat', { month: currentDate.getMonth() + 1, year: currentDate.getFullYear() })}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 rounded bg-surface border border-border hover:bg-surface-hover text-text-secondary hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase font-bold text-text-secondary pb-1 border-b border-border/40">
                <span>CN</span>
                <span>T2</span>
                <span>T3</span>
                <span>T4</span>
                <span>T5</span>
                <span>T6</span>
                <span>T7</span>
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cell, idx) => {
                  const hasRule = Boolean(cell.rule);
                  return (
                    <div
                      key={idx}
                      className={`min-h-[58px] p-1.5 rounded-lg border flex flex-col justify-between transition-all ${
                        !cell.isCurrentMonth
                          ? 'opacity-30 border-border/30 bg-black/20'
                          : hasRule
                          ? 'border-primary/50 bg-primary/5 shadow-[0_0_8px_rgba(var(--primary),0.08)]'
                          : 'border-border/50 bg-surface hover:border-border'
                      } ${cell.isToday ? 'ring-1 ring-accent' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-mono font-bold ${cell.isToday ? 'text-accent' : cell.isCurrentMonth ? 'text-white' : 'text-text-disabled'}`}>
                          {cell.dateNumber}
                        </span>
                        {hasRule && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" title={cell.rule?.label} />
                        )}
                      </div>

                      <div className="text-right mt-1">
                        <span className={`text-[10px] font-mono font-bold leading-tight block ${hasRule ? 'text-primary' : 'text-warning'}`}>
                          {(cell.effectivePrice / 1000).toFixed(0)}k
                        </span>
                        {hasRule && (
                          <span className="text-[8px] font-mono text-primary/80 truncate block max-w-full text-right" title={cell.rule?.label}>
                            {cell.rule?.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="pt-3 border-t border-border/40 flex flex-wrap items-center gap-4 text-[10px] font-mono text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-surface border border-border" />
                  <span>{t('hostCalendar.legendBasePrice')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-primary/20 border border-primary" />
                  <span>{t('hostCalendar.legendDynamicRule')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-accent" />
                  <span>{t('hostCalendar.legendToday')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Price Rules List & Add Rule (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card variant="glass" className="border-border">
            <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                  {t('hostCalendar.pricingRulesTitle')} <span className="text-warning">{draftRoomName || t('listingDetail.roomTypeLabel')}</span>
                </h3>
              </div>
              {!isUnauthorizedSolo && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowAddRuleForm(!showAddRuleForm)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {showAddRuleForm ? t('hostCalendar.closeRuleForm') : t('hostCalendar.addRuleForm')}
                </Button>
              )}
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Add Rule Form */}
              <AnimatePresence>
                {!isUnauthorizedSolo && showAddRuleForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddRule}
                    className="p-3 bg-black/40 rounded-xl border border-primary/30 space-y-3 text-xs font-mono"
                  >
                    <div className="font-bold text-primary flex items-center gap-1.5 pb-1 border-b border-white/5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('hostCalendar.setupNewRule')}</span>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.ruleNameLabel')}</label>
                      <input
                        type="text"
                        required
                        placeholder={t('hostCalendar.ruleNamePlaceholder')}
                        value={ruleLabel}
                        onChange={(e) => setRuleLabel(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.ruleTypeLabel')}</label>
                        <select
                          value={ruleType}
                          onChange={(e) => setRuleType(e.target.value as PriceRuleType)}
                          className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                        >
                          <option value="day_of_week">{t('hostCalendar.ruleTypeDayOfWeek')}</option>
                          <option value="date_range">{t('hostCalendar.ruleTypeDateRange')}</option>
                          <option value="recurring_month">{t('hostCalendar.ruleTypeRecurringMonth')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.priorityLabel')}</label>
                        <input
                          type="number"
                          value={rulePriority}
                          onChange={(e) => setRulePriority(Number(e.target.value))}
                          className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-primary"
                          min={1}
                          max={100}
                        />
                      </div>
                    </div>

                    {/* Conditional inputs by type */}
                    {ruleType === 'day_of_week' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-text-secondary uppercase block">{t('hostCalendar.selectDaysOfWeek')}</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(day => (
                            <button
                              type="button"
                              key={day}
                              onClick={() => {
                                setRuleDaysOfWeek(prev => 
                                  prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                );
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                                ruleDaysOfWeek.includes(day)
                                  ? 'bg-primary text-black font-bold border-primary'
                                  : 'bg-surface text-text-secondary border-border hover:text-white'
                              }`}
                            >
                              {getDayLabel(day)}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setRuleDaysOfWeek(['SA', 'SU'])}
                            className="text-primary hover:underline"
                          >
                            {t('hostCalendar.btnWeekend')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRuleDaysOfWeek(['MO', 'TU', 'WE', 'TH', 'FR'])}
                            className="text-text-secondary hover:text-white hover:underline"
                          >
                            {t('hostCalendar.btnWeekdays')}
                          </button>
                        </div>
                      </div>
                    )}

                    {ruleType === 'date_range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.fromDateLabel')}</label>
                          <input
                            type="date"
                            value={ruleStartDate}
                            onChange={(e) => setRuleStartDate(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.toDateLabel')}</label>
                          <input
                            type="date"
                            value={ruleEndDate}
                            onChange={(e) => setRuleEndDate(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    )}

                    {ruleType === 'recurring_month' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.fromMonthLabel')}</label>
                          <select
                            value={ruleStartMonth}
                            onChange={(e) => setRuleStartMonth(Number(e.target.value))}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>{t('hostCalendar.monthOption', { month: m })}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.toMonthLabel')}</label>
                          <select
                            value={ruleEndMonth}
                            onChange={(e) => setRuleEndMonth(Number(e.target.value))}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>{t('hostCalendar.monthOption', { month: m })}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-text-secondary uppercase block mb-1">{t('hostCalendar.absolutePriceLabel')}</label>
                      <input
                        type="number"
                        required
                        value={rulePriceSats}
                        onChange={(e) => setRulePriceSats(Number(e.target.value))}
                        step={1000}
                        min={1000}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-warning font-bold focus:outline-none focus:border-warning"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddRuleForm(false)}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button type="submit" variant="primary" size="sm">
                        {t('hostCalendar.btnSaveRule')}
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Rules List */}
              <div className="space-y-2">
                {draftRules.length === 0 ? (
                  <div className="p-6 text-center text-text-secondary font-mono text-xs bg-black/20 rounded-xl border border-border/50">
                    {t('hostCalendar.noRulesNotice', { sats: draftPriceSats.toLocaleString() })}
                  </div>
                ) : (
                  draftRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between gap-3 text-xs font-mono hover:border-primary/30 transition-all"
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white truncate">{rule.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase font-bold shrink-0">
                            P{rule.priority}
                          </span>
                        </div>

                        <div className="text-[10px] text-text-secondary flex items-center gap-2">
                          <span>
                            {rule.type === 'day_of_week' && t('hostCalendar.ruleDayOfWeekDesc', { days: rule.daysOfWeek?.join(', ') || '' })}
                            {rule.type === 'date_range' && `${rule.startDate} → ${rule.endDate}`}
                            {rule.type === 'recurring_month' && t('hostCalendar.ruleRecurringMonthDesc', { start: rule.startMonth, end: rule.endMonth })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-warning font-bold">
                          {rule.priceSats.toLocaleString()} Sats
                        </span>
                        {!isUnauthorizedSolo && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 rounded text-text-disabled hover:text-danger hover:bg-danger/10 transition-colors"
                            title={t('hostCalendar.deleteRuleTitle')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Group A & Group B Editable Form */}
      {isUnauthorizedSolo ? (
        <Card variant="glass" className="border-danger/30 bg-danger/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/30 text-danger flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold font-mono text-white">{t('hostCalendar.directEditLockedTitle')}</h4>
              <p className="text-sm font-mono text-danger font-medium">
                {t('hostCalendar.notOwnerWarning', { npub: soloOwnerShortNpub })}
              </p>
            </div>
            <p className="text-xs font-mono text-text-secondary max-w-md mx-auto">
              {t('hostCalendar.directEditLockedDesc', { npub: soloOwnerShortNpub })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card variant="glass" className="border-border">
          <CardHeader className="pb-4 border-b border-border">
            <h3 className="text-base font-bold font-mono text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              <span>{t('hostCalendar.riskGroupingTitle')}</span>
            </h3>
            <p className="text-xs text-text-secondary font-mono">
              {t('hostCalendar.riskGroupingDesc')}
            </p>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Group A Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-success/20 text-success border border-success/30 font-mono text-xs font-bold">
                    {t('hostCalendar.groupATitle')}
                  </span>
                  <span className="text-xs font-bold font-mono text-white uppercase">{t('hostCalendar.groupASubtitle')}</span>
                </div>
                <span className="text-[10px] font-mono text-text-secondary">
                  {hasDirectEditAccess ? t('hostCalendar.groupASoloAccess') : t('hostCalendar.groupAMultiAccess')}
                </span>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelRoomName')}</label>
                <input
                  type="text"
                  value={draftRoomName}
                  onChange={(e) => setDraftRoomName(e.target.value)}
                  placeholder={t('hostCalendar.phRoomName')}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelBasePrice')}</label>
                <input
                  type="number"
                  value={draftPriceSats}
                  onChange={(e) => setDraftPriceSats(Number(e.target.value))}
                  step={1000}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-warning font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelCapacity')}</label>
                <input
                  type="number"
                  value={draftMaxGuests}
                  onChange={(e) => setDraftMaxGuests(Number(e.target.value))}
                  min={1}
                  max={20}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelRoomStatus')}</label>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                >
                  <option value="available">{t('hostCalendar.optAvailable')}</option>
                  <option value="occupied">{t('hostCalendar.optOccupied')}</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelRoomSpecs')}</label>
                <input
                  type="text"
                  placeholder={t('hostCalendar.phRoomSpecs')}
                  value={draftRoomSpecsStr}
                  onChange={(e) => setDraftRoomSpecsStr(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelCoverUrl')}</label>
                <input
                  type="text"
                  value={draftImageUrl}
                  onChange={(e) => setDraftImageUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelDesc')}</label>
                <textarea
                  rows={3}
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-3 text-white font-sans focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Group B Section */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/30 font-mono text-xs font-bold">
                  {t('hostCalendar.groupBTitle')}
                </span>
                <span className="text-xs font-bold font-mono text-white uppercase">{t('hostCalendar.groupBSubtitle')}</span>
              </div>
              <span className="text-[10px] font-mono text-text-secondary">
                {t('hostCalendar.groupBDesc')}
              </span>
            </div>

            {isGroupBBlocked && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl text-xs font-mono text-warning flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {t('hostCalendar.groupBLockedActiveNotice', { count: activeBookings.length })}
                </span>
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono ${isGroupBBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="md:col-span-2">
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelListingTitle')}</label>
                <input
                  type="text"
                  disabled={isGroupBBlocked}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelKycVerifiers')}</label>
                <input
                  type="text"
                  disabled={isGroupBBlocked}
                  placeholder="npub1..., npub1..."
                  value={draftVerifiersStr}
                  onChange={(e) => setDraftVerifiersStr(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">{t('hostCalendar.labelKycThreshold')}</label>
                <input
                  type="number"
                  disabled={isGroupBBlocked}
                  value={draftKycThreshold}
                  onChange={(e) => setDraftKycThreshold(Number(e.target.value))}
                  step={50000}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Group C Section - Readonly */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 font-mono text-xs font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> {t('hostCalendar.groupCTitle')}
                </span>
                <span className="text-xs font-bold font-mono text-white uppercase">{t('hostCalendar.groupCSubtitle')}</span>
              </div>
              <span className="text-[10px] font-mono text-text-secondary">
                {t('hostCalendar.groupCDesc')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-text-secondary">
              <div className="p-3 bg-black/30 rounded-lg border border-border/40">
                <span className="text-[10px] uppercase text-text-disabled block mb-1">{t('hostCalendar.labelMeshCoords')}</span>
                <span className="text-white font-mono">{selectedListing.meshCoordinates}</span>
                <p className="text-[9px] text-text-disabled mt-1 italic">
                  {t('hostCalendar.noteMeshImmutable')}
                </p>
              </div>

              <div className="p-3 bg-black/30 rounded-lg border border-border/40">
                <span className="text-[10px] uppercase text-text-disabled block mb-1">{t('hostCalendar.labelCoOwnersShares')}</span>
                <div className="space-y-0.5">
                  {selectedListing.coOwners.map((co, i) => (
                    <div key={i} className="text-[11px] text-white flex justify-between">
                      <span>{co.name}</span>
                      <span className="text-primary font-bold">{co.share}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-text-disabled mt-1 italic">
                  {t('hostCalendar.noteCouncilProposal')}
                </p>
              </div>
            </div>
          </div>

          {/* Diff Summary & Apply Action */}
          <div className="pt-6 border-t border-border space-y-4">
            {changes.hasChanges ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2 text-xs font-mono">
                <div className="font-bold text-primary flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  <span>{t('hostCalendar.pendingChangesSummary', { count: changes.listA.length + changes.listB.length })}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  {changes.listA.map((c, i) => (
                    <div key={`a_${i}`} className="p-2 bg-black/30 rounded border border-white/5">
                      <span className="text-success font-bold block">[{t('hostCalendar.groupATitle')}] {c.label}</span>
                      <span className="text-text-disabled line-through text-[10px]">{c.oldVal}</span>{' '}
                      <span className="text-white font-bold">{c.newVal}</span>
                    </div>
                  ))}
                  {changes.listB.map((c, i) => (
                    <div key={`b_${i}`} className="p-2 bg-black/30 rounded border border-white/5">
                      <span className="text-warning font-bold block">[{t('hostCalendar.groupBTitle')}] {c.label}</span>
                      <span className="text-text-disabled line-through text-[10px]">{c.oldVal}</span>{' '}
                      <span className="text-white font-bold">{c.newVal}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs font-mono text-text-disabled">
                {t('hostCalendar.noChangesNotice')}
              </div>
            )}

            {statusNotice && (
              <div className={`p-3 rounded-xl border text-xs font-mono ${
                statusNotice.type === 'success'
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-danger/10 border-danger/30 text-danger'
              }`}>
                {statusNotice.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                disabled={!changes.hasChanges || isSigning}
                onClick={handleSignAndApply}
                className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider"
              >
                {isSigning ? (
                  <span>{t('hostCalendar.signingSchnorr')}</span>
                ) : hasDirectEditAccess ? (
                  <span>{t('hostCalendar.signSoloApply')}</span>
                ) : (
                  <span>{t('hostCalendar.signMultiProposal')}</span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
