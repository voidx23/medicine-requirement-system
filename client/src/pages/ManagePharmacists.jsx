import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, ArrowLeft, Lock, Eye, EyeOff, Shield, ShieldAlert, ChevronRight, Clock, AlertTriangle, TrendingUp, BarChart2 } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import PasswordConfirmModal from '../components/UI/PasswordConfirmModal';

// Helpers to check if a document has expired or is expiring soon
const checkDocumentStatus = (expiryDate) => {
  if (!expiryDate) return 'valid';
  const expiry = new Date(expiryDate);
  const now = new Date();
  expiry.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'critical';
  if (diffDays <= 90) return 'warning';
  return 'valid';
};

const getStaffDocumentAlerts = (p) => {
  const alerts = [];
  
  const licenseStatus = checkDocumentStatus(p.licenseExpiry);
  if (licenseStatus === 'expired') alerts.push({ type: 'strict', text: 'License Expired' });
  else if (licenseStatus === 'critical') alerts.push({ type: 'strict', text: 'License Expiring (<30 days)' });
  else if (licenseStatus === 'warning') alerts.push({ type: 'normal', text: 'License Expiring soon (<90 days)' });

  const passportStatus = checkDocumentStatus(p.passportExpiry);
  if (passportStatus === 'expired') alerts.push({ type: 'strict', text: 'Passport Expired' });
  else if (passportStatus === 'critical') alerts.push({ type: 'strict', text: 'Passport Expiring (<30 days)' });
  else if (passportStatus === 'warning') alerts.push({ type: 'normal', text: 'Passport Expiring soon (<90 days)' });

  const idCardStatus = checkDocumentStatus(p.idCardExpiry);
  if (idCardStatus === 'expired') alerts.push({ type: 'strict', text: 'ID Card Expired' });
  else if (idCardStatus === 'critical') alerts.push({ type: 'strict', text: 'ID Card Expiring (<30 days)' });
  else if (idCardStatus === 'warning') alerts.push({ type: 'normal', text: 'ID Card Expiring soon (<90 days)' });

  return alerts;
};

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
    specialty: designation,
    designation,
    rating,
    available: staff.isActive !== false,
    color,
    branches: staff.branches || [],
    profilePicture: staff.profilePicture || '',
    licenseNumber: staff.licenseNumber || '',
    licenseExpiry: staff.licenseExpiry ? staff.licenseExpiry.substring(0, 10) : '',
    licenseNotifyDays: staff.licenseNotifyDays || 30,
    passportNumber: staff.passportNumber || '',
    passportExpiry: staff.passportExpiry ? staff.passportExpiry.substring(0, 10) : '',
    passportNotifyDays: staff.passportNotifyDays || 30,
    idCardNumber: staff.idCardNumber || '',
    idCardExpiry: staff.idCardExpiry ? staff.idCardExpiry.substring(0, 10) : '',
    idCardNotifyDays: staff.idCardNotifyDays || 30,
    remarks: staff.remarks || '',
    defaultBranch: staff.defaultBranch?._id || staff.defaultBranch || '',
    defaultBranchObj: staff.defaultBranch || null,
    defaultShiftType: staff.defaultShiftType || '',
    defaultFromTime: staff.defaultFromTime || '',
    defaultToTime: staff.defaultToTime || '',
    defaultOffDay: staff.defaultOffDay || '',
    employeeId: staff.employeeId || '',
    joiningDate: staff.joiningDate ? staff.joiningDate.substring(0, 10) : '',
    employmentType: staff.employmentType || 'Full Time',
    status: staff.status || 'Active',
    performanceIssues: staff.performanceIssues || []
  };
};

const ManagePharmacists = () => {
  const { showConfirm, showToast } = useNotification();
  const [pharmacists, setPharmacists] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentView, setCurrentView] = useState('list'); // 'list' | 'details' | 'register'
  const [showNewPin, setShowNewPin] = useState(false);
  const [showEditPin, setShowEditPin] = useState(false);

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
  const [newStaffLicenseNotifyDays, setNewStaffLicenseNotifyDays] = useState(30);
  const [newStaffPassportNotifyDays, setNewStaffPassportNotifyDays] = useState(30);
  const [newStaffIdCardNotifyDays, setNewStaffIdCardNotifyDays] = useState(30);
  const [newStaffRemarks, setNewStaffRemarks] = useState('');
  const [newStaffDefaultBranch, setNewStaffDefaultBranch] = useState('');
  const [newStaffDefaultShift, setNewStaffDefaultShift] = useState('');
  const [newStaffDefaultFrom, setNewStaffDefaultFrom] = useState('');
  const [newStaffDefaultTo, setNewStaffDefaultTo] = useState('');
  const [newStaffOffDay, setNewStaffOffDay] = useState('');
  const [newStaffEmployeeId, setNewStaffEmployeeId] = useState('');
  const [newStaffJoiningDate, setNewStaffJoiningDate] = useState('');
  const [newStaffEmploymentType, setNewStaffEmploymentType] = useState('Full Time');
  const [newStaffStatus, setNewStaffStatus] = useState('Active');

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
  const [editStaffLicenseNotifyDays, setEditStaffLicenseNotifyDays] = useState(30);
  const [editStaffPassportNotifyDays, setEditStaffPassportNotifyDays] = useState(30);
  const [editStaffIdCardNotifyDays, setEditStaffIdCardNotifyDays] = useState(30);
  const [editStaffRemarks, setEditStaffRemarks] = useState('');
  const [editStaffDefaultBranch, setEditStaffDefaultBranch] = useState('');
  const [editStaffDefaultShift, setEditStaffDefaultShift] = useState('');
  const [editStaffDefaultFrom, setEditStaffDefaultFrom] = useState('');
  const [editStaffDefaultTo, setEditStaffDefaultTo] = useState('');
  const [editStaffOffDay, setEditStaffOffDay] = useState('');
  const [editStaffEmployeeId, setEditStaffEmployeeId] = useState('');
  const [editStaffJoiningDate, setEditStaffJoiningDate] = useState('');
  const [editStaffEmploymentType, setEditStaffEmploymentType] = useState('Full Time');
  const [editStaffStatus, setEditStaffStatus] = useState('Active');
  const [editStaffPerformanceIssues, setEditStaffPerformanceIssues] = useState([]);

  // Incident reporting form states
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueType, setIssueType] = useState('General Remark');
  const [issueSeverity, setIssueSeverity] = useState('Medium');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [issueDescription, setIssueDescription] = useState('');
  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const [showDeleteIssueModal, setShowDeleteIssueModal] = useState(false);
  const [issueIndexToDelete, setIssueIndexToDelete] = useState(null);

  // Pharmacist Workload Analytics states
  const [staffSchedules, setStaffSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  useEffect(() => {
    if (currentView === 'details' && editingStaffId) {
      const fetchStaffWorkload = async () => {
        setSchedulesLoading(true);
        try {
          const now = new Date();
          const res = await api.get('/duty-schedules', {
            params: { year: now.getFullYear(), month: now.getMonth() }
          });
          setStaffSchedules(res.data || []);
        } catch (err) {
          console.error("Failed to fetch staff duty schedules", err);
        } finally {
          setSchedulesLoading(false);
        }
      };
      fetchStaffWorkload();
    }
  }, [currentView, editingStaffId]);

  const calculateShiftHours = (fromTime, toTime) => {
    if (!fromTime || !toTime) return 0;
    const [h1, m1] = fromTime.split(':').map(Number);
    const [h2, m2] = toTime.split(':').map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
    let start = h1 + m1 / 60;
    let end = h2 + m2 / 60;
    if (end <= start) end += 24;
    return Math.round((end - start) * 10) / 10;
  };

  const getStaffWorkloadStats = () => {
    if (!editingStaffId || !staffSchedules) return null;
    const targetId = String(editingStaffId);
    let totalShifts = 0;
    let totalHours = 0;
    let overtimeShiftsCount = 0;
    const branchHoursMap = {};

    staffSchedules.forEach(schedule => {
      const bName = schedule.branchId?.name || branches.find(b => String(b._id) === String(schedule.branchId?._id || schedule.branchId))?.name || 'Branch';
      const shiftsObj = schedule.shifts || {};
      
      Object.values(shiftsObj).forEach(dayObj => {
        ['morning', 'evening'].forEach(sType => {
          const shift = dayObj?.[sType];
          if (shift && shift.pharmacistId && String(shift.pharmacistId) === targetId) {
            const h = calculateShiftHours(shift.fromTime, shift.toTime);
            totalShifts += 1;
            totalHours += h;
            if (h > 9) overtimeShiftsCount += 1;
            branchHoursMap[bName] = (branchHoursMap[bName] || 0) + h;
          }
        });
      });
    });

    totalHours = Math.round(totalHours * 10) / 10;
    const avgShift = totalShifts > 0 ? Math.round((totalHours / totalShifts) * 10) / 10 : 0;
    const loadPct = Math.min(100, Math.round((totalHours / 180) * 100));

    return { totalShifts, totalHours, avgShift, overtimeShiftsCount, loadPct, branchHoursMap };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch branches
      const branchesRes = await api.get('/branches');
      setBranches(branchesRes.data);

      // Fetch real staff (pharmacists)
      const staffRes = await api.get('/staff?all=true');
      const mappedPharmacists = staffRes.data.map((staff, idx) => mapRealPharmacist(staff, idx));
      setPharmacists(mappedPharmacists);
    } catch (error) {
      console.error("Failed to fetch initial data for staff directory", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileChange = (e, setPic) => {
    const file = e.target.files[0];
    if (file) {
      // Reject files larger than 10MB to avoid browser freeze
      const maxUploadSize = 10 * 1024 * 1024;
      if (file.size > maxUploadSize) {
        alert("Selected image is too large. Please select an image under 10MB.");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 200; // Max avatar dimension
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 70% quality (usually results in 10KB - 25KB size)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPic(dataUrl);
        };
        img.src = event.target.result;
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
        licenseNotifyDays: newStaffLicenseNotifyDays,
        passportNumber: newStaffPassportNum || undefined,
        passportExpiry: newStaffPassportExpiry || undefined,
        passportNotifyDays: newStaffPassportNotifyDays,
        idCardNumber: newStaffIdCardNum || undefined,
        idCardExpiry: newStaffIdCardExpiry || undefined,
        idCardNotifyDays: newStaffIdCardNotifyDays,
        remarks: newStaffRemarks || undefined,
        defaultBranch: newStaffDefaultBranch || undefined,
        defaultShiftType: newStaffDefaultShift || undefined,
        defaultFromTime: newStaffDefaultFrom || undefined,
        defaultToTime: newStaffDefaultTo || undefined,
        defaultOffDay: newStaffOffDay || undefined,
        employeeId: newStaffEmployeeId || undefined,
        joiningDate: newStaffJoiningDate || undefined,
        employmentType: newStaffEmploymentType || undefined,
        status: newStaffStatus || undefined
      };
      await api.post('/staff', payload);
      setCurrentView('list');
      
      // Reset new staff states
      setNewStaffName('');
      setNewStaffPin('');
      setNewStaffDesignation('');
      setNewStaffRating('5.0');
      setNewStaffProfilePic('');
      setNewStaffLicenseNum('');
      setNewStaffLicenseExpiry('');
      setNewStaffLicenseNotifyDays(30);
      setNewStaffPassportNum('');
      setNewStaffPassportExpiry('');
      setNewStaffPassportNotifyDays(30);
      setNewStaffIdCardNum('');
      setNewStaffIdCardExpiry('');
      setNewStaffIdCardNotifyDays(30);
      setNewStaffRemarks('');
      setNewStaffDefaultBranch('');
      setNewStaffDefaultShift('');
      setNewStaffDefaultFrom('');
      setNewStaffDefaultTo('');
      setNewStaffOffDay('');
      setNewStaffEmployeeId('');
      setNewStaffJoiningDate('');
      setNewStaffEmploymentType('Full Time');
      setNewStaffStatus('Active');

      await fetchData();
      showToast('Pharmacist Registered Successfully', 'success');
    } catch (error) {
      showToast('Error registering pharmacist', 'error');
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
    setEditStaffLicenseNotifyDays(staff.licenseNotifyDays || 30);
    setEditStaffPassportNum(staff.passportNumber || '');
    setEditStaffPassportExpiry(staff.passportExpiry || '');
    setEditStaffPassportNotifyDays(staff.passportNotifyDays || 30);
    setEditStaffIdCardNum(staff.idCardNumber || '');
    setEditStaffIdCardExpiry(staff.idCardExpiry || '');
    setEditStaffIdCardNotifyDays(staff.idCardNotifyDays || 30);
    setEditStaffRemarks(staff.remarks || '');
    setEditStaffDefaultBranch(staff.defaultBranch || '');
    setEditStaffDefaultShift(staff.defaultShiftType || '');
    setEditStaffDefaultFrom(staff.defaultFromTime || '');
    setEditStaffDefaultTo(staff.defaultToTime || '');
    setEditStaffOffDay(staff.defaultOffDay || '');
    setEditStaffEmployeeId(staff.employeeId || '');
    setEditStaffJoiningDate(staff.joiningDate || '');
    setEditStaffEmploymentType(staff.employmentType || 'Full Time');
    setEditStaffStatus(staff.status || 'Active');
    setEditStaffPerformanceIssues(staff.performanceIssues || []);
    setShowAllIncidents(false);
    setShowIssueForm(false);
    setShowDeleteIssueModal(false);
    setIssueIndexToDelete(null);
    setCurrentView('details');
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
        licenseNotifyDays: editStaffLicenseNotifyDays,
        passportNumber: editStaffPassportNum,
        passportExpiry: editStaffPassportExpiry || null,
        passportNotifyDays: editStaffPassportNotifyDays,
        idCardNumber: editStaffIdCardNum,
        idCardExpiry: editStaffIdCardExpiry || null,
        idCardNotifyDays: editStaffIdCardNotifyDays,
        remarks: editStaffRemarks,
        defaultBranch: editStaffDefaultBranch || null,
        defaultShiftType: editStaffDefaultShift,
        defaultFromTime: editStaffDefaultFrom,
        defaultToTime: editStaffDefaultTo,
        defaultOffDay: editStaffOffDay,
        employeeId: editStaffEmployeeId || undefined,
        joiningDate: editStaffJoiningDate || undefined,
        employmentType: editStaffEmploymentType || undefined,
        status: editStaffStatus || undefined,
        performanceIssues: editStaffPerformanceIssues
      };
      if (editStaffPin) payload.pin = editStaffPin;
      await api.put(`/staff/${editingStaffId}`, payload);
      setCurrentView('list');
      setEditingStaffId('');
      setEditStaffName('');
      setEditStaffPin('');
      setEditStaffDesignation('');
      setEditStaffRating('5.0');
      setEditStaffProfilePic('');
      setEditStaffLicenseNum('');
      setEditStaffLicenseExpiry('');
      setEditStaffLicenseNotifyDays(30);
      setEditStaffPassportNum('');
      setEditStaffPassportExpiry('');
      setEditStaffPassportNotifyDays(30);
      setEditStaffIdCardNum('');
      setEditStaffIdCardExpiry('');
      setEditStaffIdCardNotifyDays(30);
      setEditStaffRemarks('');
      setEditStaffDefaultBranch('');
      setEditStaffDefaultShift('');
      setEditStaffDefaultFrom('');
      setEditStaffDefaultTo('');
      setEditStaffOffDay('');
      setEditStaffEmployeeId('');
      setEditStaffJoiningDate('');
      setEditStaffEmploymentType('Full Time');
      setEditStaffStatus('Active');
      setEditStaffPerformanceIssues([]);
      setShowAllIncidents(false);
      setShowIssueForm(false);
      setShowDeleteIssueModal(false);
      setIssueIndexToDelete(null);
      await fetchData();
      showToast('Pharmacist Updated Successfully', 'success');
    } catch (error) {
      showToast('Error updating pharmacist', 'error');
    }
  };

  const handleDeleteStaff = async (id) => {
    const confirmed = await showConfirm('Are you sure you want to permanently delete this pharmacist?', 'danger');
    if (!confirmed) return;
    try {
      await api.delete(`/staff/${id}`);
      await fetchData();
      showToast('Pharmacist Deleted Successfully', 'success');
      setCurrentView('list');
      setEditingStaffId('');
    } catch (error) {
      showToast('Error deleting pharmacist', 'error');
    }
  };

  const handleConfirmDeleteIssue = async (pwd) => {
    const { data } = await api.post('/auth/verify-password', { password: pwd });
    if (!data.isValid) throw new Error('Invalid Password');
    if (issueIndexToDelete !== null) {
      const updated = editStaffPerformanceIssues.filter((_, idx) => idx !== issueIndexToDelete);
      setEditStaffPerformanceIssues(updated);
      showToast('Incident removed from log. Save Changes to persist.', 'info');
    }
    setShowDeleteIssueModal(false);
    setIssueIndexToDelete(null);
  };

  const handleAddPerformanceIssue = (e) => {
    e.preventDefault();
    if (!issueDescription.trim()) {
      showToast('Please enter a description for the performance issue.', 'error');
      return;
    }
    const newIssue = {
      issueType: issueType,
      severity: issueSeverity,
      date: issueDate || new Date().toISOString().split('T')[0],
      description: issueDescription
    };
    setEditStaffPerformanceIssues([newIssue, ...editStaffPerformanceIssues]);
    setIssueDescription('');
    setShowIssueForm(false);
    showToast('Incident appended to log. Click Save Changes to persist.', 'success');
  };

  const filteredPharmacists = pharmacists.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.designation && p.designation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const cardStyle = {
    background: 'white',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '12px',
    padding: '1.25rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem'
  };

  const sectionHeaderStyle = {
    fontSize: '0.8rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    paddingBottom: '0.4rem',
    margin: '0 0 0.5rem 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const labelStyle = {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    marginBottom: '3px',
    display: 'block'
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.4rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid rgba(0,0,0,0.12)',
    outline: 'none',
    fontSize: '0.82rem',
    background: 'white'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '1.5rem' }}>
      
      {/* ── VIEW: Staff List ── */}
      {currentView === 'list' && (
        <>
          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                <Users size={28} color="var(--primary)" />
                Staff Directory
              </h1>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.3rem', fontSize: '0.9rem' }}>
                Manage active pharmacists, credentials, and default schedules
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <input
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: 'rgba(255,255,255,0.7)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <button
                onClick={() => setCurrentView('register')}
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
          </div>

          {/* Directory Table Panel */}
          <div className="glass-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>Loading staff records...</span>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.6)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, width: '50px' }}>#</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Name</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700 }}>Designation</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, width: '100px' }}>Rating</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>Default Branch</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, width: '120px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPharmacists.map((p, idx) => (
                      <tr 
                        key={p.id} 
                        onClick={() => handleEditStaff(p)}
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.15s', cursor: 'pointer' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.04)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {p.profilePicture ? (
                              <img src={p.profilePicture} style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} alt="" />
                            ) : (
                              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: `${p.color}22`, border: `1.5px solid ${p.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: p.color }}>{p.initials}</div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ fontWeight: 600 }}>{p.name}</span>
                                {(() => {
                                  const alerts = getStaffDocumentAlerts(p);
                                  const strictAlerts = alerts.filter(a => a.type === 'strict');
                                  const normalAlerts = alerts.filter(a => a.type === 'normal');

                                  if (alerts.length > 0) {
                                    const tooltipText = alerts.map(a => a.text).join(', ');
                                    if (strictAlerts.length > 0) {
                                      return (
                                        <span 
                                          title={tooltipText}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            background: '#ef4444',
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            marginLeft: '3px',
                                            cursor: 'help',
                                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.2)'
                                          }}
                                        >
                                          🚨 {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span 
                                          title={tooltipText}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            background: 'rgba(245,158,11,0.12)',
                                            color: '#d97706',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            marginLeft: '3px',
                                            cursor: 'help'
                                          }}
                                        >
                                          ⚠️ {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
                                        </span>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                              {p.employeeId && (
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>ID: {p.employeeId}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.designation}</div>
                          {p.employmentType && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{p.employmentType}</div>
                          )}
                        </td>
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
                          {(() => {
                            const status = p.status || 'Active';
                            let bg = 'rgba(34,197,94,0.1)';
                            let color = '#16a34a';
                            if (status === 'On Leave') {
                              bg = 'rgba(245,158,11,0.1)';
                              color = '#d97706';
                            } else if (status === 'Suspended') {
                              bg = 'rgba(239,68,68,0.1)';
                              color = '#dc2626';
                            } else if (status === 'Resigned') {
                              bg = 'rgba(107,114,128,0.1)';
                              color = '#4b5563';
                            }
                            return (
                              <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: bg,
                                color: color
                              }}>
                                {status}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                    {filteredPharmacists.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No staff members found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── VIEW: Register Staff ── */}
      {currentView === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
          {/* Breadcrumb Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span 
              onClick={() => setCurrentView('list')} 
              style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowLeft size={16} /> Staff Directory
            </span>
            <ChevronRight size={14} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)' }}>Register Pharmacist</span>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Register New Staff</h2>

          <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top Area: Profile Picture & Primary info */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                {/* 100x100 Rounded Square Avatar */}
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '16px',
                  background: '#f3f4f6',
                  border: '1.5px dashed rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {newStaffProfilePic ? (
                    <img src={newStaffProfilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <Users size={32} color="#9ca3af" />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Profile Photo</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <label style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--primary)',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileChange(e, setNewStaffProfilePic)}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {newStaffProfilePic && (
                      <button
                        type="button"
                        onClick={() => setNewStaffProfilePic('')}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid 1: Basic Name Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <span style={labelStyle}>Name *</span>
                  <input
                    type="text" required placeholder="e.g. Sarah Connor"
                    value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <span style={labelStyle}>Designation</span>
                  <input
                    type="text" placeholder="e.g. Senior Pharmacist"
                    value={newStaffDesignation} onChange={e => setNewStaffDesignation(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <span style={labelStyle}>Rating *</span>
                  <input
                    type="number" step="0.1" min="1" max="5" required placeholder="5.0"
                    value={newStaffRating} onChange={e => setNewStaffRating(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Grid 2: Side-by-Side Cards (Security & Employment) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {/* Card 2A: Security Credentials Section (ISOLATED SECURITY CORNER) */}
              <div className="glass-panel" style={{ 
                ...cardStyle, 
                background: 'rgba(99, 102, 241, 0.02)', 
                border: '1.5px dashed rgba(99, 102, 241, 0.25)' 
              }}>
                <h4 style={sectionHeaderStyle}>
                  <Lock size={16} color="var(--primary)" />
                  Security Credentials
                </h4>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Security related. Assign a unique numeric PIN code for this pharmacist to log in or authorize transactions.
                </p>
                <div>
                  <span style={labelStyle}>Access PIN Code *</span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showNewPin ? "text" : "password"} required placeholder="Enter PIN code"
                      value={newStaffPin} onChange={e => setNewStaffPin(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '2.25rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2B: Employment Details */}
              <div className="glass-panel" style={cardStyle}>
                <h4 style={sectionHeaderStyle}>Employment Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={labelStyle}>Employee ID</span>
                    <input
                      type="text" placeholder="e.g. EMP123"
                      value={newStaffEmployeeId} onChange={e => setNewStaffEmployeeId(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <span style={labelStyle}>Joining Date</span>
                    <input
                      type="date"
                      value={newStaffJoiningDate} onChange={e => setNewStaffJoiningDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={labelStyle}>Employment Type</span>
                    <select
                      value={newStaffEmploymentType} onChange={e => setNewStaffEmploymentType(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="Full Time">Full Time</option>
                      <option value="Part Time">Part Time</option>
                      <option value="Temporary">Temporary</option>
                      <option value="Relief Pharmacist">Relief Pharmacist</option>
                    </select>
                  </div>
                  <div>
                    <span style={labelStyle}>Status</span>
                    <select
                      value={newStaffStatus} onChange={e => setNewStaffStatus(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid 3: Side-by-Side Cards (Defaults & Documents) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {/* Card 3A: Fixed Default Schedule settings */}
              <div className="glass-panel" style={cardStyle}>
                <h4 style={{ ...sectionHeaderStyle, color: 'var(--primary)' }}>Fixed Schedule Settings (Defaults)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={labelStyle}>Default Branch</span>
                    <select
                      value={newStaffDefaultBranch} onChange={e => setNewStaffDefaultBranch(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Flexible (None)</option>
                      {branches.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span style={labelStyle}>Default Shift</span>
                    <select
                      value={newStaffDefaultShift} onChange={e => setNewStaffDefaultShift(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">None</option>
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <span style={labelStyle}>Default Off Day</span>
                    <select
                      value={newStaffOffDay} onChange={e => setNewStaffOffDay(e.target.value)}
                      style={inputStyle}
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
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <div style={{ flex: 1 }}>
                      <span style={labelStyle}>From</span>
                      <input
                        type="time" value={newStaffDefaultFrom} onChange={e => setNewStaffDefaultFrom(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={labelStyle}>To</span>
                      <input
                        type="time" value={newStaffDefaultTo} onChange={e => setNewStaffDefaultTo(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3B: Staff Documents */}
              <div className="glass-panel" style={cardStyle}>
                <h4 style={sectionHeaderStyle}>Staff Documents</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* License Info */}
                  <div style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>1. Professional License</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input type="text" placeholder="License No." value={newStaffLicenseNum} onChange={e => setNewStaffLicenseNum(e.target.value)} style={inputStyle} />
                      <input type="date" value={newStaffLicenseExpiry} onChange={e => setNewStaffLicenseExpiry(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  {/* Passport Info */}
                  <div style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>2. Passport</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input type="text" placeholder="Passport No." value={newStaffPassportNum} onChange={e => setNewStaffPassportNum(e.target.value)} style={inputStyle} />
                      <input type="date" value={newStaffPassportExpiry} onChange={e => setNewStaffPassportExpiry(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  {/* ID Card Info */}
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>3. National ID Card</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input type="text" placeholder="ID Number" value={newStaffIdCardNum} onChange={e => setNewStaffIdCardNum(e.target.value)} style={inputStyle} />
                      <input type="date" value={newStaffIdCardExpiry} onChange={e => setNewStaffIdCardExpiry(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks Section */}
            <div className="glass-panel" style={cardStyle}>
              <h4 style={sectionHeaderStyle}>Remarks & Schedule Restrictions</h4>
              <input
                type="text"
                placeholder="Enter special remarks, custom notifications, performance warnings, etc."
                value={newStaffRemarks} onChange={e => setNewStaffRemarks(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1.5px solid rgba(0,0,0,0.06)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => setCurrentView('list')} 
                style={{ padding: '0.5rem 1.5rem', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                style={{ padding: '0.5rem 2rem', border: 'none', borderRadius: '8px', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Register
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── VIEW: Staff Details / Profile Management ── */}
      {currentView === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span 
              onClick={() => setCurrentView('list')} 
              style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowLeft size={16} /> Staff Directory
            </span>
            <ChevronRight size={14} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)' }}>Dr. {editStaffName}</span>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Staff Profile Details</h2>

          <form onSubmit={handleUpdateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Profile Avatar and Name Header panel */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                {/* 100x100 Rounded Square Avatar */}
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '16px',
                  background: '#f3f4f6',
                  border: '2.5px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.06)'
                }}>
                  {editStaffProfilePic ? (
                    <img src={editStaffProfilePic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--primary)',
                      fontSize: '1.75rem',
                      fontWeight: 800
                    }}>
                      {(() => {
                        const nameParts = editStaffName.split(' ');
                        let initials = '';
                        if (nameParts.length > 0) initials += nameParts[0].charAt(0).toUpperCase();
                        if (nameParts.length > 1) initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
                        if (!initials) initials = 'P';
                        return initials;
                      })()}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Profile Photo</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <label style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--primary)',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handleFileChange(e, setEditStaffProfilePic)}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {editStaffProfilePic && (
                      <button
                        type="button"
                        onClick={() => setEditStaffProfilePic('')}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid 1: Basic Name Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <span style={labelStyle}>Pharmacist Name *</span>
                  <input
                    type="text" required placeholder="e.g. Sarah Connor"
                    value={editStaffName} onChange={e => setEditStaffName(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <span style={labelStyle}>Designation</span>
                  <input
                    type="text" placeholder="e.g. Senior Pharmacist"
                    value={editStaffDesignation} onChange={e => setEditStaffDesignation(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <span style={labelStyle}>Rating *</span>
                  <input
                    type="number" step="0.1" min="1" max="5" required placeholder="4.8"
                    value={editStaffRating} onChange={e => setEditStaffRating(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Grid 2: Side-by-Side Cards (Security & Employment) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {/* Card 2A: Security Credentials Section (ISOLATED SECURITY CORNER) */}
              <div className="glass-panel" style={{ 
                ...cardStyle, 
                background: 'rgba(99, 102, 241, 0.02)', 
                border: '1.5px dashed rgba(99, 102, 241, 0.25)' 
              }}>
                <h4 style={sectionHeaderStyle}>
                  <Lock size={16} color="var(--primary)" />
                  Security Credentials
                </h4>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Security related. To change this pharmacist's authorization PIN, enter a new one below. Leave blank to retain their current PIN.
                </p>
                <div>
                  <span style={labelStyle}>Change PIN Code (Optional)</span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showEditPin ? "text" : "password"} placeholder="Leave blank to keep current PIN"
                      value={editStaffPin} onChange={e => setEditStaffPin(e.target.value)}
                      style={{ ...inputStyle, paddingRight: '2.25rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPin(!showEditPin)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {showEditPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2B: Employment Details */}
              <div className="glass-panel" style={cardStyle}>
                <h4 style={sectionHeaderStyle}>Employment Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={labelStyle}>Employee ID</span>
                    <input
                      type="text" placeholder="e.g. EMP123"
                      value={editStaffEmployeeId} onChange={e => setEditStaffEmployeeId(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <span style={labelStyle}>Joining Date</span>
                    <input
                      type="date"
                      value={editStaffJoiningDate} onChange={e => setEditStaffJoiningDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={labelStyle}>Employment Type</span>
                    <select
                      value={editStaffEmploymentType} onChange={e => setEditStaffEmploymentType(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="Full Time">Full Time</option>
                      <option value="Part Time">Part Time</option>
                      <option value="Temporary">Temporary</option>
                      <option value="Relief Pharmacist">Relief Pharmacist</option>
                    </select>
                  </div>
                  <div>
                    <span style={labelStyle}>Status</span>
                    <select
                      value={editStaffStatus} onChange={e => setEditStaffStatus(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid 3: Side-by-Side Cards (Defaults & Documents) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {/* Card 3A: Fixed Default Schedule settings */}
              <div className="glass-panel" style={cardStyle}>
                <h4 style={{ ...sectionHeaderStyle, color: 'var(--primary)' }}>Fixed Schedule Settings (Defaults)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={labelStyle}>Default Branch</span>
                    <select
                      value={editStaffDefaultBranch} onChange={e => setEditStaffDefaultBranch(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Flexible (None)</option>
                      {branches.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span style={labelStyle}>Default Shift</span>
                    <select
                      value={editStaffDefaultShift} onChange={e => setEditStaffDefaultShift(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">None</option>
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <span style={labelStyle}>Default Off Day</span>
                    <select
                      value={editStaffOffDay} onChange={e => setEditStaffOffDay(e.target.value)}
                      style={inputStyle}
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
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <div style={{ flex: 1 }}>
                      <span style={labelStyle}>From</span>
                      <input
                        type="time" value={editStaffDefaultFrom} onChange={e => setEditStaffDefaultFrom(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={labelStyle}>To</span>
                      <input
                        type="time" value={editStaffDefaultTo} onChange={e => setEditStaffDefaultTo(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3B: Duty Schedule Workload & Working Hours Analytics */}
              <div className="glass-panel" style={{ ...cardStyle, background: 'rgba(99, 102, 241, 0.03)', border: '1.5px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ ...sectionHeaderStyle, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BarChart2 size={18} color="var(--primary)" />
                    Monthly Workload & Working Hours
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Current Month</span>
                </div>

                {schedulesLoading ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Calculating working hours...</div>
                ) : (() => {
                  const stats = getStaffWorkloadStats();
                  if (!stats || stats.totalShifts === 0) {
                    return (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
                        No duty shifts assigned for this pharmacist in the current month.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {/* Progress Bar vs 180h target */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Monthly Load Target (180h)</span>
                          <span style={{ color: stats.totalHours > 180 ? '#dc2626' : 'var(--primary)' }}>{stats.totalHours} hrs ({stats.loadPct}%)</span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${stats.loadPct}%`,
                            background: stats.totalHours > 180 ? '#ef4444' : stats.totalHours > 150 ? '#f59e0b' : 'var(--primary)',
                            borderRadius: '99px',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>

                      {/* 3 Metric Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'white', padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.07)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>SHIFTS ASSIGNED</div>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalShifts}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL HOURS</div>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: stats.totalHours > 180 ? '#dc2626' : 'var(--primary)' }}>{stats.totalHours}h</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>AVG SHIFT</div>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: stats.avgShift > 9 ? '#dc2626' : 'var(--text-main)' }}>{stats.avgShift}h</div>
                        </div>
                      </div>

                      {/* 9-Hour Compliance Banner */}
                      {stats.overtimeShiftsCount > 0 ? (
                        <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                          <span>Shift Compliance Warning: {stats.overtimeShiftsCount} shift{stats.overtimeShiftsCount > 1 ? 's' : ''} exceeded the 9-hour limit!</span>
                        </div>
                      ) : (
                        <div style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>✓ All assigned shifts adhere to the 9-hour limit.</span>
                        </div>
                      )}

                      {/* Branch Hours Distribution */}
                      {Object.keys(stats.branchHoursMap).length > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <div style={{ fontWeight: '700', marginBottom: '4px' }}>Hours Worked Per Branch:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {Object.entries(stats.branchHoursMap).map(([brName, brHours]) => (
                              <span key={brName} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '5px', padding: '2px 7px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                {brName}: {Math.round(brHours * 10) / 10}h
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Card 3C: Staff Documents */}
              <div className="glass-panel" style={cardStyle}>
                <h4 style={sectionHeaderStyle}>Staff Documents</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* License Info */}
                  <div style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>1. Professional License</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input type="text" placeholder="License No." value={editStaffLicenseNum} onChange={e => setEditStaffLicenseNum(e.target.value)} style={inputStyle} />
                      <input type="date" value={editStaffLicenseExpiry} onChange={e => setEditStaffLicenseExpiry(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  {/* Passport Info */}
                  <div style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>2. Passport</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input type="text" placeholder="Passport No." value={editStaffPassportNum} onChange={e => setEditStaffPassportNum(e.target.value)} style={inputStyle} />
                      <input type="date" value={editStaffPassportExpiry} onChange={e => setEditStaffPassportExpiry(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  {/* ID Card Info */}
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>3. National ID Card</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input type="text" placeholder="ID Number" value={editStaffIdCardNum} onChange={e => setEditStaffIdCardNum(e.target.value)} style={inputStyle} />
                      <input type="date" value={editStaffIdCardExpiry} onChange={e => setEditStaffIdCardExpiry(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks Section */}
            <div className="glass-panel" style={cardStyle}>
              <h4 style={sectionHeaderStyle}>Remarks & Schedule Restrictions</h4>
              <input
                type="text"
                placeholder="Enter special remarks, custom notifications, performance warnings, etc."
                value={editStaffRemarks} onChange={e => setEditStaffRemarks(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Performance History Section */}
            <div className="glass-panel" style={{
              background: 'white',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              marginTop: '1.25rem'
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
                <h4 style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Shield size={18} color="#4f46e5" style={{ display: 'inline-block' }} />
                  Performance Logs & Incidents
                </h4>
                <button
                  type="button"
                  onClick={() => setShowIssueForm(!showIssueForm)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#4f46e5',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.04)';
                    e.currentTarget.style.borderColor = '#4f46e5';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                  }}
                >
                  {showIssueForm ? "Cancel Incident" : "+ Report Issue"}
                </button>
              </div>

              {/* Inline incident logging form */}
              {showIssueForm && (
                <div style={{
                  padding: '0 1.5rem 1.25rem 1.5rem',
                  borderBottom: '1px solid rgba(0,0,0,0.06)'
                }}>
                  <div style={{
                    background: 'rgba(0,0,0,0.015)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    padding: '1rem',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <span style={labelStyle}>Incident Category</span>
                        <select
                          value={issueType}
                          onChange={e => setIssueType(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="General Remark">General Remark</option>
                          <option value="Tardiness">Tardiness</option>
                          <option value="Medication Error">Medication Error</option>
                          <option value="Customer Complaint">Customer Complaint</option>
                          <option value="Policy Violation">Policy Violation</option>
                          <option value="Unexcused Absence">Unexcused Absence</option>
                          <option value="Dress Code">Dress Code</option>
                        </select>
                      </div>
                      <div>
                        <span style={labelStyle}>Severity Level</span>
                        <select
                          value={issueSeverity}
                          onChange={e => setIssueSeverity(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div>
                        <span style={labelStyle}>Incident Date</span>
                        <input
                          type="date"
                          value={issueDate}
                          onChange={e => setIssueDate(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div>
                      <span style={labelStyle}>Incident Description *</span>
                      <textarea
                        placeholder="Specify the details of the issue, action items, or administrative warning details..."
                        value={issueDescription}
                        onChange={e => setIssueDescription(e.target.value)}
                        style={{
                          ...inputStyle,
                          minHeight: '60px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowIssueForm(false);
                          setIssueDescription('');
                        }}
                        style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: '5px',
                          border: '1px solid rgba(0,0,0,0.1)',
                          background: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddPerformanceIssue}
                        style={{
                          padding: '0.35rem 1.1rem',
                          borderRadius: '5px',
                          border: 'none',
                          background: 'var(--primary)',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Append Log Entry
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Incidents Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{
                      background: 'rgba(99, 102, 241, 0.02)',
                      borderTop: '1px solid rgba(0,0,0,0.06)',
                      borderBottom: '1px solid rgba(0,0,0,0.06)'
                    }}>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Incident Type</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Severity</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Date Logged</th>
                      <th style={{ padding: '0.75rem 1.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description Snippet</th>
                      <th style={{ padding: '0.75rem 1.5rem', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editStaffPerformanceIssues.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{
                          textAlign: 'center',
                          padding: '2rem 1.5rem',
                          color: 'var(--text-muted)',
                          fontSize: '0.8rem'
                        }}>
                          No incidents logged. This staff member has a clean performance record.
                        </td>
                      </tr>
                    ) : (
                      (showAllIncidents ? editStaffPerformanceIssues : editStaffPerformanceIssues.slice(0, 4)).map((issue) => {
                        const originalIndex = editStaffPerformanceIssues.indexOf(issue);
                        let severityBg = '#eff6ff';
                        let severityColor = '#1d4ed8';
                        let severityBorder = '#bfdbfe';
                        
                        if (issue.severity === 'High') {
                          severityBg = '#fef2f2';
                          severityColor = '#dc2626';
                          severityBorder = '#fecaca';
                        } else if (issue.severity === 'Medium') {
                          severityBg = '#fffbeb';
                          severityColor = '#b45309';
                          severityBorder = '#fde68a';
                        }

                        return (
                          <tr
                            key={issue._id || originalIndex}
                            style={{
                              borderBottom: '1px solid rgba(0,0,0,0.04)',
                              transition: 'background 0.15s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.005)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '0.9rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                              {issue.issueType}
                            </td>
                            <td style={{ padding: '0.9rem 1.5rem' }}>
                              <span style={{
                                display: 'inline-block',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: severityColor,
                                background: severityBg,
                                border: `1px solid ${severityBorder}`,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                textAlign: 'center'
                              }}>
                                {issue.severity}
                              </span>
                            </td>
                            <td style={{ padding: '0.9rem 1.5rem', fontSize: '0.85rem', color: '#475569' }}>
                              {issue.date ? (typeof issue.date === 'string' ? issue.date.substring(0, 10) : new Date(issue.date).toISOString().split('T')[0]) : ''}
                            </td>
                            <td style={{ padding: '0.9rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                              {issue.description}
                            </td>
                            <td style={{ padding: '0.9rem 1.5rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setIssueIndexToDelete(originalIndex);
                                  setShowDeleteIssueModal(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#cbd5e1',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '4px',
                                  marginLeft: 'auto',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={e => {
                                  e.currentTarget.style.color = '#ef4444';
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                }}
                                onMouseOut={e => {
                                  e.currentTarget.style.color = '#cbd5e1';
                                  e.currentTarget.style.background = 'transparent';
                                }}
                                title="Delete incident entry"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Card Footer */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.02)',
                borderTop: '1px solid rgba(0,0,0,0.05)',
                padding: '0.75rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {editStaffPerformanceIssues.length === 0 
                    ? "Showing 0 incidents" 
                    : showAllIncidents 
                      ? `Showing all ${editStaffPerformanceIssues.length} incidents`
                      : `Showing ${Math.min(4, editStaffPerformanceIssues.length)} recent ${Math.min(4, editStaffPerformanceIssues.length) === 1 ? 'incident' : 'incidents'}`
                  }
                </span>
                {editStaffPerformanceIssues.length > 4 && (
                  <span
                    onClick={() => setShowAllIncidents(!showAllIncidents)}
                    style={{
                      color: '#4f46e5',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em'
                    }}
                    onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {showAllIncidents ? "SHOW FEWER" : "VIEW ALL LOG HISTORY"}
                  </span>
                )}
              </div>
            </div>

            {/* Form Action Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1.5px solid rgba(0,0,0,0.06)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => setCurrentView('list')} 
                style={{ padding: '0.5rem 1.5rem', border: '1px solid rgba(0,0,0,0.12)', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                style={{ padding: '0.5rem 2rem', border: 'none', borderRadius: '8px', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Save Changes
              </button>
            </div>
          </form>

          {/* ── Separate Danger Zone Footer Section ── */}
          <div className="glass-panel" style={{
            background: 'rgba(239, 68, 68, 0.03)',
            border: '1px solid rgba(239, 68, 68, 0.18)',
            padding: '1.25rem',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginTop: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} color="#dc2626" />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Danger Zone
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Deleting this pharmacist is a permanent, destructive action. This will erase their profile details, document expiry logs, credentials, and default branch settings from the duty scheduling engine.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => handleDeleteStaff(editingStaffId)}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220,38,38,0.2)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#b91c1c'}
                onMouseOut={e => e.currentTarget.style.background = '#dc2626'}
              >
                Delete Pharmacist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Confirm Modal for Performance Log Deletion */}
      <PasswordConfirmModal
        isOpen={showDeleteIssueModal}
        onClose={() => {
          setShowDeleteIssueModal(false);
          setIssueIndexToDelete(null);
        }}
        title="Confirm Incident Log Deletion"
        message="Enter your Admin password to remove this performance incident entry. You must click 'Save Changes' on the details page afterward to save your action permanently."
        confirmText="Delete Incident"
        variant="danger"
        onConfirm={handleConfirmDeleteIssue}
      />
    </div>
  );
};

export default ManagePharmacists;
