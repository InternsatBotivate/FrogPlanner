import React, { useState, useEffect, useRef } from 'react';
import FrogLogo from '../../components/FrogLogo';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, CheckSquare, Square,
  Calendar, User, StickyNote, Upload, FileText, Settings, Download, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import ModalForm from '../../components/ModalForm';
import ModalView from '../../components/ModalView';
import {
  fetchProjectWithTasks,
  createProjectTask,
  createProjectTasks,
  updateProjectTaskField,
  deleteProjectTask,
  fetchProjectNotes,
  createProjectNote,
  fetchProjectFiles,
  uploadProjectFile,
  deleteProjectFile,
  updateProjectField,
  deleteProject,
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

  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Load project details, tasks, notes & files from Supabase
  useEffect(() => {
    const loadProjectData = async () => {
      if (!user || !projectId) return;
      setLoading(true);
      const [data, projectNotes, projectFiles] = await Promise.all([
        fetchProjectWithTasks(user.id, projectId),
        fetchProjectNotes(projectId),
        fetchProjectFiles(projectId),
      ]);
      if (data) {
        setProject(data.project);
        setTasks(data.tasks);
        setNotes(projectNotes);
        setFiles(projectFiles);
      } else {
        toast.error('Project not found or access denied');
        navigate('/my-projects');
      }
      setLoading(false);
    };
    loadProjectData();
  }, [projectId, user, navigate]);

  // Handle pasting multiple rows from Excel/clipboard as project tasks
  useEffect(() => {
    if (loading || noteModalOpen || documentsModalOpen || settingsModalOpen) return;

    const handleGlobalPaste = async (e) => {
      const activeEl = document.activeElement;
      const isInputOrTextarea =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable);

      // If user is pasting into another input/textarea (like a note or settings field), let normal paste happen
      if (isInputOrTextarea && activeEl !== inputRef.current) {
        return;
      }

      const text = e.clipboardData?.getData('text');
      if (!text) return;

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Parse and create tasks if pasting multiple lines, or pasting a single line globally (outside input)
      if (lines.length > 1 || activeEl !== inputRef.current) {
        e.preventDefault();

        const loadToast = toast.loading(`Creating ${lines.length} task${lines.length > 1 ? 's' : ''}...`);
        const cleanedLines = lines.map(line => line.replace(/\t/g, ' '));
        const newTasks = await createProjectTasks(projectId, cleanedLines);

        toast.dismiss(loadToast);

        if (newTasks && newTasks.length > 0) {
          setTasks((prev) => [...prev, ...newTasks]);
          if (activeEl === inputRef.current) {
            setNewTaskDesc('');
          }
          toast.success(`Successfully created ${newTasks.length} task${newTasks.length > 1 ? 's' : ''}!`);
        } else {
          toast.error('Failed to create tasks. Please try again.');
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [projectId, loading, noteModalOpen, documentsModalOpen, settingsModalOpen]);

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

  const handleAddNote = async (e) => {
    e.preventDefault();
    const content = newNoteContent.trim();
    if (!content) return;

    setNoteSaving(true);
    const newNote = await createProjectNote(projectId, content);
    setNoteSaving(false);

    if (newNote) {
      setNotes((prev) => [newNote, ...prev]);
      setNewNoteContent('');
      setNoteModalOpen(false);
      toast.success('Note added.');
    } else {
      toast.error('Failed to add note. Please try again.');
    }
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // Allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    const newFile = await uploadProjectFile(projectId, file);
    setUploading(false);

    if (newFile) {
      setFiles((prev) => [newFile, ...prev]);
      toast.success('File uploaded.');
    } else {
      toast.error('Failed to upload file. Please try again.');
    }
  };

  const handleDeleteFile = async (fileId, filePath) => {
    if (!window.confirm('Delete this file?')) return;

    const success = await deleteProjectFile(fileId, filePath);
    if (success) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success('File removed.');
    } else {
      toast.error('Failed to remove file');
    }
  };

  const openSettingsModal = () => {
    setSettingsName(project.name);
    setSettingsDescription(project.description || '');
    setSettingsModalOpen(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const trimmedName = settingsName.trim();
    if (!trimmedName) {
      toast.error('Project name cannot be empty.');
      return;
    }

    setSettingsSaving(true);
    const success = await updateProjectField(user.id, projectId, {
      name: trimmedName,
      description: settingsDescription.trim(),
    });
    setSettingsSaving(false);

    if (success) {
      setProject((prev) => ({ ...prev, name: trimmedName, description: settingsDescription.trim() }));
      setSettingsModalOpen(false);
      toast.success('Project updated.');
    } else {
      toast.error('Failed to update project. Please try again.');
    }
  };

  const handleDeleteProjectFromSettings = async () => {
    if (!window.confirm(`Are you sure you want to delete "${project.name}" and all its tasks?`)) return;

    const success = await deleteProject(user.id, projectId);
    if (success) {
      toast.success('Project deleted.');
      navigate('/my-projects');
    } else {
      toast.error('Failed to delete project. Please try again.');
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
          <FrogLogo className="w-14 h-14 animate-bounce select-none block mb-3 mx-auto" />
          <p className="text-sm font-semibold text-gray-400">Loading project checklist…</p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const pendingCount = totalCount - completedCount;

  const statusLabel = totalCount === 0 ? 'No Tasks' : percent === 100 ? 'Completed' : percent === 0 ? 'Not Started' : 'In Progress';
  const statusColor = statusLabel === 'Completed' ? 'bg-emerald-100 text-emerald-700' : statusLabel === 'In Progress' ? 'bg-indigo-100 text-indigo-650' : 'bg-gray-100 text-gray-500';

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="pb-2.5 flex items-center justify-between gap-2.5 sm:gap-3.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            onClick={() => navigate('/my-projects')}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-gray-500 hover:text-indigo-650 transition active:scale-95 border border-gray-200 shadow-sm shrink-0"
            title="Back to Projects"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
              <h1 className="text-base sm:text-xl font-extrabold text-gray-850 truncate max-w-[160px] sm:max-w-none">{project.name}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <p className="hidden sm:block text-xs text-gray-400 mt-0.5">Project Checklist & Notes</p>
          </div>
        </div>


      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-5 min-h-0 overflow-y-auto lg:overflow-visible pr-0.5">
        {/* Task Card */}
        <div className="w-full lg:flex-1 lg:min-w-0 h-[65vh] lg:h-auto flex-shrink-0 lg:flex-shrink bg-white border border-gray-200/70 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden relative">

          {/* Progress header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 select-none flex-shrink-0">
            <div className="flex-1 bg-slate-100 rounded-full h-[7px] overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
            <span className="text-[11px] text-gray-500 font-bold whitespace-nowrap">
              {completedCount} of {totalCount} completed
            </span>
            <span className="text-[11px] text-gray-700 font-extrabold w-8 text-right">{percent}%</span>
          </div>

          <div className="flex-1 relative flex flex-col min-h-0">
            {/* New task input row */}
            <div className="flex items-center h-[44px] relative group hover:bg-slate-50/50 transition-colors duration-150 border-b border-gray-100 flex-shrink-0">
              <div className="w-[44px] flex items-center justify-center flex-shrink-0 text-gray-300">
                <Plus size={16} />
              </div>
              <div className="flex-1 flex items-center pl-1 pr-3 h-full min-w-0">
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
                  placeholder="Type a new task and press Enter..."
                  className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm font-semibold text-gray-500 placeholder-gray-300 p-0 w-full h-[44px] leading-[44px]"
                />
              </div>
            </div>

            {/* Scrollable task list */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0 divide-y divide-gray-100">
              {sortedTasks.map((task) => {
                return (
                  <div
                    key={task.id}
                    className="flex items-start min-h-[44px] relative group hover:bg-slate-50/50 transition-colors duration-150"
                  >
                    {/* Checkbox */}
                    <div className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className={`focus:outline-none flex-shrink-0 transition-all duration-200 active:scale-90 rounded-md ${task.isCompleted ? 'text-emerald-600' : 'text-gray-300 hover:text-indigo-500'
                          }`}
                      >
                        {task.isCompleted ? (
                          <CheckSquare size={19} className="fill-emerald-50" />
                        ) : (
                          <Square size={19} />
                        )}
                      </button>
                    </div>

                    {/* Editable Task Description */}
                    <div className="flex-1 flex items-center pl-1 pr-9 py-[13px] min-w-0">
                      <textarea
                        rows={1}
                        value={task.description}
                        onChange={(e) => {
                          handleUpdateTaskField(task.id, 'description', e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onBlur={() => handlePersistTaskChange(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            e.target.blur();
                          }
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = `${el.scrollHeight}px`;
                          }
                        }}
                        className={`flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm font-semibold p-0 w-full leading-[20px] resize-none overflow-hidden whitespace-pre-wrap break-words ${task.isCompleted ? 'line-through text-gray-400 font-normal decoration-gray-300' : 'text-gray-800'
                          }`}
                      />
                    </div>

                    {/* Real created date */}
                    <span className="hidden sm:inline-block text-[10px] font-semibold text-gray-400 mt-[13px] mr-9 whitespace-nowrap flex-shrink-0">
                      {formatDate(task.createdAt)}
                    </span>

                    {/* Delete button — always visible on touch devices, hover-reveal on desktop */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="absolute right-2 top-2.5 text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200 flex-shrink-0"
                      title="Delete Task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right sidebar: project overview, quick actions, notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-4 w-full lg:w-[260px] flex-shrink-0 lg:overflow-y-auto lg:pr-1">

          {/* Project Overview: details + progress combined */}
          <div className="bg-white border border-gray-200/70 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <h3 className="text-[11px] font-extrabold text-gray-400 tracking-wide uppercase mb-3">Project Overview</h3>
            <div className="space-y-3 text-xs">
              {project.description && (
                <p className="text-gray-700 font-medium leading-snug">{project.description}</p>
              )}

              {/* Progress: single bar + stat chips (mirrors the task list header, no redundant donut) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                  <span className="text-gray-800 font-extrabold">{percent}%</span>
                </div>
                <div className="bg-slate-100 rounded-full h-[6px] overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-gray-500 font-semibold">Done</span>
                    <span className="text-gray-800 font-bold">{completedCount}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span className="text-gray-500 font-semibold">Pending</span>
                    <span className="text-gray-800 font-bold">{pendingCount}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar size={12} className="text-gray-400 shrink-0" />
                  <p className="text-gray-700 font-bold truncate">{formatDate(project.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <User size={12} className="text-gray-400 shrink-0" />
                  <p className="text-gray-700 font-bold truncate">{user?.name || user?.email || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Note */}
          <div className="bg-white border border-gray-200/70 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <h3 className="text-[11px] font-extrabold text-gray-400 tracking-wide uppercase mb-3">Recent Note</h3>
            {notes.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium">No notes yet</p>
            ) : (
              <div>
                <p className="text-xs text-gray-700 font-medium leading-snug line-clamp-3">{notes[0].content}</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1.5">
                  {formatDistanceToNow(new Date(notes[0].createdAt), { addSuffix: true })}
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-gray-200/70 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
            <h3 className="text-[11px] font-extrabold text-gray-400 tracking-wide uppercase mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-gray-600 hover:bg-slate-50 hover:text-indigo-650 py-2.5 rounded-lg border border-gray-100 transition"
              >
                <StickyNote size={16} className="text-amber-500" />
                Add Note
              </button>
              {/* File upload module disabled for now
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-gray-600 hover:bg-slate-50 hover:text-indigo-650 py-2.5 rounded-lg border border-gray-100 transition disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={16} className="text-indigo-500 animate-spin" />
                ) : (
                  <Upload size={16} className="text-indigo-500" />
                )}
                {uploading ? 'Uploading…' : 'Upload File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                type="button"
                onClick={() => setDocumentsModalOpen(true)}
                className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-gray-600 hover:bg-slate-50 hover:text-indigo-650 py-2.5 rounded-lg border border-gray-100 transition"
              >
                <FileText size={16} className="text-emerald-500" />
                Documents{files.length > 0 ? ` (${files.length})` : ''}
              </button>
              */}
              <button
                type="button"
                onClick={openSettingsModal}
                className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-gray-600 hover:bg-slate-50 hover:text-indigo-650 py-2.5 rounded-lg border border-gray-100 transition"
              >
                <Settings size={16} className="text-gray-400" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Note modal */}
      <ModalForm
        isOpen={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        title="Add Note"
        onSubmit={handleAddNote}
        submitText="Save Note"
        loading={noteSaving}
      >
        <textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Write a note about this project..."
          rows={3}
          autoFocus
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
        />
        {notes.length > 0 && (
          <div className="pt-2 space-y-2 max-h-40 overflow-y-auto">
            <p className="text-[10px] font-extrabold text-gray-400 tracking-wide uppercase">Previous Notes</p>
            {notes.map((n) => (
              <div key={n.id} className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xs text-gray-700">{n.content}</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </ModalForm>

      {/* View Documents modal */}
      <ModalView
        isOpen={documentsModalOpen}
        onClose={() => setDocumentsModalOpen(false)}
        title="Documents"
      >
        {files.length === 0 ? (
          <p className="text-xs text-gray-400 font-medium text-center py-8">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg p-2.5">
                <FileText size={16} className="text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{f.fileName}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    {f.fileSize ? `${(f.fileSize / 1024).toFixed(1)} KB` : ''} · {formatDate(f.uploadedAt)}
                  </p>
                </div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition shrink-0"
                  title="Download"
                >
                  <Download size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => handleDeleteFile(f.id, f.filePath)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </ModalView>

      {/* Project Settings modal */}
      <ModalForm
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="Project Settings"
        onSubmit={handleSaveSettings}
        submitText="Save Changes"
        loading={settingsSaving}
      >
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Project Name</label>
          <input
            type="text"
            value={settingsName}
            onChange={(e) => setSettingsName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
          <textarea
            value={settingsDescription}
            onChange={(e) => setSettingsDescription(e.target.value)}
            rows={3}
            placeholder="What's this project about?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
          />
        </div>
        <div className="pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleDeleteProjectFromSettings}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition"
          >
            <Trash2 size={14} />
            Delete Project
          </button>
        </div>
      </ModalForm>
    </div>
  );
};

export default Myprojecttask;
