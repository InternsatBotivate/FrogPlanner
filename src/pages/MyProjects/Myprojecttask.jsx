import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import {
  fetchProjectWithTasks,
  createProjectTask,
  updateProjectTaskField,
  deleteProjectTask,
} from '../../lib/projectService';

const Myprojecttask = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const inputRef = useRef(null);
  
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [loading, setLoading] = useState(true);

  // Load project details & tasks from Supabase
  useEffect(() => {
    const loadProjectData = async () => {
      if (!user || !projectId) return;
      setLoading(true);
      const data = await fetchProjectWithTasks(user.id, projectId);
      if (data) {
        setProject(data.project);
        setTasks(data.tasks);
      } else {
        toast.error('Project not found or access denied');
        navigate('/my-projects');
      }
      setLoading(false);
    };
    loadProjectData();
  }, [projectId, user, navigate]);

  const handleCreateTaskInline = async () => {
    const desc = newTaskDesc.trim();
    if (!desc) return;

    const newTask = await createProjectTask(projectId, desc);
    if (newTask) {
      setTasks((prev) => [...prev, newTask]);
      setNewTaskDesc('');
    } else {
      toast.error('Failed to create task. Please try again.');
    }
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const handleUpdateTaskField = (taskId, field, value) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
    );
  };

  const handlePersistTaskChange = async (taskId) => {
    const taskToSave = tasks.find(t => t.id === taskId);
    if (!taskToSave) return;
    
    const trimmedDesc = taskToSave.description.trim();
    if (!trimmedDesc) {
      // If description is empty, delete it
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      const success = await deleteProjectTask(taskId);
      if (success) {
        toast.success('Task removed.');
      } else {
        toast.error('Failed to remove task');
        // Restore from DB
        const data = await fetchProjectWithTasks(user.id, projectId);
        if (data) setTasks(data.tasks);
      }
    } else {
      const success = await updateProjectTaskField(taskId, 'description', trimmedDesc);
      if (!success) {
        toast.error('Failed to update task description');
        // Restore from DB
        const data = await fetchProjectWithTasks(user.id, projectId);
        if (data) setTasks(data.tasks);
      }
    }
  };

  const handleToggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.isCompleted;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: newCompleted } : t))
    );

    const success = await updateProjectTaskField(taskId, 'isCompleted', newCompleted);
    if (!success) {
      toast.error('Failed to update task status');
      // Revert optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !newCompleted } : t))
      );
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Delete this task?')) {
      // Optimistic update
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      const success = await deleteProjectTask(taskId);
      if (success) {
        toast.success('Task removed.');
      } else {
        toast.error('Failed to remove task');
        // Revert by re-fetching
        const data = await fetchProjectWithTasks(user.id, projectId);
        if (data) setTasks(data.tasks);
      }
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;
    return new Date(a.createdAt) - new Date(b.createdAt); // Keep original order or chronologically ascending
  });

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5 flex flex-col h-full min-h-0 bg-white">
        <div className="pb-2.5 flex items-center gap-3.5 bg-white border-b border-gray-100">
          <button
            onClick={() => navigate('/my-projects')}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-gray-500 hover:text-indigo-650 transition active:scale-95 border border-gray-200 shadow-sm"
            title="Back to Projects"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-gray-850">Loading...</h1>
            <p className="text-xs text-gray-400 mt-0.5">Project Checklist & Notes</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-gray-50/50 rounded-2xl border border-gray-100 max-w-2xl">
          <span className="text-4xl animate-bounce select-none block mb-3">🐸</span>
          <p className="text-sm font-semibold text-gray-400">Loading project checklist…</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.isCompleted).length;

  return (
    <div className="p-4 md:p-6 space-y-5 flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="pb-2.5 flex items-center gap-3.5 bg-white border-b border-gray-100">
        <button
          onClick={() => navigate('/my-projects')}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-gray-500 hover:text-indigo-650 transition active:scale-95 border border-gray-200 shadow-sm"
          title="Back to Projects"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-gray-850">{project.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Project Checklist & Notes</p>
        </div>
      </div>

      {/* Lined Notebook Paper Card */}
      <div className="flex-1 bg-white border border-gray-250/90 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] max-w-2xl flex flex-col overflow-hidden relative">
        
        {/* Paper top binder decoration */}
        <div className="h-6 bg-slate-50 border-b border-gray-200/80 flex items-center px-4 gap-1.5 select-none">
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          <span className="text-[10px] text-gray-400 font-bold ml-auto">
            {completedCount} of {totalCount} completed
          </span>
        </div>

        <div className="flex-1 relative flex flex-col min-h-0">
          {/* Vertical Red Margin Line (matches physical legal pad layout) */}
          <div className="absolute left-[44px] top-0 bottom-0 border-l-[1.5px] border-red-300/60 pointer-events-none z-10"></div>

          {/* Ruled lines sheet */}
          <div 
            className="flex-1 overflow-y-auto pr-1"
            style={{ 
              backgroundImage: 'linear-gradient(rgba(226, 232, 240, 0.7) 1px, transparent 1px)',
              backgroundSize: '100% 40px',
            }}
          >
            {sortedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center h-[40px] relative group hover:bg-slate-50/40 transition-colors duration-150"
              >
                {/* Checkbox (Left of margin line) */}
                <div className="w-[44px] flex items-center justify-center flex-shrink-0 z-20">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id)}
                    className={`focus:outline-none flex-shrink-0 transition-all duration-200 active:scale-90 ${
                      task.isCompleted ? 'text-indigo-600' : 'text-gray-450 hover:text-indigo-650'
                    }`}
                  >
                    {task.isCompleted ? (
                      <CheckSquare size={19} className="fill-indigo-50" />
                    ) : (
                      <Square size={19} />
                    )}
                  </button>
                </div>
                
                {/* Editable Task Description input (Right of margin line) */}
                <div className="flex-1 flex items-center pl-3.5 pr-2 h-full z-20 min-w-0">
                  <input
                    type="text"
                    value={task.description}
                    onChange={(e) => handleUpdateTaskField(task.id, 'description', e.target.value)}
                    onBlur={() => handlePersistTaskChange(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    className={`flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm font-semibold p-0 w-full h-[40px] leading-[40px] ${
                      task.isCompleted ? 'line-through text-gray-400 font-normal decoration-gray-300' : 'text-gray-800'
                    }`}
                  />
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDeleteTask(task.id)}
                  className="absolute right-2 text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 z-30"
                  title="Delete Task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            
            {/* Notepad Input Line (Direct Typing) */}
            <div className="flex items-center h-[40px] relative group hover:bg-slate-50/40 transition-colors duration-150">
              <div className="w-[44px] flex items-center justify-center flex-shrink-0 z-20 text-gray-300">
                <Plus size={16} />
              </div>
              <div className="flex-1 flex items-center pl-3.5 pr-2 h-full z-20 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateTaskInline();
                    }
                  }}
                  onBlur={handleCreateTaskInline}
                  placeholder="Type a new task here and press Enter..."
                  className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm font-semibold text-gray-400 placeholder-gray-300 p-0 w-full h-[40px] leading-[40px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Myprojecttask;
