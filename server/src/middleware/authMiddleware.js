import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Branch from '../models/Branch.js';

export const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_dev_only');

            // Branch token has role: 'branch' in the payload
            if (decoded.role === 'branch') {
                const branch = await Branch.findById(decoded.id).select('-password');
                if (branch) {
                    req.user = {
                        _id: branch._id,
                        username: branch.name,
                        role: 'branch',
                        isSuperAdmin: false,
                        permissions: [],
                        location: branch.location,
                        contactNumber: branch.contactNumber,
                    };
                    return next();
                }
            } else {
                req.user = await User.findById(decoded.id).select('-password');
            }

            if (!req.user) {
                 return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};

export const superAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin' && req.user.isSuperAdmin) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a super admin' });
    }
};

const LEGACY_MAPPING = {
  view_requirements: ['dashboard'],
  add_requirement_item: ['dashboard'],
  remove_requirement_item: ['dashboard'],
  toggle_requirement_urgency: ['dashboard'],
  generate_requirement_pdf: ['dashboard', 'reports', 'history'],
  
  view_tasks: ['tasks'],
  create_tasks: ['tasks'],
  edit_tasks: ['tasks'],
  delete_tasks: ['tasks'],
  
  view_requests: ['requests'],
  fulfill_requests: ['requests'],
  edit_requests: ['requests'],
  forward_requests: ['requests'],
  
  view_order_history: ['history'],
  delete_order_history: ['history'],
  
  view_reports_dashboard: ['reports'],
  view_supplier_expiry_reports: ['reports'],
  view_medicine_audit_logs: ['reports'],
  
  view_medicines: ['medicines', 'edit_medicines'],
  edit_medicines: ['edit_medicines'],
  delete_medicines: ['edit_medicines'],
  bulk_update_medicine_pricing: ['edit_medicines'],
  import_medicines_excel: ['import_excel'],
  import_medicine_units_excel: ['import_excel'],
  
  view_suppliers: ['suppliers', 'edit_suppliers'],
  edit_suppliers: ['edit_suppliers'],
  delete_suppliers: ['edit_suppliers'],
  import_suppliers_excel: ['import_excel'],
  
  view_expiry_returns: ['expiry_returns'],
  verify_expiry_returns: ['expiry_returns'],
  dispose_expiry_items: ['expiry_returns'],
  edit_expiry_returns: ['expiry_returns'],
  delete_expiry_returns: ['expiry_returns'],
  process_handover: ['expiry_returns'],
  view_supplier_ledgers: ['expiry_returns'],
  log_supplier_compensation: ['expiry_returns'],
  delete_supplier_ledgers: ['expiry_returns'],
  
  view_purchasing: [],
  create_purchase_orders: [],
  receive_purchase_orders: [],
  
  view_duty_schedules: ['duty_schedules', 'workforce'],
  edit_duty_schedules: ['duty_schedules', 'workforce'],
};

export const requirePermission = (permission) => {
    return (req, res, next) => {
        if (req.user && req.user.role === 'admin' && req.user.isSuperAdmin) {
            return next();
        }
        if (req.user && req.user.role === 'admin' && req.user.permissions) {
            if (req.user.permissions.includes(permission)) {
                return next();
            }
            const legacyFallbacks = LEGACY_MAPPING[permission] || [];
            const hasLegacyFallback = legacyFallbacks.some(legacyPerm => req.user.permissions.includes(legacyPerm));
            if (hasLegacyFallback) {
                return next();
            }
        }
        res.status(403).json({ message: `Forbidden: Requires ${permission} permission` });
    };
};
