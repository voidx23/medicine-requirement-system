import { useState, useRef, useEffect, forwardRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2,
  UserPlus, Users, TrendingUp, Sun, Sunset, Search,
  GripVertical, AlertCircle, FileText, Clock
} from 'lucide-react';
import api from '../services/api';


// â”€â”€â”€ Real Staff Mapping Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// Format Date object to local YYYY-MM-DD string
function formatDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
    const key = formatDateKey(date);
    result[key] = {
      morning: null,
      evening: null
    };
  });
  return result;
}

// â”€â”€â”€ Helper Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DutyScheduler = () => {
  const today = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const viewMode = ['monthly', 'weekly', 'matrix'].includes(tabParam) ? tabParam : 'monthly';

  const setViewMode = (mode) => {
    setSearchParams({ tab: mode });
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

  // Populate weekly views from monthly shifts on load or date change
  useEffect(() => {
    if (pharmacists.length === 0 || branches.length === 0) return;
    
    setBranchWeekShifts(prev => {
      const updatedWeekShifts = { ...prev };
      branches.forEach(b => {
        const bId = b._id;
        const monthShifts = branchMonthShifts[bId] || {};
        const weekShifts = {};
        
        weekDays.forEach(d => {
          const dateStr = formatDateKey(d);
          const dYear = d.getFullYear();
          const dMonth = d.getMonth();
          const dDay = d.getDate();
          
          if (dYear === year && dMonth === month) {
            weekShifts[dateStr] = monthShifts[dDay] || { morning: null, evening: null };
          } else {
            weekShifts[dateStr] = (prev[bId] && prev[bId][dateStr]) || { morning: null, evening: null };
          }
        });
        updatedWeekShifts[bId] = weekShifts;
      });
      return updatedWeekShifts;
    });

    setBranchWeekRemarks(prev => {
      const updatedWeekRemarks = { ...prev };
      branches.forEach(b => {
        const bId = b._id;
        const monthRemarks = branchMonthRemarks[bId] || {};
        const weekRemarks = {};
        
        weekDays.forEach(d => {
          const dateStr = formatDateKey(d);
          const dYear = d.getFullYear();
          const dMonth = d.getMonth();
          const dDay = d.getDate();
          
          if (dYear === year && dMonth === month) {
            weekRemarks[dateStr] = monthRemarks[dDay] || '';
          } else {
            weekRemarks[dateStr] = (prev[bId] && prev[bId][dateStr]) || '';
          }
        });
        updatedWeekRemarks[bId] = weekRemarks;
      });
      return updatedWeekRemarks;
    });
  }, [branchMonthShifts, branchMonthRemarks, currentDate, pharmacists, branches]);

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
      // Weekly view: update weekly shifts
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

      // Also sync to monthly shifts in memory if it falls in the current month
      const parts = key.split('-');
      const dYear = parseInt(parts[0], 10);
      const dMonth = parseInt(parts[1], 10) - 1;
      const dDay = parseInt(parts[2], 10);

      if (dYear === year && dMonth === month) {
        setBranchMonthShifts(prev => ({
          ...prev,
          [activeBranchId]: {
            ...(prev[activeBranchId] || {}),
            [dDay]: {
              ...((prev[activeBranchId] || {})[dDay] || {}),
              [shiftType]: assignment
            }
          }
        }));
      }
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
      {/* â”€â”€ Page Header â”€â”€ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <CalendarDays size={28} color="var(--primary)" />
            Duty Scheduler
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.9rem' }}>
            Manage pharmacist duty assignments â€” {MONTH_NAMES[month]} {year}
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
            {['monthly', 'weekly', 'matrix'].map(mode => (
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
                {mode === 'matrix' ? 'All Branches' : mode.charAt(0).toUpperCase() + mode.slice(1)}
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


      {/* â”€â”€ Main Layout â”€â”€ */}
      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>

        {/* â”€â”€ Calendar / Grid Panel â”€â”€ */}
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
              onRemarkChange={(dateStr, text) => {
                setBranchWeekRemarks(prev => ({
                  ...prev,
                  [activeBranchId]: { ...(prev[activeBranchId] || {}), [dateStr]: text }
                }));
                const parts = dateStr.split('-');
                const dYear = parseInt(parts[0], 10);
                const dMonth = parseInt(parts[1], 10) - 1;
                const dDay = parseInt(parts[2], 10);
                if (dYear === year && dMonth === month) {
                  setBranchMonthRemarks(prev => ({
                    ...prev,
                    [activeBranchId]: { ...(prev[activeBranchId] || {}), [dDay]: text }
                  }));
                }
              }}
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
          )}
        </div>

        {/* â”€â”€ Right Sidebar â”€â”€ */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search */}
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              placeholder="Search staffâ€¦"
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

      {/* â”€â”€ Notes & Remarks Panel â”€â”€ */}
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
          placeholder={`Add scheduling notes, shift swaps, special instructions, or remarks for ${MONTH_NAMES[month]} ${year}â€¦`}
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

      {/* â”€â”€ Reassign Popover â”€â”€ */}
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
              const parts = popover.key.split('-');
              const dYear = parseInt(parts[0], 10);
              const dMonth = parseInt(parts[1], 10) - 1;
              const dDay = parseInt(parts[2], 10);
              if (dYear === year && dMonth === month) {
                setBranchMonthShifts(prev => {
                  const branchData = { ...(prev[targetBranchId] || {}) };
                  const dayData = { ...(branchData[dDay] || {}) };
                  delete dayData[shiftType];
                  branchData[dDay] = dayData;
                  return { ...prev, [targetBranchId]: branchData };
                });
              }
            }
            setPopover(null);
          }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
};

// â”€â”€â”€ Monthly Calendar View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      {/* Calendar grid â€” increased row height */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: 'minmax(140px,1fr)', flex: 1, overflowY: 'auto' }}>
        {Array.from({ length: startCol }, (_, i) => (
          <div key={`empty-${i}`} style={{ borderRight: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.015)' }} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const dayShifts = shifts[day] || {};
          const cellDate = new Date(year, month, day);
          cellDate.setHours(23, 59, 59, 999);
          const isPast = cellDate < today;
          return (
            <CalendarCell
              key={day}
              day={day}
              isToday={isToday}
              isPast={isPast}
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

const CalendarCell = ({ day, isToday, shifts, shiftConfig, onOpenPopover, remark, onRemarkChange, isPast }) => {
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
        background: isPast ? 'rgba(0,0,0,0.015)' : isToday ? 'rgba(99,102,241,0.04)' : hovered ? 'rgba(0,0,0,0.015)' : 'transparent',
        transition: 'background 0.15s',
        position: 'relative',
        opacity: isPast ? 0.75 : 1
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
        {hovered && !isPast && (
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
            isPast={isPast}
          />
        );
      })}
      {/* Remarks section */}
      <input
        type="text"
        disabled={isPast}
        placeholder={isPast ? "" : "Add note..."}
        value={remark}
        onChange={(e) => onRemarkChange(day, e.target.value)}
        style={{
          width: '100%',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: '4px',
          padding: '2px 4px',
          fontSize: '0.65rem',
          background: isPast ? 'transparent' : 'rgba(255,255,255,0.4)',
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

const ShiftPill = ({ pharmacist, config, onEdit, isPast }) => (
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
      cursor: isPast ? 'default' : 'pointer',
      overflow: 'hidden',
      transition: 'all 0.15s',
      minHeight: '28px',
      opacity: isPast ? 0.8 : 1
    }}
    onClick={isPast ? undefined : onEdit}
    title={isPast ? `${pharmacist.name} — ${config.label} (${config.time}) [Past Shift]` : `${pharmacist.name} — ${config.label} (${config.time})`}
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

// ─── Weekly Grid View ──────────────────────────────────────────────────────────
const WeeklyView = ({ weekDays, shifts, today, shiftConfig, onOpenPopover, remarks, onRemarkChange }) => {
  const todayStr = formatDateKey(today);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Scrollable Container for both vertical & horizontal scrolling */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '110px repeat(7, minmax(max-content, 1fr))',
          minWidth: 'fit-content'
        }}>
          {/* Sticky Grid header cells */}
          <div style={{ 
            padding: '0.6rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, 
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', 
            borderRight: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.08)',
            position: 'sticky', top: 0, left: 0, zIndex: 11, background: 'var(--panel-bg, #fff)' 
          }}>
            Shift
          </div>
          {weekDays.map((d, i) => {
            const dateStr = formatDateKey(d);
            const isToday = dateStr === todayStr;
            const isWeekend = i >= 5;
            return (
              <div key={dateStr} style={{ 
                padding: '0.5rem', textAlign: 'center', 
                borderRight: i < 6 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                position: 'sticky', top: 0, zIndex: 10, background: 'var(--panel-bg, #fff)'
              }}>
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

          {/* Grid rows (Shift Labels & WeekCells) */}
          {Object.entries(shiftConfig).map(([shiftType, cfg]) => (
            <Fragment key={shiftType}>
              {/* Shift label (sticky to left) */}
              <div style={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                padding: '0.75rem 0.5rem', background: 'var(--panel-bg, #fff)', 
                borderRight: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)',
                minHeight: '130px', gap: '4px',
                position: 'sticky', left: 0, zIndex: 9
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: cfg.bg, zIndex: 1 }} />
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <cfg.Icon size={18} color={cfg.color} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>
              {/* Day cells */}
              {weekDays.map((d, i) => {
                const dateStr = formatDateKey(d);
                const dayShifts = shifts[dateStr] || {};
                const pharma = dayShifts[shiftType];
                const cellDate = new Date(d);
                cellDate.setHours(23, 59, 59, 999);
                const isPast = cellDate < today;
                return (
                  <WeekCell
                    key={dateStr}
                    isLast={i === 6}
                    isPast={isPast}
                    pharmacist={pharma?.pharmacist}
                    config={pharma ? { ...cfg, time: `${formatTime(pharma.fromTime)} - ${formatTime(pharma.toTime)}` } : cfg}
                    onEdit={(e) => onOpenPopover(e, dateStr, shiftType, pharma)}
                  />
                );
              })}
            </Fragment>
          ))}

          {/* Weekly Remarks Row */}
          {/* Remarks Label (sticky to left) */}
          <div style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
            padding: '0.5rem', background: 'var(--panel-bg, #fff)', 
            borderRight: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)',
            minHeight: '50px', gap: '4px',
            position: 'sticky', left: 0, zIndex: 9
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.02)', zIndex: 1 }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <FileText size={15} color="var(--text-muted)" />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Remarks</span>
            </div>
          </div>
          {weekDays.map((d, i) => {
            const dateStr = formatDateKey(d);
            const remark = remarks[dateStr] || '';
            const cellDate = new Date(d);
            cellDate.setHours(23, 59, 59, 999);
            const isPast = cellDate < today;
            return (
              <div key={dateStr} style={{ 
                borderRight: i < 6 ? '1px solid rgba(0,0,0,0.06)' : 'none', 
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                padding: '0.4rem', display: 'flex', alignItems: 'center', 
                opacity: isPast ? 0.75 : 1, minWidth: '130px' 
              }}>
                <input
                  type="text"
                  placeholder={isPast ? "" : "Add note..."}
                  disabled={isPast}
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

const WeekCell = ({ isLast, pharmacist, config, onEdit, isPast }) => {
  const [hovered, setHovered] = useState(false);

  if (!pharmacist) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRight: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          padding: '0.5rem',
          minHeight: '130px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isPast ? 'default' : 'pointer',
          background: isPast ? 'rgba(0,0,0,0.02)' : hovered ? 'rgba(0,0,0,0.02)' : 'transparent',
          transition: 'background 0.15s',
          opacity: isPast ? 0.6 : 1,
          minWidth: '130px'
        }}
        onClick={isPast ? undefined : onEdit}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', border: isPast ? '1.5px dashed rgba(0,0,0,0.08)' : '1.5px dashed rgba(0,0,0,0.15)', borderRadius: '8px', padding: '0.75rem', width: '100%' }}>
          {isPast ? (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>No Shift</span>
          ) : (
            <>
              <UserPlus size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>Unassigned</span>
            </>
          )}
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
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '0.5rem',
        minHeight: '130px',
        background: hovered && !isPast ? config.bg : 'transparent',
        transition: 'background 0.15s',
        opacity: isPast ? 0.8 : 1,
        minWidth: '130px'
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
        minWidth: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: config.bg, border: `2px solid ${config.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 800, color: config.color, flexShrink: 0
          }}>{pharmacist.initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pharmacist.name.replace('Dr. ', '')}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pharmacist.designation}</div>
            <div style={{ fontSize: '0.62rem', color: config.color, fontWeight: 700, marginTop: '2px' }}>{config.time}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {!isPast && (
            <button
              onClick={onEdit}
              style={{ alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', padding: '3px', borderRadius: '5px', display: 'flex', color: config.color, opacity: hovered ? 1 : 0.5, transition: 'opacity 0.15s' }}
            >
              <Edit2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// â”€â”€â”€ Staff Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>{pharmacist.designation} â€¢ {pharmacist.rating}â˜…</p>
      </div>
      <GripVertical size={14} color="var(--text-muted)" style={{ opacity: 0.4 }} />
    </div>
  );
};

// â”€â”€â”€ Stat Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Matrix (All Branches) Grid View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              const cellDate = new Date(year, month, day);
              cellDate.setHours(23, 59, 59, 999);
              const isPast = cellDate < today;

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
                        isPast={isPast}
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

const MatrixCell = ({ day, branchId, shifts, shiftConfig, onOpenPopover, remark, onRemarkChange, isPast }) => {
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
        background: isPast ? 'rgba(0,0,0,0.02)' : hovered ? 'rgba(0,0,0,0.01)' : 'transparent',
        opacity: isPast ? 0.75 : 1
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
                isPast={isPast}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto', paddingTop: '4px' }}>
          {hovered && !isPast && (
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
            placeholder={isPast ? "" : "Add note..."}
            disabled={isPast}
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

// â”€â”€â”€ Reassign Popover â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

ReassignPopover.displayName = 'ReassignPopover';

export default DutyScheduler;
