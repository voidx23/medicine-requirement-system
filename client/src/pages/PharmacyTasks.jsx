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
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'transfers' | 'completed'
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

    // Separate tasks into buckets
    const generalPending   = tasks.filter(t => t.type === 'general' && t.myAssignment?.status === 'Pending');
    const generalCompleted = tasks.filter(t => t.type === 'general' && t.myAssignment?.status === 'Completed');
    const transferTasks    = tasks.filter(t => t.type === 'transfer_request');

    const displayedTasks =
        activeTab === 'pending'   ? generalPending :
        activeTab === 'transfers' ? transferTasks  :
        generalCompleted;

    const tabStyle = (tab) => ({
        padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
        background: activeTab === tab ? 'white' : 'transparent',
        color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
        boxShadow: activeTab === tab ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
    });

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem', color: '#3b82f6' }}>
                        <ListTodo size={24} />
                    </div>
                    <div>
                        <h1 className="header-title" style={{ margin: 0, fontSize: '1.5rem' }}>Task Inbox</h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Action items assigned by the central store</p>
                    </div>
                </div>

                {/* Request from Branch button */}
                <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                >
                    <ArrowRightLeft size={16} /> Request from Branch
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--glass-bg)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '1.5rem', alignSelf: 'flex-start', width: 'fit-content' }}>
                <button onClick={() => setActiveTab('pending')} style={tabStyle('pending')}>
                    Pending {generalPending.length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>{generalPending.length}</span>}
                </button>
                <button onClick={() => setActiveTab('transfers')} style={tabStyle('transfers')}>
                    <ArrowRightLeft size={15} /> Transfers {transferTasks.filter(t => t.transferResponse?.responseStatus === 'pending' && t.transferRole === 'donor').length > 0 && (
                        <span style={{ background: '#f59e0b', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>
                            {transferTasks.filter(t => t.transferResponse?.responseStatus === 'pending' && t.transferRole === 'donor').length}
                        </span>
                    )}
                </button>
                <button onClick={() => setActiveTab('completed')} style={tabStyle('completed')}>
                    <HistoryIcon size={15} /> History
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => <TaskCardSkeleton key={i} />)}
                </div>
            ) : displayedTasks.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
                    <CheckSquare size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                    <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                        {activeTab === 'pending' ? 'All caught up!' : activeTab === 'transfers' ? 'No transfer requests.' : 'No completed tasks yet.'}
                    </h3>
                    <p>
                        {activeTab === 'pending' ? "You don't have any pending tasks." :
                         activeTab === 'transfers' ? "No medicine transfer requests yet. Use the button above to request medicine from another branch." :
                         "Completed tasks will appear here."}
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
