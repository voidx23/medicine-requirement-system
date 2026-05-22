import { useState, useEffect, useContext, useCallback } from 'react';
import { Plus, CheckSquare } from 'lucide-react';
import taskService from '../services/taskService';
import AuthContext from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Button from '../components/UI/Button';
import TaskCard from '../components/Tasks/TaskCard';
import TaskDetailModal from '../components/Tasks/TaskDetailModal';
import CreateTaskModal from '../components/Tasks/CreateTaskModal';
import { TaskCardSkeleton } from '../components/UI/Skeleton';

const AdminTasks = () => {
    const { user } = useContext(AuthContext);
    const { showToast } = useNotification();
    
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeMainTab, setActiveMainTab] = useState('pending'); // 'pending' | 'history'
    const [activeSubTab, setActiveSubTab] = useState('general'); // 'general' | 'transfers'
    const [searchQuery, setSearchQuery] = useState('');
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            const data = await taskService.getAdminTasks();
            setTasks(data);
        } catch (error) {
            console.error('Failed to load tasks:', error);
            showToast('Failed to load tasks', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (!user?.token) return;
        
        loadTasks();
        
        // Background polling every 10 seconds for real-time task tracking
        const intervalId = setInterval(() => {
            taskService.getAdminTasks().then(setTasks).catch(console.error);
        }, 10000);
        
        return () => clearInterval(intervalId);
    }, [user, loadTasks]);

    const handleSubmitTask = async (taskData) => {
        try {
            if (taskToEdit) {
                await taskService.updateTask(taskToEdit._id, taskData);
                showToast('Task updated successfully', 'success');
            } else {
                await taskService.createTask(taskData);
                showToast('Task created successfully', 'success');
            }
            loadTasks();
            setIsCreateModalOpen(false);
            setTaskToEdit(null);
            setSelectedTask(null);
        } catch (error) {
            console.error('Task save error:', error);
        }
    };

    const handleSubmitTransfer = async (details, editId = null) => {
        try {
            if (editId) {
                await taskService.updateTask(editId, { transferDetails: details });
                showToast('Transfer request updated!', 'success');
            } else {
                await taskService.createTransferRequest(details);
                showToast('Transfer request sent!', 'success');
            }
            setIsCreateModalOpen(false);
            setTaskToEdit(null);
            loadTasks();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save transfer request', 'error');
            throw error;
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await taskService.deleteTask(taskId);
            showToast('Task deleted successfully', 'success');
            loadTasks();
            setSelectedTask(null);
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete task', 'error');
        }
    };

    const handleEditClick = (task) => {
        setTaskToEdit(task);
        setIsCreateModalOpen(true);
    };

    // Logic to check if all pharmacies have finished a general task
    const isFullyCompleted = (task) => {
        if (task.type === 'transfer_request') {
            const items = task.transferDetails?.items || [];
            // If items exist, verify all are responded to. 
            // If no items (legacy), treat as completed if it's not pending.
            if (items.length === 0) return true; 
            return items.every(it => it.responseStatus !== 'pending');
        }
        return task.assignments?.length > 0 && task.assignments.every(a => a.status === 'Completed' || a.status === 'Rejected');
    };

    // Filter tasks into buckets
    const generalPending   = tasks.filter(t => t.type === 'general' && !isFullyCompleted(t));
    const generalHistory   = tasks.filter(t => t.type === 'general' && isFullyCompleted(t));
    const transfersPending = tasks.filter(t => t.type === 'transfer_request' && !isFullyCompleted(t));
    const transfersHistory = tasks.filter(t => t.type === 'transfer_request' && isFullyCompleted(t));

    let displayedTasks = [];
    if (activeMainTab === 'pending') {
        displayedTasks = activeSubTab === 'general' ? generalPending : transfersPending;
    } else {
        displayedTasks = activeSubTab === 'general' ? generalHistory : transfersHistory;
    }

    // In-Depth Search for Admin History
    if (activeMainTab === 'history' && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        displayedTasks = displayedTasks.filter(t => {
            const inTitle = t.title?.toLowerCase().includes(q);
            const inDesc  = t.description?.toLowerCase().includes(q);
            const inMedicine = t.transferDetails?.items?.some(it => it.medicineName?.toLowerCase().includes(q));
            // Search in any assignment comments
            const inComments = t.assignments?.some(a => a.comment?.toLowerCase().includes(q));
            return inTitle || inDesc || inMedicine || inComments;
        });
    }

    const mainTabStyle = (tab) => ({
        padding: '0.6rem 1.25rem', border: 'none', borderRadius: '10px', cursor: 'pointer',
        fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s',
        background: activeMainTab === tab ? 'var(--primary)' : 'transparent',
        color: activeMainTab === tab ? 'white' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        boxShadow: activeMainTab === tab ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
    });

    const subTabStyle = (tab) => ({
        padding: '0.4rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
        background: activeSubTab === tab ? 'white' : 'transparent',
        color: activeSubTab === tab ? 'var(--primary)' : 'var(--text-muted)',
        boxShadow: activeSubTab === tab ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
    });

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem', color: '#3b82f6' }}>
                        <CheckSquare size={24} />
                    </div>
                    <div>
                        <h1 className="header-title" style={{ margin: 0, fontSize: '1.5rem' }}>Task Management</h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Create action items and track pharmacy progress</p>
                    </div>
                </div>

                <Button 
                    className="btn-primary" 
                    icon={Plus} 
                    onClick={() => {
                        setTaskToEdit(null);
                        setIsCreateModalOpen(true);
                    }}
                >
                    Create New Task
                </Button>
            </div>

            {/* Navigation Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Main Level Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.03)', padding: '0.4rem', borderRadius: '14px', width: 'fit-content' }}>
                    <button onClick={() => setActiveMainTab('pending')} style={mainTabStyle('pending')}>
                        Active Tracking
                    </button>
                    <button onClick={() => setActiveMainTab('history')} style={mainTabStyle('history')}>
                        Task Archive
                    </button>
                </div>

                {/* Sub Level Tabs & Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', width: 'fit-content' }}>
                        <button onClick={() => setActiveSubTab('general')} style={subTabStyle('general')}>
                            General Tasks
                        </button>
                        <button onClick={() => setActiveSubTab('transfers')} style={subTabStyle('transfers')}>
                            Medicine Transfers
                        </button>
                    </div>

                    {activeMainTab === 'history' && (
                        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by title, medicine, or notes..."
                                style={{
                                    width: '100%', padding: '0.6rem 1rem', paddingLeft: '2.5rem',
                                    borderRadius: '10px', border: '1px solid var(--glass-border)',
                                    background: 'white', fontSize: '0.9rem'
                                }}
                            />
                            <CheckSquare size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => <TaskCardSkeleton key={i} />)}
                </div>
            ) : displayedTasks.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
                    <CheckSquare size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                    <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                        {activeMainTab === 'history' ? 'No records found' : 'No active tasks'}
                    </h3>
                    <p>
                        {activeMainTab === 'history' 
                            ? (searchQuery ? `No results for "${searchQuery}"` : "Completed records will appear here.") 
                            : (activeSubTab === 'general' ? "All assigned general tasks are currently completed by all branches." : "No active medicine transfer requests.")}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {displayedTasks.map(task => (
                        <TaskCard 
                            key={task._id} 
                            task={task} 
                            isAdminView={true} 
                            onClick={setSelectedTask} 
                        />
                    ))}
                </div>
            )}

            <CreateTaskModal 
                isOpen={isCreateModalOpen} 
                onClose={() => { setIsCreateModalOpen(false); setTaskToEdit(null); }} 
                onSubmit={handleSubmitTask} 
                onSubmitTransfer={handleSubmitTransfer}
                editTask={taskToEdit}
            />

            {selectedTask && (
                <TaskDetailModal 
                    task={selectedTask} 
                    isAdminView={true} 
                    onClose={() => setSelectedTask(null)} 
                    onComplete={() => {}}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteTask}
                    onResponded={() => { setSelectedTask(null); loadTasks(); }}
                />
            )}
        </div>
    );
};

export default AdminTasks;
