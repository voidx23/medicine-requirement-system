import mongoose from 'mongoose';
import Staff from '../models/Staff.js';
import Branch from '../models/Branch.js';
import { hasPermission, hasAnyPermission } from '../middleware/authMiddleware.js';

const STAFF_READ_PERMISSIONS = ['view_pharmacists', 'view_branches', 'view_duty_schedules'];
const BRANCH_STAFF_PROJECTION = '_id name designation isActive';
const OPERATIONAL_STAFF_PROJECTION = '_id name designation rating isActive status branches defaultBranch defaultShiftType defaultFromTime defaultToTime defaultOffDay profilePicture';
const FULL_HR_STAFF_PROJECTION = '-pin';
const BRANCH_ASSIGNMENT_STAFF_PROJECTION = '_id name designation isActive status branches defaultBranch';

const isValidObjectIdString = (value) => (
    typeof value === 'string'
    && /^[0-9a-fA-F]{24}$/.test(value)
    && mongoose.Types.ObjectId.isValid(value)
);

const sanitizeStaffPayload = (doc) => {
    if (!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete obj.pin;
    return obj;
};

// @desc    Get active staff for logged-in branch, or staff directory for authorized admin
// @route   GET /api/staff
// @access  Private
const getStaff = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        if (req.user.role === 'branch') {
            if (req.query.branchId !== undefined) {
                if (!isValidObjectIdString(req.query.branchId)) {
                    return res.status(400).json({ message: 'Invalid branch ID' });
                }
                if (req.query.branchId !== String(req.user._id)) {
                    return res.status(403).json({ message: 'Forbidden: Cannot access staff from another branch' });
                }
            }

            const branchStaff = await Staff.find({
                branches: req.user._id,
                isActive: true
            })
                .select(BRANCH_STAFF_PROJECTION)
                .sort({ name: 1 });

            return res.json(branchStaff.map(sanitizeStaffPayload));
        }

        if (req.user.role === 'admin') {
            if (!hasAnyPermission(req.user, STAFF_READ_PERMISSIONS)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient permissions to view staff' });
            }

            const query = req.query.all === 'true' ? {} : { isActive: true };

            if (req.query.branchId !== undefined && req.query.branchId !== '') {
                if (!isValidObjectIdString(req.query.branchId)) {
                    return res.status(400).json({ message: 'Invalid branch ID' });
                }
                query.branches = req.query.branchId;
            }

            const projection = hasPermission(req.user, 'view_pharmacists')
                ? FULL_HR_STAFF_PROJECTION
                : OPERATIONAL_STAFF_PROJECTION;

            const staff = await Staff.find(query)
                .select(projection)
                .sort({ name: 1 })
                .populate('branches', 'name')
                .populate('defaultBranch', 'name');

            return res.json(staff.map(sanitizeStaffPayload));
        }

        return res.status(403).json({ message: 'Forbidden: Unauthorized role' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Register a new staff member
// @route   POST /api/staff
// @access  Private (Admin only ideally, but we'll allow flexible for now)
const addStaff = async (req, res) => {
    const {
        name, pin, designation, rating,
        profilePicture, licenseNumber, licenseExpiry, licenseNotifyDays,
        passportNumber, passportExpiry, passportNotifyDays, idCardNumber, idCardExpiry, idCardNotifyDays,
        remarks, defaultBranch, defaultShiftType, defaultFromTime, defaultToTime, defaultOffDay,
        employeeId, joiningDate, employmentType, status, performanceIssues
    } = req.body;

    try {
        const staff = await Staff.create({
            name,
            pin,
            designation,
            rating,
            profilePicture,
            licenseNumber,
            licenseExpiry,
            licenseNotifyDays,
            passportNumber,
            passportExpiry,
            passportNotifyDays,
            idCardNumber,
            idCardExpiry,
            idCardNotifyDays,
            remarks,
            defaultBranch: defaultBranch || undefined,
            defaultShiftType,
            defaultFromTime,
            defaultToTime,
            defaultOffDay,
            employeeId,
            joiningDate,
            employmentType,
            status,
            isActive: status === undefined ? true : (status === 'Active'),
            performanceIssues: performanceIssues || [],
            branches: [] // Start with empty branches
        });

        res.status(201).json(sanitizeStaffPayload(staff));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update a staff member's details
// @route   PUT /api/staff/:id
// @access  Private (Admin with edit_pharmacist_accounts)
const updateStaff = async (req, res) => {
    if (!isValidObjectIdString(req.params.id)) {
        return res.status(400).json({ message: 'Invalid staff ID' });
    }

    const {
        name, pin, designation, rating,
        profilePicture, licenseNumber, licenseExpiry, licenseNotifyDays,
        passportNumber, passportExpiry, passportNotifyDays, idCardNumber, idCardExpiry, idCardNotifyDays,
        remarks, defaultBranch, defaultShiftType, defaultFromTime, defaultToTime, defaultOffDay,
        employeeId, joiningDate, employmentType, status, performanceIssues
    } = req.body;

    try {
        const staff = await Staff.findById(req.params.id);

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        if (name) staff.name = name;
        if (pin) staff.pin = pin;
        if (designation !== undefined) staff.designation = designation;
        if (rating !== undefined) staff.rating = rating;
        if (profilePicture !== undefined) staff.profilePicture = profilePicture;
        if (licenseNumber !== undefined) staff.licenseNumber = licenseNumber;
        if (licenseExpiry !== undefined) staff.licenseExpiry = licenseExpiry;
        if (licenseNotifyDays !== undefined) staff.licenseNotifyDays = licenseNotifyDays;
        if (passportNumber !== undefined) staff.passportNumber = passportNumber;
        if (passportExpiry !== undefined) staff.passportExpiry = passportExpiry;
        if (passportNotifyDays !== undefined) staff.passportNotifyDays = passportNotifyDays;
        if (idCardNumber !== undefined) staff.idCardNumber = idCardNumber;
        if (idCardExpiry !== undefined) staff.idCardExpiry = idCardExpiry;
        if (idCardNotifyDays !== undefined) staff.idCardNotifyDays = idCardNotifyDays;
        if (remarks !== undefined) staff.remarks = remarks;
        if (defaultBranch !== undefined) staff.defaultBranch = defaultBranch || null;
        if (defaultShiftType !== undefined) staff.defaultShiftType = defaultShiftType;
        if (defaultFromTime !== undefined) staff.defaultFromTime = defaultFromTime;
        if (defaultToTime !== undefined) staff.defaultToTime = defaultToTime;
        if (defaultOffDay !== undefined) staff.defaultOffDay = defaultOffDay;
        if (employeeId !== undefined) staff.employeeId = employeeId;
        if (joiningDate !== undefined) staff.joiningDate = joiningDate;
        if (employmentType !== undefined) staff.employmentType = employmentType;
        if (performanceIssues !== undefined) staff.performanceIssues = performanceIssues;
        if (status !== undefined) {
            staff.status = status;
            staff.isActive = (status === 'Active');
        }

        await staff.save();

        // Populate relationships before returning without PIN hash
        const updatedStaff = await Staff.findById(staff._id)
            .select(FULL_HR_STAFF_PROJECTION)
            .populate('branches', 'name')
            .populate('defaultBranch', 'name');

        res.json(sanitizeStaffPayload(updatedStaff));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Assign a branch to a staff member
// @route   PUT /api/staff/:id/branch
// @access  Private (Admin with assign_pharmacists_to_branches)
const assignStaffToBranch = async (req, res) => {
    const { branchId } = req.body || {};
    if (!isValidObjectIdString(req.params.id) || !isValidObjectIdString(branchId)) {
        return res.status(400).json({ message: 'Invalid staff ID or branch ID' });
    }

    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }
        if (!staff.branches.some((b) => String(b) === branchId)) {
            staff.branches.push(branchId);
            await staff.save();
        }
        const updatedStaff = await Staff.findById(staff._id)
            .select(BRANCH_ASSIGNMENT_STAFF_PROJECTION)
            .populate('branches', 'name');
        res.json(sanitizeStaffPayload(updatedStaff));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Remove a branch from a staff member
// @route   DELETE /api/staff/:id/branch/:branchId
// @access  Private (Admin with assign_pharmacists_to_branches)
const removeStaffFromBranch = async (req, res) => {
    const { branchId } = req.params;
    if (!isValidObjectIdString(req.params.id) || !isValidObjectIdString(branchId)) {
        return res.status(400).json({ message: 'Invalid staff ID or branch ID' });
    }

    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }
        staff.branches = staff.branches.filter(b => b.toString() !== branchId);
        await staff.save();
        
        const updatedStaff = await Staff.findById(staff._id)
            .select(BRANCH_ASSIGNMENT_STAFF_PROJECTION)
            .populate('branches', 'name');
        res.json(sanitizeStaffPayload(updatedStaff));
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Verify PIN for a staff member during request submission
// @route   POST /api/staff/verify
// @access  Private (Branch for own active staff, or Admin with staff-read permission)
const verifyStaffPin = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    const { staffId, pin } = req.body || {};
    if (!isValidObjectIdString(staffId) || typeof pin !== 'string' || pin.trim().length === 0) {
        return res.status(400).json({ message: 'Valid staffId and non-empty PIN are required' });
    }

    if (
        req.user.role !== 'branch'
        && !(req.user.role === 'admin' && hasAnyPermission(req.user, STAFF_READ_PERMISSIONS))
    ) {
        return res.status(403).json({ message: 'Forbidden: Unauthorized to verify staff PIN' });
    }

    try {
        const staff = await Staff.findById(staffId).select('+pin');

        if (!staff) {
            return res.status(401).json({ message: 'Invalid PIN' });
        }

        if (req.user.role === 'branch') {
            const isAssignedToBranch = Array.isArray(staff.branches)
                && staff.branches.some((b) => String(b) === String(req.user._id));
            if (!isAssignedToBranch) {
                return res.status(403).json({ message: 'Forbidden: Staff member is not assigned to this branch' });
            }
        }

        if (staff.isActive !== true) {
            return res.status(401).json({ message: 'Invalid PIN' });
        }

        const isMatch = await staff.matchPin(pin);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid PIN' });
        }

        return res.json({
            verified: true,
            staffId: staff._id,
            name: staff.name
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete (soft delete/deactivate) staff
// @route   DELETE /api/staff/:id
// @access  Private (Admin)
const deleteStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);

        if (staff) {
            await Staff.deleteOne({ _id: req.params.id }); 
            // Or use soft delete: staff.isActive = false; await staff.save();
            res.json({ message: 'Staff removed' });
        } else {
            res.status(404).json({ message: 'Staff not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get branch list for device shortcut setup
// @route   GET /api/staff/branches
// @access  Private (Admin with view_branches)
const getBranches = async (req, res) => {
    try {
        if (!hasPermission(req.user, 'view_branches')) {
            return res.status(403).json({ message: 'Forbidden: Requires view_branches permission' });
        }
        const branches = await Branch.find({}).select('_id name').sort({ name: 1 });
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

export { getStaff, addStaff, updateStaff, verifyStaffPin, deleteStaff, getBranches, assignStaffToBranch, removeStaffFromBranch };
