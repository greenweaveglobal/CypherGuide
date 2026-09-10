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
  ArrowRight
} from 'lucide-react';
import { Listing, NostrIdentity, Booking, PriceRule, PriceRuleType, Proposal, EditHistoryEntry } from '../types';
import { getEffectivePrice, getEffectivePriceRule, DAY_OF_WEEK_LABELS, parseDate } from '../utils/pricing';
import { signMessage, sha256 } from '../utils/crypto';
import { useTranslation } from '../hooks/useTranslation';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface Props {
  listings: Listing[];
  identity: NostrIdentity | null;
  bookings: Booking[];
  onUpdateListing: (listing: Listing) => void;
  onAddProposal: (proposal: Proposal) => void;
  onAddLog: (type: 'relay' | 'lightning' | 'lock' | 'governance' | 'message', message: string, hash?: string) => void;
}

export default function HostCalendarPricing({
  listings,
  identity,
  bookings,
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
    hostListings[0]?.id || listings[0]?.id || ''
  );

  const selectedListing = useMemo(() => {
    return listings.find(l => l.id === selectedListingId) || listings[0];
  }, [listings, selectedListingId]);

  // Calendar view state (year & month: 0-11)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 1)); // Default Sept 2026

  // Local draft states for Group A & Group B & PriceRules
  const [draftPriceSats, setDraftPriceSats] = useState<number>(selectedListing?.priceSats || 100000);
  const [draftDesc, setDraftDesc] = useState<string>(selectedListing?.description || '');
  const [draftImageUrl, setDraftImageUrl] = useState<string>(selectedListing?.imageUrl || '');
  const [draftStatus, setDraftStatus] = useState<'available' | 'occupied'>(selectedListing?.status || 'available');

  const [draftTitle, setDraftTitle] = useState<string>(selectedListing?.title || '');
  const [draftMaxGuests, setDraftMaxGuests] = useState<number>(selectedListing?.maxGuests || 2);
  const [draftVerifiersStr, setDraftVerifiersStr] = useState<string>(
    (selectedListing?.acceptedKycVerifiers || []).join(', ')
  );
  const [draftKycThreshold, setDraftKycThreshold] = useState<number>(
    selectedListing?.kycThresholdSats || 0
  );

  const [draftRules, setDraftRules] = useState<PriceRule[]>(selectedListing?.priceRules || []);

  // Sync draft when selectedListing changes
  React.useEffect(() => {
    if (selectedListing) {
      setDraftPriceSats(selectedListing.priceSats);
      setDraftDesc(selectedListing.description);
      setDraftImageUrl(selectedListing.imageUrl);
      setDraftStatus(selectedListing.status);
      setDraftTitle(selectedListing.title);
      setDraftMaxGuests(selectedListing.maxGuests || 2);
      setDraftVerifiersStr((selectedListing.acceptedKycVerifiers || []).join(', '));
      setDraftKycThreshold(selectedListing.kycThresholdSats || 0);
      setDraftRules(selectedListing.priceRules || []);
    }
  }, [selectedListing?.id]);

  // Ownership & Risk Assessment
  const isSoloHost = useMemo(() => {
    if (!selectedListing || !selectedListing.coOwners) return true;
    return selectedListing.coOwners.length === 1 && selectedListing.coOwners[0].share === 100;
  }, [selectedListing]);

  // Active bookings check for Group B protection
  const activeBookings = useMemo(() => {
    if (!selectedListing) return [];
    return bookings.filter(b => 
      b.listingId === selectedListing.id && 
      (b.status === 'paid' || b.status === 'checked_in' || b.status === 'pending')
    );
  }, [bookings, selectedListing]);

  const isGroupBBlocked = activeBookings.length > 0;

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

  // Temporary preview listing with current draft rules and base price
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
    setDraftRules(prev => prev.filter(r => r.id !== ruleId));
  };

  // Detect changed fields between draft and selectedListing
  const changes = useMemo(() => {
    const listA: Array<{ field: string; label: string; oldVal: string; newVal: string }> = [];
    const listB: Array<{ field: string; label: string; oldVal: string; newVal: string }> = [];

    // Group A
    if (draftPriceSats !== selectedListing.priceSats) {
      listA.push({
        field: 'priceSats',
        label: 'Giá cơ sở (Base Rate)',
        oldVal: `${selectedListing.priceSats.toLocaleString()} Sats`,
        newVal: `${draftPriceSats.toLocaleString()} Sats`
      });
    }

    if (JSON.stringify(draftRules) !== JSON.stringify(selectedListing.priceRules || [])) {
      listA.push({
        field: 'priceRules',
        label: 'Quy tắc giá theo ngày/mùa (PriceRules)',
        oldVal: `${(selectedListing.priceRules || []).length} quy tắc`,
        newVal: `${draftRules.length} quy tắc`
      });
    }

    if (draftDesc.trim() !== selectedListing.description.trim()) {
      listA.push({
        field: 'description',
        label: 'Mô tả Homestay',
        oldVal: selectedListing.description.slice(0, 30) + '...',
        newVal: draftDesc.slice(0, 30) + '...'
      });
    }

    if (draftImageUrl.trim() !== selectedListing.imageUrl.trim()) {
      listA.push({
        field: 'imageUrl',
        label: 'Ảnh đại diện',
        oldVal: selectedListing.imageUrl.slice(0, 30) + '...',
        newVal: draftImageUrl.slice(0, 30) + '...'
      });
    }

    if (draftStatus !== selectedListing.status) {
      listA.push({
        field: 'status',
        label: 'Trạng thái nhận khách',
        oldVal: selectedListing.status,
        newVal: draftStatus
      });
    }

    // Group B
    if (draftTitle.trim() !== selectedListing.title.trim()) {
      listB.push({
        field: 'title',
        label: 'Tiêu đề Homestay',
        oldVal: selectedListing.title,
        newVal: draftTitle.trim()
      });
    }

    if (draftMaxGuests !== (selectedListing.maxGuests || 2)) {
      listB.push({
        field: 'maxGuests',
        label: 'Số khách tối đa',
        oldVal: String(selectedListing.maxGuests || 2),
        newVal: String(draftMaxGuests)
      });
    }

    const currentVerifiers = (selectedListing.acceptedKycVerifiers || []).join(', ');
    if (draftVerifiersStr.trim() !== currentVerifiers.trim()) {
      listB.push({
        field: 'acceptedKycVerifiers',
        label: 'Nhà xác minh KYC hợp chuẩn',
        oldVal: currentVerifiers || 'Không',
        newVal: draftVerifiersStr || 'Không'
      });
    }

    if (draftKycThreshold !== (selectedListing.kycThresholdSats || 0)) {
      listB.push({
        field: 'kycThresholdSats',
        label: 'Ngưỡng KYC bắt buộc',
        oldVal: `${(selectedListing.kycThresholdSats || 0).toLocaleString()} Sats`,
        newVal: `${draftKycThreshold.toLocaleString()} Sats`
      });
    }

    return { listA, listB, hasChanges: listA.length > 0 || listB.length > 0 };
  }, [
    draftPriceSats,
    draftRules,
    draftDesc,
    draftImageUrl,
    draftStatus,
    draftTitle,
    draftMaxGuests,
    draftVerifiersStr,
    draftKycThreshold,
    selectedListing
  ]);

  // Sign and apply changes
  const handleSignAndApply = async () => {
    if (!identity) {
      setStatusNotice({ message: 'Vui lòng kết nối danh tính Nostr trước khi ký cập nhật.', type: 'error' });
      return;
    }

    if (!changes.hasChanges) {
      setStatusNotice({ message: 'Chưa có thay đổi nào được ghi nhận để ký.', type: 'error' });
      return;
    }

    if (changes.listB.length > 0 && isGroupBBlocked) {
      setStatusNotice({
        message: 'Không thể sửa các trường Nhóm B khi đang có booking active.',
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
        priceSats: draftPriceSats,
        priceRules: draftRules,
        description: draftDesc.trim(),
        imageUrl: draftImageUrl.trim(),
        status: draftStatus,
        title: draftTitle.trim(),
        maxGuests: Number(draftMaxGuests),
        acceptedKycVerifiers: parsedVerifiers.length > 0 ? parsedVerifiers : undefined,
        kycThresholdSats: Number(draftKycThreshold) > 0 ? Number(draftKycThreshold) : undefined,
        editHistory: [...(selectedListing.editHistory || []), ...newHistoryEntries]
      };

      if (isSoloHost) {
        // Solo host
        if (changes.listB.length === 0) {
          // Only Group A changes: Direct apply
          onUpdateListing(updatedListing);
          onAddLog(
            'relay',
            `Chủ nhà solo (${identity.name || identity.npub.slice(0, 10)}) đã ký Schnorr và áp dụng ngay ${changes.listA.length} thay đổi Nhóm A cho "${selectedListing.title}".`,
            signature
          );
          setStatusNotice({
            message: 'Đã ký Schnorr thành công! Thay đổi Nhóm A đã được cập nhật trực tiếp.',
            type: 'success'
          });
        } else {
          // Group B changes: create solo governance proposal and auto-approve
          const propId = `prop_solo_${Date.now()}`;
          const soloProposal: Proposal = {
            id: propId,
            listingId: selectedListing.id,
            listingTitle: selectedListing.title,
            title: `[Solo Host Governance] Thay đổi Nhóm B: ${changes.listB.map(b => b.label).join(', ')}`,
            description: `Chủ nhà solo sở hữu 100% tự động lưu vết Audit Trail cho các thay đổi cẩn trọng:\n${changes.listB.map(b => `- ${b.label}: ${b.oldVal} → ${b.newVal}`).join('\n')}`,
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
            `Đề xuất thay đổi Nhóm B của Solo Host đã tự động được phê duyệt với 100% đồng thuận và ghi vào Audit Trail.`,
            signature
          );
          setStatusNotice({
            message: 'Đã tạo và tự động thông qua Đề xuất Quản trị Solo Host (100% Share). Dữ liệu đã lưu vào Audit Trail.',
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
          title: `[Extranet Proposal] Cập nhật: ${changedLabels}`,
          description: `Đề xuất cập nhật Lịch & Giá và Thông tin từ Co-Owner ${identity.name || identity.npub.slice(0, 12)}:\n${[...changes.listA, ...changes.listB].map(c => `- ${c.label}: ${c.oldVal} → ${c.newVal}`).join('\n')}`,
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
          `Đã tạo đề xuất quản trị Extranet mới cho "${selectedListing.title}". Đang chờ các co-owners khác biểu quyết.`,
          signature
        );
        setStatusNotice({
          message: 'Đã tạo Đề xuất Quản trị mới! Do homestay có nhiều Co-Owners, đề xuất cần được các thành viên biểu quyết đạt >50% để áp dụng.',
          type: 'success'
        });
      }
    } catch (err: any) {
      console.error('Sign and apply error:', err);
      setStatusNotice({ message: `Lỗi khi ký Schnorr: ${err.message || err}`, type: 'error' });
    } finally {
      setIsSigning(false);
    }
  };

  if (!selectedListing) {
    return (
      <div className="glass-panel p-8 text-center text-text-secondary font-mono text-xs rounded-xl border border-border">
        Không tìm thấy cơ sở lưu trú nào để quản lý lịch và giá.
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

        {hostListings.length > 1 && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-mono text-text-secondary shrink-0">Chọn cơ sở:</span>
            <select
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              className="bg-black/50 border border-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-primary w-full md:w-auto"
            >
              {hostListings.map(l => (
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
              <span>CƠ CHẾ SỞ HỮU</span>
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm font-bold font-mono text-white flex items-center gap-2 mt-1">
              {isSoloHost ? (
                <span className="text-success flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Solo Host (100% Cổ phần)
                </span>
              ) : (
                <span className="text-primary flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Multi-Owner ({selectedListing.coOwners.length} Co-Owners)
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-text-secondary font-mono mt-2">
            {isSoloHost 
              ? 'Nhóm A: Ký 1 lần áp dụng ngay. Nhóm B: Tự động lưu vết Governance.'
              : 'Mọi thay đổi Nhóm A & B đều tạo Đề xuất Quản trị cần biểu quyết >50%.'}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-text-secondary mb-1">
              <span>GIÁ CƠ SỞ & QUY TẮC</span>
              <Zap className="w-4 h-4 text-warning" />
            </div>
            <div className="text-sm font-bold font-mono text-warning mt-1">
              {draftPriceSats.toLocaleString()} Sats / đêm
            </div>
          </div>
          <p className="text-[10px] text-text-secondary font-mono mt-2">
            Đang cấu hình <span className="text-white font-bold">{draftRules.length}</span> quy tắc giá theo ngày/mùa.
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-text-secondary mb-1">
              <span>TRẠNG THÁI BOOKING ACTIVE</span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {activeBookings.length > 0 ? (
                <span className="text-warning flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {activeBookings.length} Đang hoạt động
                </span>
              ) : (
                <span className="text-success flex items-center gap-1">
                  <Check className="w-4 h-4" /> Sẵn sàng (0 active)
                </span>
              )}
            </div>
          </div>
          <p className="text-[10px] text-text-secondary font-mono mt-2">
            {isGroupBBlocked
              ? 'Nhóm B bị khóa để bảo vệ khách có booking chưa hoàn tất.'
              : 'Các trường Nhóm B có thể chỉnh sửa an toàn.'}
          </p>
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
                  Lịch Giá Extranet Theo Tháng
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
                  Tháng {currentDate.getMonth() + 1} / {currentDate.getFullYear()}
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
                  <span>Giá cơ sở (Mặc định)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-primary/20 border border-primary" />
                  <span>Áp dụng quy tắc động</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-accent" />
                  <span>Hôm nay</span>
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
                  Quy Tắc Giá Theo Mùa / Ngày
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowAddRuleForm(!showAddRuleForm)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {showAddRuleForm ? 'Đóng' : 'Thêm quy tắc'}
              </Button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Add Rule Form */}
              <AnimatePresence>
                {showAddRuleForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddRule}
                    className="p-3 bg-black/40 rounded-xl border border-primary/30 space-y-3 text-xs font-mono"
                  >
                    <div className="font-bold text-primary flex items-center gap-1.5 pb-1 border-b border-white/5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Thiết Lập Quy Tắc Giá Mới</span>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary uppercase block mb-1">Tên Quy Tắc / Nhãn:</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Tết 2026, Cuối tuần VIP..."
                        value={ruleLabel}
                        onChange={(e) => setRuleLabel(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-text-secondary uppercase block mb-1">Loại Quy Tắc:</label>
                        <select
                          value={ruleType}
                          onChange={(e) => setRuleType(e.target.value as PriceRuleType)}
                          className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                        >
                          <option value="day_of_week">Thứ trong tuần</option>
                          <option value="date_range">Khoảng ngày cụ thể</option>
                          <option value="recurring_month">Tháng định kỳ</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-text-secondary uppercase block mb-1">Độ Ưu Tiên (Priority):</label>
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
                        <label className="text-[10px] text-text-secondary uppercase block">Chọn các thứ áp dụng:</label>
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
                              {DAY_OF_WEEK_LABELS[day]?.vi || day}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setRuleDaysOfWeek(['SA', 'SU'])}
                            className="text-primary hover:underline"
                          >
                            + Cuối tuần (T7, CN)
                          </button>
                          <button
                            type="button"
                            onClick={() => setRuleDaysOfWeek(['MO', 'TU', 'WE', 'TH', 'FR'])}
                            className="text-text-secondary hover:text-white hover:underline"
                          >
                            + Ngày thường (T2-T6)
                          </button>
                        </div>
                      </div>
                    )}

                    {ruleType === 'date_range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">Từ ngày:</label>
                          <input
                            type="date"
                            value={ruleStartDate}
                            onChange={(e) => setRuleStartDate(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">Đến ngày:</label>
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
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">Từ tháng:</label>
                          <select
                            value={ruleStartMonth}
                            onChange={(e) => setRuleStartMonth(Number(e.target.value))}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>Tháng {m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-text-secondary uppercase block mb-1">Đến tháng:</label>
                          <select
                            value={ruleEndMonth}
                            onChange={(e) => setRuleEndMonth(Number(e.target.value))}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-primary"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>Tháng {m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-text-secondary uppercase block mb-1">Giá Tuyệt Đối (Sats/đêm):</label>
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
                        Hủy
                      </Button>
                      <Button type="submit" variant="primary" size="sm">
                        Lưu vào danh sách
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Rules List */}
              <div className="space-y-2">
                {draftRules.length === 0 ? (
                  <div className="p-6 text-center text-text-secondary font-mono text-xs bg-black/20 rounded-xl border border-border/50">
                    Chưa có quy tắc giá theo ngày nào. Giá phòng sẽ áp dụng mức cố định cơ sở ({draftPriceSats.toLocaleString()} Sats).
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
                            {rule.type === 'day_of_week' && `Thứ: ${rule.daysOfWeek?.join(', ')}`}
                            {rule.type === 'date_range' && `${rule.startDate} → ${rule.endDate}`}
                            {rule.type === 'recurring_month' && `Tháng ${rule.startMonth} - ${rule.endMonth} hàng năm`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-warning font-bold">
                          {rule.priceSats.toLocaleString()} Sats
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 rounded text-text-disabled hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Xóa quy tắc"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
      <Card variant="glass" className="border-border">
        <CardHeader className="pb-4 border-b border-border">
          <h3 className="text-base font-bold font-mono text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <span>Phân Quyền Sửa Dữ Liệu Theo Nhóm Rủi Ro</span>
          </h3>
          <p className="text-xs text-text-secondary font-mono">
            Phân loại rõ ràng các trường dữ liệu theo chính sách giao thức BFT của Cypher Travel.
          </p>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Group A Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-success/20 text-success border border-success/30 font-mono text-xs font-bold">
                  Nhóm A
                </span>
                <span className="text-xs font-bold font-mono text-white uppercase">Tức Thời (Low Risk)</span>
              </div>
              <span className="text-[10px] font-mono text-text-secondary">
                {isSoloHost ? 'Solo: Ký 1 lần & Áp dụng ngay' : 'Multi: Qua Governance đề xuất'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="text-text-secondary block mb-1">Giá cơ sở mặc định (Base Sats/đêm):</label>
                <input
                  type="number"
                  value={draftPriceSats}
                  onChange={(e) => setDraftPriceSats(Number(e.target.value))}
                  step={1000}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-warning font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">Trạng thái nhận khách:</label>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                >
                  <option value="available">Available (Đang mở nhận khách)</option>
                  <option value="occupied">Occupied / Đóng cửa (Tạm dừng nhận khách)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-text-secondary block mb-1">URL Ảnh Đại Diện:</label>
                <input
                  type="text"
                  value={draftImageUrl}
                  onChange={(e) => setDraftImageUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-text-secondary block mb-1">Mô tả Homestay:</label>
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
                  Nhóm B
                </span>
                <span className="text-xs font-bold font-mono text-white uppercase">Cẩn Trọng (Medium Risk)</span>
              </div>
              <span className="text-[10px] font-mono text-text-secondary">
                Luôn qua Governance Audit Trail. Chặn sửa nếu có booking active.
              </span>
            </div>

            {isGroupBBlocked && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl text-xs font-mono text-warning flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  Đang có {activeBookings.length} booking đang hoạt động trên listing này. Nhóm B tạm thời bị khóa để bảo vệ khách theo giao thức.
                </span>
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono ${isGroupBBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <label className="text-text-secondary block mb-1">Tiêu đề Homestay (Title):</label>
                <input
                  type="text"
                  disabled={isGroupBBlocked}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">Số khách tối đa (Max Guests):</label>
                <input
                  type="number"
                  disabled={isGroupBBlocked}
                  value={draftMaxGuests}
                  onChange={(e) => setDraftMaxGuests(Number(e.target.value))}
                  min={1}
                  max={20}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-text-secondary block mb-1">Danh sách KYC Verifiers (npub phân tách bằng dấu phẩy):</label>
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
                <label className="text-text-secondary block mb-1">Ngưỡng KYC bắt buộc (Sats, 0 = không bắt buộc):</label>
                <input
                  type="number"
                  disabled={isGroupBBlocked}
                  value={draftKycThreshold}
                  onChange={(e) => setDraftKycThreshold(Number(e.target.value))}
                  step={10000}
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
                  <Lock className="w-3 h-3" /> Nhóm C
                </span>
                <span className="text-xs font-bold font-mono text-white uppercase">Khóa Cứng (Immutable / Council Only)</span>
              </div>
              <span className="text-[10px] font-mono text-text-secondary">
                Không thể sửa qua Extranet
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-text-secondary">
              <div className="p-3 bg-black/30 rounded-lg border border-border/40">
                <span className="text-[10px] uppercase text-text-disabled block mb-1">Tọa độ Meshnet Coordinates:</span>
                <span className="text-white font-mono">{selectedListing.meshCoordinates}</span>
                <p className="text-[9px] text-text-disabled mt-1 italic">
                  *Bất biến: Phải tạo listing mới nếu di dời vị trí vật lý.
                </p>
              </div>

              <div className="p-3 bg-black/30 rounded-lg border border-border/40">
                <span className="text-[10px] uppercase text-text-disabled block mb-1">Danh sách Cổ đông & Tỷ lệ Share:</span>
                <div className="space-y-0.5">
                  {selectedListing.coOwners.map((co, i) => (
                    <div key={i} className="text-[11px] text-white flex justify-between">
                      <span>{co.name}</span>
                      <span className="text-primary font-bold">{co.share}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-text-disabled mt-1 italic">
                  *Chỉ thay đổi qua Đề xuất BFT Council tại Tab Quản trị.
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
                  <span>Tổng kết {changes.listA.length + changes.listB.length} thay đổi đang chờ ký:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  {changes.listA.map((c, i) => (
                    <div key={`a_${i}`} className="p-2 bg-black/30 rounded border border-white/5">
                      <span className="text-success font-bold block">[Nhóm A] {c.label}</span>
                      <span className="text-text-disabled line-through text-[10px]">{c.oldVal}</span>{' '}
                      <span className="text-white font-bold">{c.newVal}</span>
                    </div>
                  ))}
                  {changes.listB.map((c, i) => (
                    <div key={`b_${i}`} className="p-2 bg-black/30 rounded border border-white/5">
                      <span className="text-warning font-bold block">[Nhóm B] {c.label}</span>
                      <span className="text-text-disabled line-through text-[10px]">{c.oldVal}</span>{' '}
                      <span className="text-white font-bold">{c.newVal}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs font-mono text-text-disabled">
                Chưa có thay đổi nào so với dữ liệu listing hiện tại.
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
                  <span>Đang ký Schnorr...</span>
                ) : isSoloHost ? (
                  <span>Ký Schnorr & Áp Dụng Ngay (Solo Host)</span>
                ) : (
                  <span>Ký & Tạo Đề Xuất Quản Trị (Multi-Owner)</span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
