import { useState, useEffect, useContext } from 'react';
import { CheckSquare, ListTodo, History as HistoryIcon, ArrowRightLeft, Plus } from 'lucide-react';
import taskService from '../services/taskService';
import AuthContext from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import TaskCard from '../components/Tasks/TaskCard';
import TaskDetailModal from '../components/Tasks/TaskDetailModal';
import CreateTaskModal from '../components/Tasks/CreateTaskModal';
import { TaskCardSkeleton } from '../components/UI/Skeleton';

const PharmacyTasks = () => {
    const { user } = useContext(AuthContext);
    const { showToast } = useNotification();
    
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState(null);
    const [activeMainTab, setActiveMainTab] = useState('pending'); // 'pending' | 'history'
    const [activeSubTab, setActiveSubTab] = useState('general'); // 'general' | 'transfers'
    const [searchQuery, setSearchQuery] = useState('');
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await taskService.getPharmacyTasks();
            setTasks(data);
        } catch (error) {
            console.error('Failed to load tasks:', error);
            showToast('Failed to load tasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.token) return;
        
        loadTasks();
        
        // Background polling every 10 seconds for real-time task updates
        const intervalId = setInterval(() => {
            taskService.getPharmacyTasks().then(setTasks).catch(console.error);
        }, 10000);
        
        return () => clearInterval(intervalId);
    }, [user]);

    const handleCompleteTask = async (taskId, status, comment) => {
        try {
            await taskService.updateTaskStatus(taskId, { status, comment });
            showToast('Task marked as completed!', 'success');
            setSelectedTask(null);
            loadTasks();
        } catch (error) {
            showToast('Failed to complete task', 'error');
        }
    };

    const handleSubmitTransfer = async (details) => {
        try {
            await taskService.createTransferRequest(details);
            showToast('Transfer request sent!', 'success');
            setIsTransferModalOpen(false);
            loadTasks();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to send transfer request', 'error');
            throw error;
        }
    };

    // Logic to check if a task is "Done"
    const isFullyCompleted = (task) => {
        if (task.type === 'transfer_request') {
            const items = task.transferDetails?.items || [];
            // If items exist, verify all are responded to. 
            // If no items (legacy) or empty, move to history.
            if (!items || items.length === 0) return true; 
            return items.every(it => it.responseStatus !== 'pending');
        }
        return task.myAssignment?.status === 'Completed' || task.myAssignment?.status === 'Rejected';
    };

    // Separate tasks into buckets
    const generalPending   = tasks.filter(t => t.type === 'general' && t.myAssignment?.status === 'Pending');
    const generalHistory   = tasks.filter(t => t.type === 'general' && t.myAssignment?.status === 'Completed');
    
    // For Transfers, 'pending' means awaiting response. Any other response status moves it to history.
    const transfersPending = tasks.filter(t => t.type === 'transfer_request' && !isFullyCompleted(t));
    const transfersHistory = tasks.filter(t => t.type === 'transfer_request' && isFullyCompleted(t));

    let displayedTasks = [];
    if (activeMainTab === 'pending') {
        displayedTasks = activeSubTab === 'general' ? generalPending : transfersPending;
    } else {
        displayedTasks = activeSubTab === 'general' ? generalHistory : transfersHistory;
    }

    // Apply In-Depth Search for History
    if (activeMainTab === 'history' && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        displayedTasks = displayedTasks.filter(t => {
            const inTitle = t.title?.toLowerCase().includes(q);
            const inDesc  = t.description?.toLowerCase().includes(q);
            const inComment = t.myAssignment?.comment?.toLowerCase().includes(q);
            const inMedicine = t.transferDetails?.items?.some(it => it.medicineName?.toLowerCase().includes(q));
            return inTitle || inDesc || inComment || inMedicine;
        });
    }

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const mainTabStyle = (tab) => ({
        padding: isMobile ? '0.5rem 0.75rem' : '0.6rem 1.25rem', border: 'none', borderRadius: '10px', cursor: 'pointer',
        fontWeight: 700, fontSize: isMobile ? '0.85rem' : '0.95rem', transition: 'all 0.2s',
        background: activeMainTab === tab ? 'var(--primary)' : 'transparent',
        color: activeMainTab === tab ? 'white' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        boxShadow: activeMainTab === tab ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
        flex: isMobile ? 1 : 'none',
        justifyContent: 'center'
    });

    const subTabStyle = (tab) => ({
        padding: '0.4rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
        background: activeSubTab === tab ? 'white' : 'transparent',
        color: activeSubTab === tab ? 'var(--primary)' : 'var(--text-muted)',
        boxShadow: activeSubTab === tab ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        flex: isMobile ? 1 : 'none',
        justifyContent: 'center'
    });

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem', color: '#3b82f6' }}>
                        <ListTodo size={24} />
                    </div>
                    <div>
                        <h1 className="header-title" style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.5rem' }}>Task Inbox</h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Action items from central store</p>
                    </div>
                </div>

                {/* Request from Branch button */}
                <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', justifyContent: 'center' }}
                >
                    <ArrowRightLeft size={16} /> Request from Branch
                </button>
            </div>

            {/* Navigation Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Main Level Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.03)', padding: '0.4rem', borderRadius: '14px', width: isMobile ? '100%' : 'fit-content' }}>
                    <button onClick={() => setActiveMainTab('pending')} style={mainTabStyle('pending')}>
                        <ListTodo size={18} /> Active
                    </button>
                    <button onClick={() => setActiveMainTab('history')} style={mainTabStyle('history')}>
                        <HistoryIcon size={18} /> History
                    </button>
                </div>

                {/* Sub Level Tabs & Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
                    <div style={{ display: 'flex', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', width: isMobile ? '100%' : 'fit-content' }}>
                        <button onClick={() => setActiveSubTab('general')} style={subTabStyle('general')}>
                            General
                        </button>
                        <button onClick={() => setActiveSubTab('transfers')} style={subTabStyle('transfers')}>
                            Transfers
                        </button>
                    </div>

                    {activeMainTab === 'history' && (
                        <div style={{ position: 'relative', flex: 1, width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? 'none' : '400px' }}>
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tasks..."
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
                        {activeMainTab === 'history' ? 'No records found' : 'All caught up!'}
                    </h3>
                    <p>
                        {activeMainTab === 'history' 
                            ? (searchQuery ? `No results for "${searchQuery}"` : "Your completed tasks and transfers will appear here.") 
                            : (activeSubTab === 'general' ? "You don't have any pending tasks." : "No active medicine transfer requests.")}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {displayedTasks.map(task => (
                        <TaskCard key={task._id} task={task} isAdminView={false} onClick={setSelectedTask} />
                    ))}
                </div>
            )}

            {/* Task Detail Modal (also routes to TransferRequestModal for transfer tasks) */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    isAdminView={false}
                    onClose={() => setSelectedTask(null)}
                    onComplete={handleCompleteTask}
                    onResponded={() => { setSelectedTask(null); loadTasks(); }}
                />
            )}

            {/* Create Transfer Request Modal */}
            <CreateTaskModal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                onSubmit={() => {}}
                onSubmitTransfer={handleSubmitTransfer}
                editTask={null}
            />
        </div>
    );
};

export default PharmacyTasks;
