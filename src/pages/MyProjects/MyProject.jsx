import React, { useState, useEffect } from 'react';
import FrogLogo from '../../components/FrogLogo';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Trash2, ArrowRight, FolderClosed } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import {
  fetchProjects,
  createProject,
  deleteProject,
  migrateProjectsLegacyData,
} from '../../lib/projectService';

const MyProject = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  // Color schemes for project cards to make them vibrant and premium
  const cardAccents = [
    { border: 'border-l-[5px] border-l-indigo-500', bg: 'bg-indigo-50/10', iconColor: 'text-indigo-500', bar: 'from-indigo-500 to-indigo-650' },
    { border: 'border-l-[5px] border-l-emerald-500', bg: 'bg-emerald-50/10', iconColor: 'text-emerald-500', bar: 'from-emerald-500 to-emerald-600' },
    { border: 'border-l-[5px] border-l-amber-500', bg: 'bg-amber-50/10', iconColor: 'text-amber-500', bar: 'from-amber-500 to-amber-600' },
    { border: 'border-l-[5px] border-l-rose-500', bg: 'bg-rose-50/10', iconColor: 'text-rose-500', bar: 'from-rose-500 to-rose-600' },
    { border: 'border-l-[5px] border-l-violet-500', bg: 'bg-violet-50/10', iconColor: 'text-violet-500', bar: 'from-violet-500 to-violet-650' },
  ];

  // Load projects from Supabase on mount (after migrating any legacy localStorage data)
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      // 1. Run one-time legacy migration if needed
      await migrateProjectsLegacyData(user.id);
      // 2. Fetch projects from Supabase
      const list = await fetchProjects(user.id);
      setProjects(list);
      setLoading(false);
    };
    loadData();
  }, [user]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) {
      toast.error('Please enter a project name.');
      return;
    }

    const newProject = await createProject(user.id, name);
    if (!newProject) {
      toast.error('Failed to create project. Please try again.');
      return;
    }

    setProjects((prev) => [newProject, ...prev]);
    setNewProjectName('');
    toast.success('Project created successfully!');
  };

  const handleDeleteProject = async (e, projectId, projectName) => {
    e.stopPropagation(); // Avoid triggering card navigation
    if (window.confirm(`Are you sure you want to delete "${projectName}" and all its tasks?`)) {
      const success = await deleteProject(user.id, projectId);
      if (success) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        toast.success('Project deleted.');
      } else {
        toast.error('Failed to delete project. Please try again.');
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 flex flex-col h-full min-h-0 bg-white">

      {/* Creation form */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/20 p-4 rounded-xl border border-gray-200/80 shadow-sm">
        <form onSubmit={handleCreateProject} className="flex gap-2.5 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Enter project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-semibold h-[38px] shadow-sm transition-all"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center px-4 py-2 text-xs font-semibold shadow-sm transition active:scale-95 duration-100 h-[38px] gap-1.5 shrink-0"
          >
            <FolderPlus size={16} />
            Create Project
          </button>
        </form>
      </div>

      {/* Projects Grid List */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center py-16 bg-gray-50/50 rounded-2xl border border-gray-100 max-w-xl">
            <FrogLogo className="w-14 h-14 animate-bounce select-none block mb-3 mx-auto" />
            <p className="text-sm font-semibold text-gray-400">Loading projects…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-gray-50/50 rounded-2xl border border-gray-100 max-w-xl">
            <FolderClosed className="mx-auto text-gray-300 mb-3" size={44} />
            <p className="text-sm font-semibold text-gray-500">No projects created yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first project above to start tracking tasks</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project, idx) => {
              const { total, completed } = project.stats;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const theme = cardAccents[idx % cardAccents.length];

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/my-projects/${project.id}`)}
                  className={`bg-white p-4 rounded-xl border border-gray-200/80 hover:border-gray-300 hover:shadow-md transition-all duration-300 cursor-pointer group flex flex-col justify-between h-[145px] relative overflow-hidden ${theme.border} ${theme.bg}`}
                >
                  {/* Decorative faint background icon */}
                  <div className="absolute -right-2 -bottom-2 text-gray-100/30 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:scale-110">
                    <FolderClosed size={90} />
                  </div>

                  {/* Top Line with Name and Delete */}
                  <div className="flex justify-between items-start gap-2 relative z-10">
                    <div className="flex items-center gap-2">
                      <FolderClosed className={`${theme.iconColor} shrink-0`} size={17} />
                      <h3 className="font-extrabold text-gray-800 text-[15px] line-clamp-2 leading-snug group-hover:text-indigo-650 transition-colors">
                        {project.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                      className="text-gray-400 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200 flex-shrink-0"
                      title="Delete Project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Tasks count / progress section */}
                  <div className="mt-4 space-y-2 relative z-10">
                    <div className="flex justify-between text-xs font-semibold text-gray-500">
                      <span className="bg-slate-100/85 px-2 py-0.5 rounded-md text-[10px] text-gray-650 font-bold border border-slate-200/50">
                        {completed} / {total} Tasks
                      </span>
                      <span className="font-bold text-gray-700">{percent}%</span>
                    </div>

                    {/* Gradient Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-[6px] overflow-hidden border border-slate-200/20">
                      <div
                        className={`bg-gradient-to-r ${theme.bar} h-full rounded-full transition-all duration-300`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Action Link Icon */}
                  <div className="absolute bottom-2.5 right-2.5 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1.5 transition-all duration-300">
                    <ArrowRight size={15} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyProject;
