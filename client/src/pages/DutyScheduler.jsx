import { useState, useRef, useEffect, forwardRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2,
  UserPlus, Users, TrendingUp, Sun, Sunset, Search,
  GripVertical, AlertCircle, FileText, Clock
} from 'lucide-react';
import api from '../services/api';


// ─── Real Staff Mapping Helper ───────────────────────────────────────────────
const mapRealPharmacist = (staff, index) => {
  const nameParts = staff.name.split(' ');
  let initials = '';
  if (nameParts.length > 0) initials += nameParts[0].charAt(0).toUpperCase();
  if (nameParts.length > 1) initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
  if (!initials) initials = 'P';

  const niceColors = [
    '#006c47', // Deep Green
    '#5e3c00', // Brown
    '#003d9b', // Blue
    '#6366f1', // Indigo
    '#be185d', // Pink
    '#7c3aed', // Purple
    '#0f766e', // Teal
    '#b45309'  // Amber
  ];
  const color = niceColors[index % niceColors.length];

  const designation = staff.designation || 'General Pharma';
  const rating = staff.rating !== undefined ? staff.rating : 5.0;

  return {
    id: staff._id,
    _id: staff._id,
    name: staff.name.startsWith('Dr. ') ? staff.name : `Dr. ${staff.name}`,
    initials,
    specialty: designation, // kept for state backward-compatibility
    designation,
    rating,
    available: staff.isActive !== false,
    color,
    branches: staff.branches || [],
    profilePicture: staff.profilePicture || '',
    licenseNumber: staff.licenseNumber || '',
    licenseExpiry: staff.licenseExpiry ? staff.licenseExpiry.substring(0, 10) : '',
    passportNumber: staff.passportNumber || '',
    passportExpiry: staff.passportExpiry ? staff.passportExpiry.substring(0, 10) : '',
    idCardNumber: staff.idCardNumber || '',
    idCardExpiry: staff.idCardExpiry ? staff.idCardExpiry.substring(0, 10) : '',
    remarks: staff.remarks || '',
    defaultBranch: staff.defaultBranch?._id || staff.defaultBranch || '',
    defaultBranchObj: staff.defaultBranch || null,
    defaultShiftType: staff.defaultShiftType || '',
    defaultFromTime: staff.defaultFromTime || '',
    defaultToTime: staff.defaultToTime || '',
    defaultOffDay: staff.defaultOffDay || ''
  };
};

// Default shift start times (24h format for input[type=time])
const DEFAULT_SHIFT_TIMES = {
  morning: '08:00',
  evening: '16:00',
};

const SHIFT_BASE = {
  morning: { label: 'Morning', color: '#006c47', bg: 'rgba(0, 108, 71, 0.1)', border: 'rgba(0, 108, 71, 0.3)', Icon: Sun },
  evening: { label: 'Evening', color: '#5e3c00', bg: 'rgba(94, 60, 0, 0.08)', border: 'rgba(94, 60, 0, 0.25)', Icon: Sunset },
};

// Format "08:00" → "8:00 AM"
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Generate initial shift assignments
function generateMonthShifts(year, month, pharmacistsList) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const shifts = {};
  for (let d = 1; d <= daysInMonth; d++) {
    shifts[d] = {
      morning: null,
      evening: null
    };
  }
  return shifts;
}

function generateWeekShifts(weekDays, pharmacistsList) {
  const result = {};
  weekDays.forEach((date) => {
    const key = date.toISOString().split('T')[0];
    result[key] = {
      morning: null,
      evening: null
    };
  });
  return result;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getWeekDays(baseDate) {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ─── Main Component ──────────────────────────────────────────────────────────
const DutyScheduler = () => {
  const today = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const viewMode = (tabParam === 'staffs' || tabParam === 'pharmacists') ? 'pharmacists' 
                    : ['monthly', 'weekly', 'matrix'].includes(tabParam) ? tabParam 
                    : 'monthly';

  const setViewMode = (mode) => {
    setSearchParams({ tab: mode === 'pharmacists' ? 'staffs' : mode });
  };
  const [currentDate, setCurrentDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState('');

  // Branches state
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState('');

  // Notes state
  const [notes, setNotes] = useState('');

  // Per-branch scheduler states
  const [branchMonthShifts, setBranchMonthShifts] = useState({});
  const [branchWeekShifts, setBranchWeekShifts] = useState({});
  const [branchMonthRemarks, setBranchMonthRemarks] = useState({});
  const [branchWeekRemarks, setBranchWeekRemarks] = useState({});

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weekDays = getWeekDays(currentDate);

  const [pharmacists, setPharmacists] = useState([]);

  // Fetch branches and pharmacists on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch branches
        const branchesRes = await api.get('/branches');
        setBranches(branchesRes.data);
        if (branchesRes.data.length > 0) {
          setActiveBranchId(branchesRes.data[0]._id);
        }
      } catch (error) {
        console.error("Failed to fetch branches", error);
        // Fallback default branches
        const defaultBranches = [
          { _id: 'b1', name: 'Branch 1 - Main' },
          { _id: 'b2', name: 'Branch 2 - Downtown' },
          { _id: 'b3', name: 'Branch 3 - North' },
          { _id: 'b4', name: 'Branch 4 - East' },
          { _id: 'b5', name: 'Branch 5 - West' },
          { _id: 'b6', name: 'Branch 6 - South' },
          { _id: 'b7', name: 'Branch 7 - Metro' },
          { _id: 'b8', name: 'Branch 8 - Central' },
        ];
        setBranches(defaultBranches);
        setActiveBranchId(defaultBranches[0]._id);
      }

      try {
        // Fetch real staff (pharmacists)
        const staffRes = await api.get('/staff');
        const mappedPharmacists = staffRes.data.map((staff, idx) => mapRealPharmacist(staff, idx));
        setPharmacists(mappedPharmacists);
      } catch (error) {
        console.error("Failed to fetch staff", error);
        // Fallback default mock pharmacists if server fails
        const fallbackStaff = [
          { _id: 'p1', name: 'Dr. Sarah L.', isActive: true },
          { _id: 'p2', name: 'Dr. James W.', isActive: true },
          { _id: 'p3', name: 'Dr. Maria G.', isActive: true },
          { _id: 'p4', name: 'Dr. Kevin O.', isActive: true },
          { _id: 'p5', name: 'Dr. Ryan K.', isActive: true },
          { _id: 'p6', name: 'Dr. Chris P.', isActive: false },
          { _id: 'p7', name: 'Dr. Alex T.', isActive: true },
          { _id: 'p8', name: 'Dr. Henry L.', isActive: true },
        ];
        setPharmacists(fallbackStaff.map((staff, idx) => mapRealPharmacist(staff, idx)));
      }
    };
    fetchInitialData();
  }, []);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing schedules from DB when year, month, branches, or pharmacists load
  useEffect(() => {
    const fetchSchedules = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(`/duty-schedules?year=${year}&month=${month}`);
        if (data && data.length > 0) {
          const monthShiftsObj = {};
          const monthRemarksObj = {};
          
          data.forEach(sched => {
            const restoredShifts = {};
            if (sched.shifts) {
              Object.entries(sched.shifts).forEach(([day, dayShifts]) => {
                restoredShifts[day] = {};
                if (dayShifts.morning && dayShifts.morning.pharmacistId) {
                  const ph = pharmacists.find(p => p.id === dayShifts.morning.pharmacistId || p._id === dayShifts.morning.pharmacistId) || null;
                  restoredShifts[day].morning = ph ? {
                    pharmacist: ph,
                    fromTime: dayShifts.morning.fromTime || '08:00',
                    toTime: dayShifts.morning.toTime || '16:00'
                  } : null;
                }
                if (dayShifts.evening && dayShifts.evening.pharmacistId) {
                  const ph = pharmacists.find(p => p.id === dayShifts.evening.pharmacistId || p._id === dayShifts.evening.pharmacistId) || null;
                  restoredShifts[day].evening = ph ? {
                    pharmacist: ph,
                    fromTime: dayShifts.evening.fromTime || '16:00',
                    toTime: dayShifts.evening.toTime || '23:59'
                  } : null;
                }
              });
            }
            monthShiftsObj[sched.branchId] = restoredShifts;
            monthRemarksObj[sched.branchId] = sched.remarks || {};
          });
          
          setBranchMonthShifts(monthShiftsObj);
          setBranchMonthRemarks(monthRemarksObj);
        } else {
          // If no schedules exist, pre-generate them
          const monthShiftsObj = {};
          branches.forEach(b => {
            monthShiftsObj[b._id] = generateMonthShifts(year, month, pharmacists);
          });
          setBranchMonthShifts(monthShiftsObj);
          setBranchMonthRemarks({});
        }
      } catch (error) {
        console.error('Failed to fetch duty schedules', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (branches.length > 0 && pharmacists.length > 0) {
      fetchSchedules();
    }
  }, [year, month, branches, pharmacists]);

  // Fallback for weekly views: initialize if empty
  useEffect(() => {
    if (!activeBranchId || pharmacists.length === 0) return;
    setBranchWeekShifts(prev => {
      if (prev[activeBranchId]) return prev;
      return { ...prev, [activeBranchId]: generateWeekShifts(weekDays, pharmacists) };
    });
  }, [viewMode, currentDate, activeBranchId, pharmacists]);

  // Reassign popover state
  const [popover, setPopover] = useState(null);
  const popoverRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Dismiss popover on scroll
  useEffect(() => {
    const handleScroll = (e) => {
      if (popover) {
        // Ignore scroll events originating from inside the popover itself (e.g. scrolling the staff list)
        if (popoverRef.current && popoverRef.current.contains(e.target)) {
          return;
        }
        // Hide instantly from DOM to prevent scroll stutter, defer React state update
        if (popoverRef.current) {
          popoverRef.current.style.display = 'none';
        }
        setTimeout(() => {
          setPopover(null);
        }, 150);
      }
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true, passive: true });
  }, [popover]);

  // Selected branch data
  const monthShifts = branchMonthShifts[activeBranchId] || {};
  const weekShifts = branchWeekShifts[activeBranchId] || {};
  const monthRemarks = branchMonthRemarks[activeBranchId] || {};
  const weekRemarks = branchWeekRemarks[activeBranchId] || {};

  const saveSchedules = async () => {
    setIsSaving(true);
    try {
      const savePromises = branches.map(b => {
        const bId = b._id;
        const shifts = branchMonthShifts[bId] || {};
        const remarks = branchMonthRemarks[bId] || {};
        
        // Serialize shifts map: store pharmacistId, fromTime, toTime in DB
        const cleanShifts = {};
        Object.entries(shifts).forEach(([day, dayShifts]) => {
          cleanShifts[day] = {};
          if (dayShifts.morning && dayShifts.morning.pharmacist) {
            cleanShifts[day].morning = {
              pharmacistId: dayShifts.morning.pharmacist._id || dayShifts.morning.pharmacist.id,
              fromTime: dayShifts.morning.fromTime || '08:00',
              toTime: dayShifts.morning.toTime || '16:00'
            };
          }
          if (dayShifts.evening && dayShifts.evening.pharmacist) {
            cleanShifts[day].evening = {
              pharmacistId: dayShifts.evening.pharmacist._id || dayShifts.evening.pharmacist.id,
              fromTime: dayShifts.evening.fromTime || '16:00',
              toTime: dayShifts.evening.toTime || '23:59'
            };
          }
        });

        return api.post('/duty-schedules/save', {
          branchId: bId,
          year,
          month,
          shifts: cleanShifts,
          remarks,
          notes
        });
      });

      await Promise.all(savePromises);
      alert('All duty schedules saved successfully!');
    } catch (error) {
      console.error('Failed to save duty schedules', error);
      alert('Error saving duty schedules: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'monthly') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'monthly') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const handleReassign = (key, shiftType, pharmacist, fromTime, toTime, branchId = popover?.branchId || activeBranchId) => {
    const finalFrom = fromTime || (shiftType === 'morning' ? '08:00' : '16:00');
    const finalTo = toTime || (shiftType === 'morning' ? '16:00' : '23:59');

    const assignment = {
      pharmacist,
      fromTime: finalFrom,
      toTime: finalTo
    };

    if (viewMode === 'monthly' || viewMode === 'matrix') {
      setBranchMonthShifts(prev => ({
        ...prev,
        [branchId]: {
          ...(prev[branchId] || {}),
          [key]: {
            ...((prev[branchId] || {})[key] || {}),
            [shiftType]: assignment
          }
        }
      }));
    } else {
      setBranchWeekShifts(prev => ({
        ...prev,
        [activeBranchId]: {
          ...(prev[activeBranchId] || {}),
          [key]: {
            ...((prev[activeBranchId] || {})[key] || {}),
            [shiftType]: assignment
          }
        }
      }));
    }
  };

  const openPopover = (e, key, shiftType, currentPharma, branchId = activeBranchId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ key, shiftType, currentPharma, rect, branchId });
  };

  // Build SHIFT_CONFIG with default times
  const SHIFT_CONFIG = {
    morning: { ...SHIFT_BASE.morning, time: '08:00 AM - 04:00 PM' },
    evening: { ...SHIFT_BASE.evening, time: '04:00 PM - 12:00 AM' },
  };

  // Stats for sidebar
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const morningFilled = Object.values(monthShifts).filter(d => d.morning).length;
  const eveningFilled = Object.values(monthShifts).filter(d => d.evening).length;

  // Weekly coverage
  const weekFilledCount = Object.values(weekShifts).reduce((acc, day) => {
    return acc + (day.morning ? 1 : 0) + (day.evening ? 1 : 0);
  }, 0);
  const weekCoveragePct = Math.round((weekFilledCount / (7 * 2)) * 100);

  const filteredStaff = pharmacists.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '1.5rem' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <CalendarDays size={28} color="var(--primary)" />
            Duty Scheduler
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.9rem' }}>
            Manage pharmacist duty assignments — {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Branch Selector */}
          {viewMode !== 'pharmacists' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '3px 8px 3px 12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch:</span>
              <select
                value={activeBranchId}
                onChange={e => setActiveBranchId(e.target.value)}
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {branches.map(b => (
                  <option key={b._id} value={b._id} style={{ fontWeight: 600 }}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '3px' }}>
            {['monthly', 'weekly', 'matrix', 'pharmacists'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  background: viewMode === mode ? 'var(--primary)' : 'transparent',
                  color: viewMode === mode ? 'white' : 'var(--text-muted)',
                }}
              >
                {mode === 'matrix' ? 'All Branches' : mode === 'pharmacists' ? 'Manage Staff' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Navigation */}
          {viewMode !== 'pharmacists' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button onClick={navigatePrev} className="btn-icon" style={{ border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-muted)' }}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={goToday} style={{ padding: '0.4rem 0.9rem', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', background: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Today
              </button>
              <button onClick={navigateNext} className="btn-icon" style={{ border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-muted)' }}>
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Save Schedule Changes */}
          {viewMode !== 'pharmacists' && (
            <button
              onClick={saveSchedules}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1.1rem',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(34,197,94,0.35)',
                transition: 'all 0.2s',
                opacity: isSaving ? 0.7 : 1
              }}
              onMouseOver={e => { if(!isSaving) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { if(!isSaving) e.currentTarget.style.transform = 'none'; }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>


      {/* ── Main Layout ── */}
      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>

        {/* ── Calendar / Grid Panel ── */}
        <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>Loading duty schedules...</span>
            </div>
          ) : viewMode === 'monthly' ? (
            <MonthlyView
              year={year} month={month} today={today}
              shifts={monthShifts}
              shiftConfig={SHIFT_CONFIG}
              onOpenPopover={openPopover}
              remarks={monthRemarks}
              onRemarkChange={(day, text) => setBranchMonthRemarks(prev => ({
                ...prev,
                [activeBranchId]: { ...(prev[activeBranchId] || {}), [day]: text }
              }))}
            />
          ) : viewMode === 'weekly' ? (
            <WeeklyView
              weekDays={weekDays}
              shifts={weekShifts}
              today={today}
              shiftConfig={SHIFT_CONFIG}
              onOpenPopover={openPopover}
              remarks={weekRemarks}
              onRemarkChange={(dateStr, text) => setBranchWeekRemarks(prev => ({
                ...prev,
                [activeBranchId]: { ...(prev[activeBranchId] || {}), [dateStr]: text }
              }))}
            />
          ) : viewMode === 'matrix' ? (
            <MatrixView
              year={year} month={month} today={today}
              branches={branches}
              branchShifts={branchMonthShifts}
              shiftConfig={SHIFT_CONFIG}
              onOpenPopover={openPopover}
              remarks={branchMonthRemarks}
              onRemarkChange={(branchId, day, text) => setBranchMonthRemarks(prev => ({
                ...prev,
                [branchId]: { ...(prev[branchId] || {}), [day]: text }
              }))}
            />
          ) : (
            <ManagePharmacistsView
              pharmacists={pharmacists}
              branches={branches}
              onRefresh={async () => {
                const staffRes = await api.get('/staff');
                const mappedPharmacists = staffRes.data.map((staff, idx) => mapRealPharmacist(staff, idx));
                setPharmacists(mappedPharmacists);
              }}
            />
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search */}
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              placeholder="Search staff…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.88rem', color: 'var(--text-main)', width: '100%' }}
            />
          </div>

          {/* Available Staff */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <Users size={16} color="var(--primary)" /> Available Staff
              </h3>
              <span style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                {pharmacists.filter(p => p.available).length} ONLINE
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1 }}>
              {filteredStaff.map(p => (
                <StaffCard key={p.id} pharmacist={p} />
              ))}
            </div>
          </div>

          {/* Stats Card */}
          <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', borderRadius: '12px', padding: '1rem', color: 'white', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <TrendingUp size={18} />
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                {viewMode === 'monthly' ? 'Duty Distribution' : 'Coverage Quality'}
              </span>
            </div>
            {viewMode === 'monthly' ? (
              <>
                <StatBar label="Morning Shift" value={Math.round(morningFilled / daysInMonth * 100)} />
                <StatBar label="Evening Shift" value={Math.round(eveningFilled / daysInMonth * 100)} />
              </>
            ) : (
              <>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{weekCoveragePct}%</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.5rem' }}>Weekly Coverage</div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ background: 'white', height: '100%', width: `${weekCoveragePct}%`, borderRadius: '99px', transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.5rem', fontStyle: 'italic' }}>
                  {weekCoveragePct >= 90 ? 'Excellent coverage this week.' : 'Some shifts are still unassigned.'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes & Remarks Panel ── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
          <FileText size={17} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Notes &amp; Remarks
          </h3>
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {MONTH_NAMES[month]} {year}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={`Add scheduling notes, shift swaps, special instructions, or remarks for ${MONTH_NAMES[month]} ${year}…`}
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            border: '1.5px solid rgba(0,0,0,0.09)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            fontSize: '0.88rem',
            color: 'var(--text-main)',
            background: 'rgba(255,255,255,0.6)',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--primary)'}
          onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.09)'}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {notes.length} characters
          </span>
        </div>
      </div>

      {/* ── Reassign Popover ── */}
      {popover && (
        <ReassignPopover
          ref={popoverRef}
          popover={popover}
          dayShifts={
            (viewMode === 'monthly' || viewMode === 'matrix')
              ? ((branchMonthShifts[popover.branchId || activeBranchId] || {})[popover.key] || {})
              : ((branchWeekShifts[popover.branchId || activeBranchId] || {})[popover.key] || {})
          }
          pharmacists={pharmacists}
          shiftConfig={SHIFT_CONFIG}
          allBranchesShifts={viewMode === 'monthly' || viewMode === 'matrix' ? branchMonthShifts : branchWeekShifts}
          currentBranchId={popover.branchId || activeBranchId}
          branches={branches}
          onReassign={(shiftType, pharma, fromTime, toTime) => handleReassign(popover.key, shiftType, pharma, fromTime, toTime, popover.branchId || activeBranchId)}
          onRemove={(shiftType) => {
            const targetBranchId = popover.branchId || activeBranchId;
            if (viewMode === 'monthly' || viewMode === 'matrix') {
              setBranchMonthShifts(prev => {
                const branchData = { ...(prev[targetBranchId] || {}) };
                const dayData = { ...(branchData[popover.key] || {}) };
                delete dayData[shiftType];
                branchData[popover.key] = dayData;
                return { ...prev, [targetBranchId]: branchData };
              });
            } else {
              setBranchWeekShifts(prev => {
                const branchData = { ...(prev[targetBranchId] || {}) };
                const dayData = { ...(branchData[popover.key] || {}) };
                delete dayData[shiftType];
                branchData[popover.key] = dayData;
                return { ...prev, [targetBranchId]: branchData };
              });
            }
            setPopover(null);
          }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
};

// ─── Monthly Calendar View ────────────────────────────────────────────────────
const MonthlyView = ({ year, month, today, shifts, shiftConfig, onOpenPopover, remarks, onRemarkChange }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const startCol = (startOffset + 6) % 7;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '1px solid rgba(0,0,0,0.05)' }}>{d}</div>
        ))}
      </div>
      {/* Calendar grid — increased row height */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 'minmax(140px,1fr)', flex: 1, overflowY: 'auto' }}>
        {Array.from({ length: startCol }, (_, i) => (
          <div key={`empty-${i}`} style={{ borderRight: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.015)' }} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const dayShifts = shifts[day] || {};
          return (
            <CalendarCell
              key={day}
              day={day}
              isToday={isToday}
              shifts={dayShifts}
              shiftConfig={shiftConfig}
              onOpenPopover={onOpenPopover}
              remark={remarks[day] || ''}
              onRemarkChange={onRemarkChange}
            />
          );
        })}
      </div>
    </div>
  );
};

const CalendarCell = ({ day, isToday, shifts, shiftConfig, onOpenPopover, remark, onRemarkChange }) => {
  const [hovered, setHovered] = useState(false);

  const handleAddClick = (e) => {
    // Find first unassigned shift
    let targetShiftType = 'morning';
    if (shifts.morning && !shifts.evening) {
      targetShiftType = 'evening';
    } else if (!shifts.morning) {
      targetShiftType = 'morning';
    }
    onOpenPopover(e, day, targetShiftType, shifts[targetShiftType] || null);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRight: '1px solid rgba(0,0,0,0.05)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        padding: '0.4rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        cursor: 'default',
        background: isToday ? 'rgba(99,102,241,0.04)' : hovered ? 'rgba(0,0,0,0.015)' : 'transparent',
        transition: 'background 0.15s',
        position: 'relative'
      }}
    >
      {/* Day number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700,
          width: '22px', height: '22px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%',
          background: isToday ? 'var(--primary)' : 'transparent',
          color: isToday ? 'white' : 'var(--text-muted)',
        }}>{day}</span>
        {hovered && (
          <button
            onClick={handleAddClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: 'var(--text-muted)', opacity: 0.7, display: 'flex' }}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      {/* Shift pills — taller and fuller */}
      {Object.entries(shiftConfig).map(([type, cfg]) => {
        const p = shifts[type];
        if (!p || !p.pharmacist) return null;
        return (
          <ShiftPill
            key={type}
            pharmacist={p.pharmacist}
            config={{ ...cfg, time: `${formatTime(p.fromTime)} - ${formatTime(p.toTime)}` }}
            onEdit={(e) => onOpenPopover(e, day, type, p)}
          />
        );
      })}
      {/* Remarks section */}
      <input
        type="text"
        placeholder="Add note..."
        value={remark}
        onChange={(e) => onRemarkChange(day, e.target.value)}
        style={{
          width: '100%',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: '4px',
          padding: '2px 4px',
          fontSize: '0.65rem',
          background: 'rgba(255,255,255,0.4)',
          color: 'var(--text-main)',
          outline: 'none',
          marginTop: 'auto',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--primary)';
          e.target.style.background = '#fff';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(0,0,0,0.06)';
          e.target.style.background = 'rgba(255,255,255,0.4)';
        }}
      />
    </div>
  );
};

const ShiftPill = ({ pharmacist, config, onEdit }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 7px',
      borderRadius: '6px',
      background: config.bg,
      borderLeft: `3px solid ${config.color}`,
      fontSize: '0.72rem',
      fontWeight: 600,
      color: config.color,
      cursor: 'pointer',
      overflow: 'hidden',
      transition: 'all 0.15s',
      minHeight: '28px',
    }}
    onClick={onEdit}
    title={`${pharmacist.name} — ${config.label} (${config.time})`}
  >
    {/* Avatar circle */}
    <div style={{
      width: '18px', height: '18px', borderRadius: '50%',
      background: `${config.color}22`,
      border: `1.5px solid ${config.color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.52rem', fontWeight: 800, color: config.color, flexShrink: 0,
    }}>{pharmacist.initials}</div>
    <div style={{ overflow: 'hidden', minWidth: 0 }}>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem', fontWeight: 700 }}>
        {pharmacist.name.replace('Dr. ', '')}
      </div>
      <div style={{ fontSize: '0.6rem', opacity: 0.75, fontWeight: 500 }}>
        {config.label} · {config.time}
      </div>
    </div>
  </div>
);

// ─── Weekly Grid View ────────────────────────────────────────────────────────
const WeeklyView = ({ weekDays, shifts, today, shiftConfig, onOpenPopover, remarks, onRemarkChange }) => {
  const todayStr = today.toISOString().split('T')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Grid header */}
      <div style={{ display: 'grid', gridTemplateColumns: '110px repeat(7,1fr)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '0.6rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderRight: '1px solid rgba(0,0,0,0.06)' }}>Shift</div>
        {weekDays.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0];
          const isToday = dateStr === todayStr;
          const isWeekend = i >= 5;
          return (
            <div key={dateStr} style={{ padding: '0.5rem', textAlign: 'center', borderRight: i < 6 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: isWeekend ? '#dc2626' : 'var(--text-muted)' }}>{DAY_NAMES_SHORT[i]}</div>
              <div style={{
                fontSize: '1.1rem', fontWeight: 800,
                color: isToday ? 'var(--primary)' : isWeekend ? '#dc2626' : 'var(--text-main)',
                background: isToday ? 'rgba(99,102,241,0.1)' : 'transparent',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto'
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      {/* Grid rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(shiftConfig).map(([shiftType, cfg]) => (
          <div key={shiftType} style={{ display: 'grid', gridTemplateColumns: '110px repeat(7,1fr)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            {/* Shift label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 0.5rem', background: cfg.bg, borderRight: '1px solid rgba(0,0,0,0.06)', minHeight: '130px', gap: '4px' }}>
              <cfg.Icon size={18} color={cfg.color} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
            </div>
            {/* Day cells */}
            {weekDays.map((d, i) => {
              const dateStr = d.toISOString().split('T')[0];
              const dayShifts = shifts[dateStr] || {};
              const pharma = dayShifts[shiftType];
              return (
                <WeekCell
                  key={dateStr}
                  isLast={i === 6}
                  pharmacist={pharma?.pharmacist}
                  config={pharma ? { ...cfg, time: `${formatTime(pharma.fromTime)} - ${formatTime(pharma.toTime)}` } : cfg}
                  onEdit={(e) => onOpenPopover(e, dateStr, shiftType, pharma)}
                />
              );
            })}
          </div>
        ))}
        {/* Weekly Remarks Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px repeat(7,1fr)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', background: 'rgba(0,0,0,0.02)', borderRight: '1px solid rgba(0,0,0,0.06)', minHeight: '50px', gap: '4px' }}>
            <FileText size={15} color="var(--text-muted)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Remarks</span>
          </div>
          {weekDays.map((d, i) => {
            const dateStr = d.toISOString().split('T')[0];
            const remark = remarks[dateStr] || '';
            return (
              <div key={dateStr} style={{ borderRight: i < 6 ? '1px solid rgba(0,0,0,0.06)' : 'none', padding: '0.4rem', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Add note..."
                  value={remark}
                  onChange={(e) => onRemarkChange(dateStr, e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid rgba(0,0,0,0.06)',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    fontSize: '0.7rem',
                    background: 'rgba(255,255,255,0.4)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0,0,0,0.06)';
                    e.target.style.background = 'rgba(255,255,255,0.4)';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const WeekCell = ({ isLast, pharmacist, config, onEdit }) => {
  const [hovered, setHovered] = useState(false);

  if (!pharmacist) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRight: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)',
          padding: '0.5rem',
          minHeight: '130px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: hovered ? 'rgba(0,0,0,0.02)' : 'transparent',
          transition: 'background 0.15s'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', border: '1.5px dashed rgba(0,0,0,0.15)', borderRadius: '8px', padding: '0.75rem', width: '100%' }}>
          <UserPlus size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>Unassigned</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRight: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)',
        padding: '0.5rem',
        minHeight: '130px',
        background: hovered ? config.bg : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        height: '100%',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: '8px',
        padding: '0.6rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: config.bg, border: `2px solid ${config.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 800, color: config.color, flexShrink: 0
          }}>{pharmacist.initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pharmacist.name}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pharmacist.designation}</div>
            <div style={{ fontSize: '0.62rem', color: config.color, fontWeight: 700, marginTop: '2px' }}>{config.time}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
          onClick={onEdit}
          style={{ alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', padding: '3px', borderRadius: '5px', display: 'flex', color: config.color, opacity: hovered ? 1 : 0.5, transition: 'opacity 0.15s' }}
        >
          <Edit2 size={13} />
        </button>
      </div>
    </div>
  </div>
);
};

// ─── Staff Card ───────────────────────────────────────────────────────────────
const StaffCard = ({ pharmacist }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.6rem 0.75rem',
        borderRadius: '10px',
        border: '1px solid rgba(0,0,0,0.07)',
        background: hovered ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: pharmacist.available ? 1 : 0.5,
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {pharmacist.profilePicture ? (
          <img
            src={pharmacist.profilePicture}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${pharmacist.color}`
            }}
            alt=""
          />
        ) : (
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: `${pharmacist.color}22`,
            border: `2px solid ${pharmacist.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 800, color: pharmacist.color
          }}>{pharmacist.initials}</div>
        )}
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          width: '9px', height: '9px', borderRadius: '50%',
          background: pharmacist.available ? '#22c55e' : '#9ca3af',
          border: '1.5px solid white'
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pharmacist.name}</p>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>{pharmacist.designation} • {pharmacist.rating}★</p>
      </div>
      <GripVertical size={14} color="var(--text-muted)" style={{ opacity: 0.4 }} />
    </div>
  );
};

// ─── Stat Bar ────────────────────────────────────────────────────────────────
const StatBar = ({ label, value }) => (
  <div style={{ marginBottom: '0.6rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
      <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>{label}</span>
      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{value}%</span>
    </div>
    <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', height: '5px', overflow: 'hidden' }}>
      <div style={{ background: 'white', height: '100%', width: `${value}%`, borderRadius: '99px', transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

// ─── Matrix (All Branches) Grid View ──────────────────────────────────────────
const MatrixView = ({ year, month, today, branches, branchShifts, shiftConfig, onOpenPopover, remarks, onRemarkChange }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', maxHeight: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', position: 'relative' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.95)', borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
              <th style={{
                position: 'sticky',
                top: 0,
                left: 0,
                zIndex: 4,
                background: 'rgba(255, 255, 255, 0.98)',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderRight: '2px solid rgba(0,0,0,0.08)',
                minWidth: '120px'
              }}>
                Date
              </th>
              {branches.map(branch => (
                <th key={branch._id} style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  background: 'rgba(255, 255, 255, 0.98)',
                  padding: '0.75rem 1rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderRight: '1px solid rgba(0,0,0,0.06)',
                  minWidth: '180px'
                }}>
                  {branch.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, idx) => {
              const day = idx + 1;
              const dateObj = new Date(year, month, day);
              const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

              return (
                <tr
                  key={day}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    background: isToday ? 'rgba(99,102,241,0.03)' : 'transparent'
                  }}
                >
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    background: isToday ? '#eef2ff' : 'rgba(255, 255, 255, 0.98)',
                    padding: '0.5rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                    borderRight: '2px solid rgba(0,0,0,0.08)',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: isToday ? 'var(--primary)' : 'transparent',
                        color: isToday ? 'white' : 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem'
                      }}>{day}</span>
                      <span>{dayName}</span>
                    </div>
                  </td>

                  {branches.map(branch => {
                    const bId = branch._id;
                    const shifts = (branchShifts[bId] || {})[day] || {};
                    const remark = (remarks[bId] || {})[day] || '';

                    return (
                      <MatrixCell
                        key={bId}
                        day={day}
                        branchId={bId}
                        shifts={shifts}
                        shiftConfig={shiftConfig}
                        onOpenPopover={onOpenPopover}
                        remark={remark}
                        onRemarkChange={onRemarkChange}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MatrixCell = ({ day, branchId, shifts, shiftConfig, onOpenPopover, remark, onRemarkChange }) => {
  const [hovered, setHovered] = useState(false);

  const handleAddClick = (e) => {
    let targetShiftType = 'morning';
    if (shifts.morning && !shifts.evening) {
      targetShiftType = 'evening';
    } else if (!shifts.morning) {
      targetShiftType = 'morning';
    }
    onOpenPopover(e, day, targetShiftType, shifts[targetShiftType] || null, branchId);
  };

  return (
    <td
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '0.4rem',
        borderRight: '1px solid rgba(0,0,0,0.05)',
        verticalAlign: 'top',
        height: '100%',
        minHeight: '100px',
        transition: 'background 0.15s',
        background: hovered ? 'rgba(0,0,0,0.01)' : 'transparent'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {Object.entries(shiftConfig).map(([type, cfg]) => {
            const p = shifts[type];
            if (!p || !p.pharmacist) return null;
            return (
              <ShiftPill
                key={type}
                pharmacist={p.pharmacist}
                config={{ ...cfg, time: `${formatTime(p.fromTime)} - ${formatTime(p.toTime)}` }}
                onEdit={(e) => onOpenPopover(e, day, type, p, branchId)}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto', paddingTop: '4px' }}>
          {hovered && (
            <button
              onClick={handleAddClick}
              style={{
                background: 'rgba(99,102,241,0.08)',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '4px',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '18px',
                width: '18px'
              }}
              title="Add shift assignment"
            >
              <Plus size={12} />
            </button>
          )}
          <input
            type="text"
            placeholder="Add note..."
            value={remark}
            onChange={(e) => onRemarkChange(branchId, day, e.target.value)}
            style={{
              flex: 1,
              border: '1px solid rgba(0,0,0,0.05)',
              borderRadius: '4px',
              padding: '1px 3px',
              fontSize: '0.62rem',
              background: 'rgba(255,255,255,0.4)',
              color: 'var(--text-main)',
              outline: 'none',
              minWidth: '60px',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.background = '#fff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,0,0,0.05)';
              e.target.style.background = 'rgba(255,255,255,0.4)';
            }}
          />
        </div>
      </div>
    </td>
  );
};

// ─── Reassign Popover ─────────────────────────────────────────────────────────
const ReassignPopover = forwardRef(({ popover, dayShifts, pharmacists, shiftConfig, allBranchesShifts, currentBranchId, branches, onReassign, onRemove, onClose }, ref) => {
  const { rect } = popover;
  const [activeShiftType, setActiveShiftType] = useState(popover.shiftType);

  const currentPharma = dayShifts[activeShiftType] || null;
  const cfg = shiftConfig[activeShiftType];

  const [fromTime, setFromTime] = useState('08:00');
  const [toTime, setToTime] = useState('16:00');

  useEffect(() => {
    if (currentPharma) {
      setFromTime(currentPharma.fromTime || (activeShiftType === 'morning' ? '08:00' : '16:00'));
      setToTime(currentPharma.toTime || (activeShiftType === 'morning' ? '16:00' : '23:59'));
    } else {
      setFromTime(activeShiftType === 'morning' ? '08:00' : '16:00');
      setToTime(activeShiftType === 'morning' ? '16:00' : '23:59');
    }
  }, [activeShiftType, currentPharma]);

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward = spaceBelow < 300 && spaceAbove > spaceBelow;

  // Calculate dynamic maximum height to fit the screen context
  const optimalMaxHeight = openUpward
    ? Math.max(200, spaceAbove - 24)
    : Math.max(200, spaceBelow - 24);
  const finalMaxHeight = Math.min(440, optimalMaxHeight);

  const style = {
    position: 'fixed',
    zIndex: 9999,
    width: '240px',
    top: openUpward 
      ? `${Math.max(10, rect.top - finalMaxHeight - 8)}px` 
      : `${Math.min(window.innerHeight - finalMaxHeight - 16, rect.bottom + 8)}px`,
    left: `${Math.max(270, Math.min(window.innerWidth - 250, rect.left - 150))}px`,
    maxHeight: `${finalMaxHeight}px`,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255,255,255,0.97)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '14px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    padding: '0.85rem',
    animation: 'scaleUp 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  };

  const timesOverlap = (from1, to1, from2, to2) => {
    if (!from1 || !to1 || !from2 || !to2) return false;
    const toMins = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const start1 = toMins(from1);
    const end1 = toMins(to1);
    const start2 = toMins(from2);
    const end2 = toMins(to2);
    return start1 < end2 && start2 < end1;
  };

  const getBusyDetails = (p) => {
    if (!allBranchesShifts) return null;
    let busyInfo = null;
    Object.entries(allBranchesShifts).forEach(([bId, dayMap]) => {
      const dayData = dayMap?.[popover.key] || {};
      Object.entries(dayData).forEach(([sType, shiftAssignment]) => {
        if (bId === currentBranchId && sType === activeShiftType) {
          return;
        }
        if (shiftAssignment && shiftAssignment.pharmacist && shiftAssignment.pharmacist.id === p.id) {
          if (timesOverlap(fromTime, toTime, shiftAssignment.fromTime, shiftAssignment.toTime)) {
            const brName = branches.find(b => b._id === bId)?.name || 'Other Branch';
            busyInfo = {
              branchName: brName,
              fromTime: shiftAssignment.fromTime,
              toTime: shiftAssignment.toTime
            };
          }
        }
      });
    });
    return busyInfo;
  };

  return (
    <div ref={ref} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexShrink: 0 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: cfg.color }}>Assign {cfg.label}</h4>
          {currentPharma && currentPharma.pharmacist ? (
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current: {currentPharma.pharmacist.name}</p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unassigned</p>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>

      {/* Shift Selector Tabs */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', borderRadius: '8px', padding: '2px', marginBottom: '0.6rem', flexShrink: 0 }}>
        {Object.entries(shiftConfig).map(([type, sCfg]) => {
          const isActive = activeShiftType === type;
          return (
            <button
              key={type}
              onClick={() => setActiveShiftType(type)}
              style={{
                flex: 1,
                padding: '0.35rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 700,
                transition: 'all 0.15s ease',
                background: isActive ? 'white' : 'transparent',
                color: isActive ? sCfg.color : 'var(--text-muted)',
                boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <sCfg.Icon size={12} color={isActive ? sCfg.color : 'var(--text-muted)'} />
              {sCfg.label}
            </button>
          );
        })}
      </div>

      {/* Time Range Pickers */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>From</span>
          <input
            type="time"
            value={fromTime}
            onChange={e => {
              const val = e.target.value;
              setFromTime(val);
              if (currentPharma && currentPharma.pharmacist) {
                onReassign(activeShiftType, currentPharma.pharmacist, val, toTime);
              }
            }}
            style={{
              padding: '0.3rem 0.45rem',
              borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>To</span>
          <input
            type="time"
            value={toTime}
            onChange={e => {
              const val = e.target.value;
              setToTime(val);
              if (currentPharma && currentPharma.pharmacist) {
                onReassign(activeShiftType, currentPharma.pharmacist, fromTime, val);
              }
            }}
            style={{
              padding: '0.3rem 0.45rem',
              borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '0.4rem 0', flexShrink: 0 }} />
      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', flexShrink: 0 }}>Select Staff</p>
      
      {/* Scrollable Staff list container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1, minHeight: '80px', marginBottom: '0.5rem' }}>
        {pharmacists.filter(p => p.available).map(p => {
          const busy = getBusyDetails(p);
          return (
            <button
              key={p.id}
              disabled={!!busy}
              onClick={() => {
                const finalFrom = p.defaultFromTime || fromTime;
                const finalTo = p.defaultToTime || toTime;
                onReassign(activeShiftType, p, finalFrom, finalTo);
                onClose();
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 0.6rem', border: 'none',
                borderRadius: '8px', cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'left', width: '100%',
                background: currentPharma?.pharmacist?.id === p.id ? 'var(--primary-light)' : 'transparent',
                color: busy ? 'var(--text-muted)' : (currentPharma?.pharmacist?.id === p.id ? 'var(--primary)' : 'var(--text-main)'),
                fontWeight: currentPharma?.pharmacist?.id === p.id ? 700 : 500,
                fontSize: '0.82rem',
                transition: 'background 0.15s',
                flexShrink: 0,
                opacity: busy ? 0.6 : 1
              }}
              onMouseOver={e => { if (currentPharma?.pharmacist?.id !== p.id && !busy) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseOut={e => { if (currentPharma?.pharmacist?.id !== p.id && !busy) e.currentTarget.style.background = 'transparent'; }}
            >
              {p.profilePicture ? (
                <img src={p.profilePicture} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
              ) : (
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: busy ? '#e5e7eb' : `${p.color}22`, border: `1.5px solid ${busy ? '#9ca3af' : p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: busy ? '#9ca3af' : p.color, flexShrink: 0 }}>{p.initials}</div>
              )}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{p.name}</div>
                {busy && (
                  <div style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 600, marginTop: '2px', whiteSpace: 'normal' }}>
                    Busy: {busy.branchName} ({formatTime(busy.fromTime)} - {formatTime(busy.toTime)})
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '0.4rem 0', flexShrink: 0 }} />
      <button
        onClick={() => onRemove(activeShiftType)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', padding: '0.4rem 0.6rem', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, transition: 'background 0.15s', flexShrink: 0 }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
      >
        <AlertCircle size={14} /> Remove Assignment
      </button>
    </div>
  );
});

// ─── Manage Pharmacists View Sub-module ──────────────────────────────────────
const ManagePharmacistsView = ({ pharmacists, branches, onRefresh }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // New staff states
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffDesignation, setNewStaffDesignation] = useState('');
  const [newStaffRating, setNewStaffRating] = useState('5.0');
  const [newStaffProfilePic, setNewStaffProfilePic] = useState('');
  const [newStaffLicenseNum, setNewStaffLicenseNum] = useState('');
  const [newStaffLicenseExpiry, setNewStaffLicenseExpiry] = useState('');
  const [newStaffPassportNum, setNewStaffPassportNum] = useState('');
  const [newStaffPassportExpiry, setNewStaffPassportExpiry] = useState('');
  const [newStaffIdCardNum, setNewStaffIdCardNum] = useState('');
  const [newStaffIdCardExpiry, setNewStaffIdCardExpiry] = useState('');
  const [newStaffRemarks, setNewStaffRemarks] = useState('');
  const [newStaffDefaultBranch, setNewStaffDefaultBranch] = useState('');
  const [newStaffDefaultShift, setNewStaffDefaultShift] = useState('');
  const [newStaffDefaultFrom, setNewStaffDefaultFrom] = useState('');
  const [newStaffDefaultTo, setNewStaffDefaultTo] = useState('');
  const [newStaffOffDay, setNewStaffOffDay] = useState('');

  // Editing staff states
  const [editingStaffId, setEditingStaffId] = useState('');
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPin, setEditStaffPin] = useState('');
  const [editStaffDesignation, setEditStaffDesignation] = useState('');
  const [editStaffRating, setEditStaffRating] = useState('5.0');
  const [editStaffProfilePic, setEditStaffProfilePic] = useState('');
  const [editStaffLicenseNum, setEditStaffLicenseNum] = useState('');
  const [editStaffLicenseExpiry, setEditStaffLicenseExpiry] = useState('');
  const [editStaffPassportNum, setEditStaffPassportNum] = useState('');
  const [editStaffPassportExpiry, setEditStaffPassportExpiry] = useState('');
  const [editStaffIdCardNum, setEditStaffIdCardNum] = useState('');
  const [editStaffIdCardExpiry, setEditStaffIdCardExpiry] = useState('');
  const [editStaffRemarks, setEditStaffRemarks] = useState('');
  const [editStaffDefaultBranch, setEditStaffDefaultBranch] = useState('');
  const [editStaffDefaultShift, setEditStaffDefaultShift] = useState('');
  const [editStaffDefaultFrom, setEditStaffDefaultFrom] = useState('');
  const [editStaffDefaultTo, setEditStaffDefaultTo] = useState('');
  const [editStaffOffDay, setEditStaffOffDay] = useState('');

  const handleFileChange = (e, setPic) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newStaffName,
        pin: newStaffPin,
        designation: newStaffDesignation || undefined,
        rating: newStaffRating ? parseFloat(newStaffRating) : undefined,
        profilePicture: newStaffProfilePic || undefined,
        licenseNumber: newStaffLicenseNum || undefined,
        licenseExpiry: newStaffLicenseExpiry || undefined,
        passportNumber: newStaffPassportNum || undefined,
        passportExpiry: newStaffPassportExpiry || undefined,
        idCardNumber: newStaffIdCardNum || undefined,
        idCardExpiry: newStaffIdCardExpiry || undefined,
        remarks: newStaffRemarks || undefined,
        defaultBranch: newStaffDefaultBranch || undefined,
        defaultShiftType: newStaffDefaultShift || undefined,
        defaultFromTime: newStaffDefaultFrom || undefined,
        defaultToTime: newStaffDefaultTo || undefined,
        defaultOffDay: newStaffOffDay || undefined
      };
      await api.post('/staff', payload);
      setIsAddModalOpen(false);
      
      // Reset new staff states
      setNewStaffName('');
      setNewStaffPin('');
      setNewStaffDesignation('');
      setNewStaffRating('5.0');
      setNewStaffProfilePic('');
      setNewStaffLicenseNum('');
      setNewStaffLicenseExpiry('');
      setNewStaffPassportNum('');
      setNewStaffPassportExpiry('');
      setNewStaffIdCardNum('');
      setNewStaffIdCardExpiry('');
      setNewStaffRemarks('');
      setNewStaffDefaultBranch('');
      setNewStaffDefaultShift('');
      setNewStaffDefaultFrom('');
      setNewStaffDefaultTo('');
      setNewStaffOffDay('');

      await onRefresh();
      alert('Pharmacist Registered Successfully');
    } catch (error) {
      alert('Error registering pharmacist');
    }
  };

  const handleEditStaff = (staff) => {
    setEditingStaffId(staff.id || staff._id);
    setEditStaffName(staff.name.replace('Dr. ', ''));
    setEditStaffPin('');
    setEditStaffDesignation(staff.designation || '');
    setEditStaffRating(staff.rating !== undefined ? String(staff.rating) : '5.0');
    setEditStaffProfilePic(staff.profilePicture || '');
    setEditStaffLicenseNum(staff.licenseNumber || '');
    setEditStaffLicenseExpiry(staff.licenseExpiry || '');
    setEditStaffPassportNum(staff.passportNumber || '');
    setEditStaffPassportExpiry(staff.passportExpiry || '');
    setEditStaffIdCardNum(staff.idCardNumber || '');
    setEditStaffIdCardExpiry(staff.idCardExpiry || '');
    setEditStaffRemarks(staff.remarks || '');
    setEditStaffDefaultBranch(staff.defaultBranch || '');
    setEditStaffDefaultShift(staff.defaultShiftType || '');
    setEditStaffDefaultFrom(staff.defaultFromTime || '');
    setEditStaffDefaultTo(staff.defaultToTime || '');
    setEditStaffOffDay(staff.defaultOffDay || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        name: editStaffName,
        designation: editStaffDesignation,
        rating: editStaffRating ? parseFloat(editStaffRating) : 5.0,
        profilePicture: editStaffProfilePic,
        licenseNumber: editStaffLicenseNum,
        licenseExpiry: editStaffLicenseExpiry || null,
        passportNumber: editStaffPassportNum,
        passportExpiry: editStaffPassportExpiry || null,
        idCardNumber: editStaffIdCardNum,
        idCardExpiry: editStaffIdCardExpiry || null,
        remarks: editStaffRemarks,
        defaultBranch: editStaffDefaultBranch || null,
        defaultShiftType: editStaffDefaultShift,
        defaultFromTime: editStaffDefaultFrom,
        defaultToTime: editStaffDefaultTo,
        defaultOffDay: editStaffOffDay
      };
      if (editStaffPin) payload.pin = editStaffPin;
      await api.put(`/staff/${editingStaffId}`, payload);
      setIsEditModalOpen(false);
      setEditingStaffId('');
      setEditStaffName('');
      setEditStaffPin('');
      setEditStaffDesignation('');
      setEditStaffRating('5.0');
      setEditStaffProfilePic('');
      setEditStaffLicenseNum('');
      setEditStaffLicenseExpiry('');
      setEditStaffPassportNum('');
      setEditStaffPassportExpiry('');
      setEditStaffIdCardNum('');
      setEditStaffIdCardExpiry('');
      setEditStaffRemarks('');
      setEditStaffDefaultBranch('');
      setEditStaffDefaultShift('');
      setEditStaffDefaultFrom('');
      setEditStaffDefaultTo('');
      setEditStaffOffDay('');
      await onRefresh();
      alert('Pharmacist Updated Successfully');
    } catch (error) {
      alert('Error updating pharmacist');
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this pharmacist?')) return;
    try {
      await api.delete(`/staff/${id}`);
      await onRefresh();
    } catch (error) {
      alert('Error deleting pharmacist');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Staff Directory</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>Manage active pharmacists, credentials, and default schedules</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            padding: '0.5rem 1.1rem',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#4338ca'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--primary)'}
        >
          <Plus size={16} /> Register Staff
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', background: 'rgba(255,255,255,0.4)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.6)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>#</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Name</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Designation</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Rating</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Default Branch</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pharmacists.map((p, idx) => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.15s' }}>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {p.profilePicture ? (
                      <img src={p.profilePicture} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    ) : (
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: `${p.color}22`, border: `1.5px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, color: p.color }}>{p.initials}</div>
                    )}
                    {p.name}
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{p.designation}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>{p.rating} ★</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div>{p.defaultBranchObj?.name || 'Flexible'}</div>
                  {p.defaultOffDay && (
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(239,68,68,0.08)',
                      color: '#dc2626',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      marginTop: '3px'
                    }}>
                      Off: {p.defaultOffDay}
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: p.available ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: p.available ? '#16a34a' : '#dc2626'
                  }}>
                    {p.available ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleEditStaff(p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--primary)', marginRight: '0.5rem' }}
                    title="Edit Pharmacist"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(p.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#ef4444' }}
                    title="Delete Pharmacist"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
        }}>
          <div className="glass-panel" style={{ width: '850px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#fff', borderRadius: '14px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Register New Staff</h3>
            
            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Row 1: Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '170px 1.5fr 1fr 1.2fr 80px', gap: '0.85rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f3f4f6', border: '1.5px dashed rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {newStaffProfilePic ? (
                      <img src={newStaffProfilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    ) : (
                      <Users size={18} color="#9ca3af" />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Profile Photo</span>
                    <label style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--primary)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}>
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileChange(e, setNewStaffProfilePic)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Name</span>
                  <input
                    type="text" required placeholder="e.g. Sarah Connor"
                    value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>PIN Code</span>
                  <input
                    type="password" required placeholder="PIN Code"
                    value={newStaffPin} onChange={e => setNewStaffPin(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Designation</span>
                  <input
                    type="text" placeholder="e.g. Senior Pharmacist"
                    value={newStaffDesignation} onChange={e => setNewStaffDesignation(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Rating</span>
                  <input
                    type="number" step="0.1" min="1" max="5" required placeholder="4.8"
                    value={newStaffRating} onChange={e => setNewStaffRating(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* Row 2: Document Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.015)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                {/* Column 1: License */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>License Details</span>
                  <input
                    type="text" placeholder="License Number"
                    value={newStaffLicenseNum} onChange={e => setNewStaffLicenseNum(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Expiry</span>
                    <input
                      type="date"
                      value={newStaffLicenseExpiry} onChange={e => setNewStaffLicenseExpiry(e.target.value)}
                      style={{ flex: 1, padding: '0.3rem 0.45rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>

                {/* Column 2: Passport */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Passport Details</span>
                  <input
                    type="text" placeholder="Passport Number"
                    value={newStaffPassportNum} onChange={e => setNewStaffPassportNum(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Expiry</span>
                    <input
                      type="date"
                      value={newStaffPassportExpiry} onChange={e => setNewStaffPassportExpiry(e.target.value)}
                      style={{ flex: 1, padding: '0.3rem 0.45rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>

                {/* Column 3: National ID */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>ID Card Details</span>
                  <input
                    type="text" placeholder="ID Number"
                    value={newStaffIdCardNum} onChange={e => setNewStaffIdCardNum(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Expiry</span>
                    <input
                      type="date"
                      value={newStaffIdCardExpiry} onChange={e => setNewStaffIdCardExpiry(e.target.value)}
                      style={{ flex: 1, padding: '0.3rem 0.45rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Fixed Schedule Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(99,102,241,0.02)', border: '1px solid rgba(99,102,241,0.08)', padding: '0.65rem 0.85rem', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Fixed Schedule Settings (Defaults)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.1fr 1.2fr', gap: '0.75rem', alignItems: 'end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Default Branch</span>
                    <select
                      value={newStaffDefaultBranch} onChange={e => setNewStaffDefaultBranch(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: 'white', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="">Flexible (None)</option>
                      {branches.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Default Shift</span>
                    <select
                      value={newStaffDefaultShift} onChange={e => setNewStaffDefaultShift(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: 'white', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="">None</option>
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Default Off Day</span>
                    <select
                      value={newStaffOffDay} onChange={e => setNewStaffOffDay(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: 'white', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="">None (Flexible)</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>From</span>
                      <input
                        type="time" value={newStaffDefaultFrom} onChange={e => setNewStaffDefaultFrom(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.3rem 0.4rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>To</span>
                      <input
                        type="time" value={newStaffDefaultTo} onChange={e => setNewStaffDefaultTo(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.3rem 0.4rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Remarks & Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Remarks & Performance Issues</span>
                  <input
                    type="text"
                    placeholder="Record any warnings, remarks, or specific scheduling restrictions..."
                    value={newStaffRemarks} onChange={e => setNewStaffRemarks(e.target.value)}
                    style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '0.45rem 1rem', border: 'none', borderRadius: '6px', background: 'rgba(0,0,0,0.05)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ padding: '0.45rem 1.25rem', border: 'none', borderRadius: '6px', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Register</button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {isEditModalOpen && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000
        }}>
          <div className="glass-panel" style={{ width: '850px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#fff', borderRadius: '14px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Edit Staff Member</h3>
            
            <form onSubmit={handleUpdateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Row 1: Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '170px 1.5fr 1fr 1.2fr 80px', gap: '0.85rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f3f4f6', border: '1.5px dashed rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {editStaffProfilePic ? (
                      <img src={editStaffProfilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    ) : (
                      <Users size={18} color="#9ca3af" />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Profile Photo</span>
                    <label style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--primary)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}>
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileChange(e, setEditStaffProfilePic)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Name</span>
                  <input
                    type="text" required placeholder="e.g. Sarah Connor"
                    value={editStaffName} onChange={e => setEditStaffName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Change PIN (Optional)</span>
                  <input
                    type="password" placeholder="Leave blank to keep current"
                    value={editStaffPin} onChange={e => setEditStaffPin(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Designation</span>
                  <input
                    type="text" placeholder="e.g. Senior Pharmacist"
                    value={editStaffDesignation} onChange={e => setEditStaffDesignation(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Rating</span>
                  <input
                    type="number" step="0.1" min="1" max="5" required placeholder="4.8"
                    value={editStaffRating} onChange={e => setEditStaffRating(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* Row 2: Document Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.015)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                {/* Column 1: License */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>License Details</span>
                  <input
                    type="text" placeholder="License Number"
                    value={editStaffLicenseNum} onChange={e => setEditStaffLicenseNum(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Expiry</span>
                    <input
                      type="date"
                      value={editStaffLicenseExpiry} onChange={e => setEditStaffLicenseExpiry(e.target.value)}
                      style={{ flex: 1, padding: '0.3rem 0.45rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>

                {/* Column 2: Passport */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Passport Details</span>
                  <input
                    type="text" placeholder="Passport Number"
                    value={editStaffPassportNum} onChange={e => setEditStaffPassportNum(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Expiry</span>
                    <input
                      type="date"
                      value={editStaffPassportExpiry} onChange={e => setEditStaffPassportExpiry(e.target.value)}
                      style={{ flex: 1, padding: '0.3rem 0.45rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>

                {/* Column 3: National ID */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>ID Card Details</span>
                  <input
                    type="text" placeholder="ID Number"
                    value={editStaffIdCardNum} onChange={e => setEditStaffIdCardNum(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.8rem' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Expiry</span>
                    <input
                      type="date"
                      value={editStaffIdCardExpiry} onChange={e => setEditStaffIdCardExpiry(e.target.value)}
                      style={{ flex: 1, padding: '0.3rem 0.45rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Fixed Schedule Settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(99,102,241,0.02)', border: '1px solid rgba(99,102,241,0.08)', padding: '0.65rem 0.85rem', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Fixed Schedule Settings (Defaults)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.1fr 1.2fr', gap: '0.75rem', alignItems: 'end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Default Branch</span>
                    <select
                      value={editStaffDefaultBranch} onChange={e => setEditStaffDefaultBranch(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: 'white', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="">Flexible (None)</option>
                      {branches.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Default Shift</span>
                    <select
                      value={editStaffDefaultShift} onChange={e => setEditStaffDefaultShift(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: 'white', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="">None</option>
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>Default Off Day</span>
                    <select
                      value={editStaffOffDay} onChange={e => setEditStaffOffDay(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', background: 'white', fontSize: '0.8rem', outline: 'none' }}
                    >
                      <option value="">None (Flexible)</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                      <option value="Sunday">Sunday</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>From</span>
                      <input
                        type="time" value={editStaffDefaultFrom} onChange={e => setEditStaffDefaultFrom(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.3rem 0.4rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>To</span>
                      <input
                        type="time" value={editStaffDefaultTo} onChange={e => setEditStaffDefaultTo(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.3rem 0.4rem', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Remarks & Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Remarks & Performance Issues</span>
                  <input
                    type="text"
                    placeholder="Record any warnings, remarks, or specific scheduling restrictions..."
                    value={editStaffRemarks} onChange={e => setEditStaffRemarks(e.target.value)}
                    style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '0.45rem 1rem', border: 'none', borderRadius: '6px', background: 'rgba(0,0,0,0.05)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ padding: '0.45rem 1.25rem', border: 'none', borderRadius: '6px', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

ReassignPopover.displayName = 'ReassignPopover';

export default DutyScheduler;
