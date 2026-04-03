import { useState, useEffect, useContext } from 'react';
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
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);

    const loadTasks = async () => {
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
    };

    useEffect(() => {
        if (!user?.token) return;
        
        loadTasks();
        
        // Background polling every 10 seconds for real-time task tracking
        const intervalId = setInterval(() => {
            taskService.getAdminTasks().then(setTasks).catch(console.error);
        }, 10000);
        
        return () => clearInterval(intervalId);
    }, [user]);

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

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {Array.from({ length: 4 }).map((_, i) => <TaskCardSkeleton key={i} />)}
                </div>
            ) : tasks.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
                    <CheckSquare size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                    <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>No tasks created yet</h3>
                    <p>When you create tasks for pharmacies, they will appear here.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {tasks.map(task => (
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
