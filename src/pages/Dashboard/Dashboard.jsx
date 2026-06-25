import React, { useState, useEffect, useMemo } from 'react';
import FrogLogo from '../../components/FrogLogo';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Droplets,
  Coffee, UtensilsCrossed, Moon, Brain, Smile, Zap, Target,
  Plus, Timer, Bot, ListTodo, ArrowUpRight, ArrowDownRight, Minus, ChevronLeft, ChevronRight,
  Calendar, CheckSquare, Compass, AlertCircle, Trash2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getCategoryEmoji } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import { usePlannerStore } from '../../store/plannerStore';
import ModalForm from '../../components/ModalForm';
import ModalAlert from '../../components/ModalAlert';
import toast from 'react-hot-toast';

// Inline ProgressCircle component since we don't have separate ProgressCircle.jsx
const ProgressCircle = ({ value, size = 90, strokeWidth = 7, color, label }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle className="text-gray-100" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size/2} cy={size/2} />
        <circle stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" fill="transparent" r={radius} cx={size/2} cy={size/2} className="transition-all duration-500" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold text-gray-800">{value}%</span>
        <span className="text-[8px] font-extrabold text-gray-400 uppercase tracking-tight">{label}</span>
      </div>
    </div>
  );
};

const ProductivityChart = React.memo(({ data }) => (
  <div className="h-44">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: '11px',
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#6366F1"
          strokeWidth={3}
          fill="url(#scoreColor)"
          dot={{ r: 4, fill: '#6366F1', strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
));

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, updateCustomCategories } = useAuthStore();
  
  // Central state and actions from Zustand store
  const { tasks, completions, loading, fetchPlannerData, toggleCompletion, addPlannerTasks } = usePlannerStore();

  // Time-based greeting
  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12)  return { wish: 'Good Morning', emoji: '🌅', sub: 'Start strong — eat your frog first!' };
    if (h >= 12 && h < 17) return { wish: 'Good Afternoon', emoji: '☀️', sub: 'Stay focused and keep the momentum going.' };
    if (h >= 17 && h < 21) return { wish: 'Good Evening', emoji: '🌇', sub: 'Great work today — review and wrap up.' };
    return { wish: 'Good Night', emoji: '🌙', sub: 'Rest well. Tomorrow, eat the frog early!' };
  };
  const greeting = getTimeGreeting();
  const [timeRange, setTimeRange] = useState('Today'); // Today, Weekly, Monthly
  const [showTodayModal, setShowTodayModal] = useState(false);

  // Helper to format Date objects as YYYY-MM-DD
  const formatDateObj = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayStr = () => formatDateObj(new Date());

  // selectedDate is our Base Reference Date (initialized to today)
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const selectedDateStr = useMemo(() => {
    return formatDateObj(selectedDate);
  }, [selectedDate]);

  const customCategories = user?.custom_categories || ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: selectedDateStr
  });

  // Dynamic row array of descriptions, duration, category, and priority selections
  const [tasksList, setTasksList] = useState([
    { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }
  ]);

  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: () => {} });

  // Keep date sync when active date selector changes
  useEffect(() => {
    setFormData({ date: selectedDateStr });
  }, [selectedDateStr]);

  const handleAddTaskClick = () => {
    setFormData({
      date: selectedDateStr
    });
    setTasksList([{ description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
    setShowModal(true);
  };

  const handleAddRow = () => {
    setTasksList([...tasksList, { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
  };

  const handleFieldChange = (index, field, value) => {
    const newList = [...tasksList];
    newList[index][field] = value;
    setTasksList(newList);
  };

  const handleRemoveRow = (index) => {
    if (tasksList.length > 1) {
      setTasksList(tasksList.filter((_, i) => i !== index));
    } else {
      setTasksList([{ description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
    }
  };

  const handleAddCategoryInline = async (idx) => {
    const text = (tasksList[idx].newCategoryText || '').trim();
    if (!text) return;
    if (customCategories.includes(text)) {
      handleFieldChange(idx, 'category', text);
      handleFieldChange(idx, 'isCreatingCategory', false);
      return;
    }
    const updated = [...customCategories, text];
    await updateCustomCategories(updated);
    handleFieldChange(idx, 'category', text);
    handleFieldChange(idx, 'isCreatingCategory', false);
    handleFieldChange(idx, 'newCategoryText', '');
  };

  const handleCategorySelectChange = (idx, value) => {
    if (value === '__NEW__') {
      handleFieldChange(idx, 'isCreatingCategory', true);
    } else {
      handleFieldChange(idx, 'category', value);
    }
  };

  const showAlert = (type, title, message) => {
    setAlertConfig({ isOpen: true, type, title, message, onConfirm: () => {} });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validRows = tasksList.filter(row => row.description.trim().length > 0);

    if (validRows.length === 0) {
      showAlert('error', 'Validation Error', 'Please enter at least one task description.');
      return;
    }

    if (!user?.id) return;

    setModalLoading(true);
    // Format rows correctly for addPlannerTasks
    const tasksToCreate = validRows.map(row => ({
      description: row.description.trim(),
      duration: row.duration,
      category: row.category,
      priority: row.priority || '',
      date: formData.date,
      selectValue: 'Select',
      remarks: ''
    }));

    const createdTasks = await addPlannerTasks(user.id, tasksToCreate);
    if (createdTasks && createdTasks.length > 0) {
      showAlert('success', 'Created!', `${createdTasks.length} task(s) added successfully.`);
    } else {
      showAlert('error', 'Database Error', 'Failed to save tasks to Supabase.');
    }
    setModalLoading(false);
    setShowModal(false);
  };

  // Health and Mood tracking logs loaded from localStorage
  const [healthLogs, setHealthLogs] = useState(() => {
    const saved = localStorage.getItem('pcb_health_logs');
    return saved ? JSON.parse(saved) : {};
  });

  // Current day's health metrics
  const currentHealth = useMemo(() => {
    return healthLogs[selectedDateStr] || { breakfast: false, lunch: false, dinner: false, water: 0, goal: 8, mood: 'Neutral' };
  }, [healthLogs, selectedDateStr]);

  // Load tasks and completions from Supabase on mount/user change
  useEffect(() => {
    if (user?.id) {
      fetchPlannerData(user.id);
    }
  }, [user, fetchPlannerData]);

  // Update health logs in localStorage
  const saveHealthLogs = (updated) => {
    setHealthLogs(updated);
    localStorage.setItem('pcb_health_logs', JSON.stringify(updated));
  };

  const toggleMeal = (mealKey) => {
    const dayLog = { ...currentHealth, [mealKey]: !currentHealth[mealKey] };
    const updated = { ...healthLogs, [selectedDateStr]: dayLog };
    saveHealthLogs(updated);
  };

  const addWater = () => {
    const dayLog = { ...currentHealth, water: Math.min(currentHealth.water + 1, currentHealth.goal) };
    const updated = { ...healthLogs, [selectedDateStr]: dayLog };
    saveHealthLogs(updated);
  };

  const setMood = (mood) => {
    const dayLog = { ...currentHealth, mood };
    const updated = { ...healthLogs, [selectedDateStr]: dayLog };
    saveHealthLogs(updated);
  };

  const handleToggleTaskStatus = async (id) => {
    if (!user?.id) return;
    const currentCompleted = completions[selectedDateStr] || [];
    const isAdding = !currentCompleted.includes(id);
    // toggleCompletion already optimistically updates both completions and selectValue in the store
    await toggleCompletion(user.id, id, selectedDateStr, isAdding);
  };

  // Navigates week view
  const navWeek = (direction) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction * 7);
    setSelectedDate(d);
  };

  // Week dates for the Quick Nav bar
  const weekDates = useMemo(() => {
    const start = new Date(selectedDate);
    // Find the Sunday of the selected week
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  // Get dates list for consolidated range calculation
  const getDatesForRange = (range, baseDate) => {
    const dates = [];
    const base = new Date(baseDate);
    let days = 1;
    if (range === 'Weekly') days = 7;
    if (range === 'Monthly') days = 30;

    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      dates.push(formatDateObj(d));
    }
    return dates;
  };

  const relevantDates = getDatesForRange(timeRange, selectedDate);

  // Statistics for selected range
  const totalCount = relevantDates.reduce((acc, dStr) => {
    const dateTasks = tasks.filter(t => !t.isRecurring && t.date === dStr);
    return acc + dateTasks.length;
  }, 0);

  const completedCount = relevantDates.reduce((acc, dStr) => {
    const doneIds = completions[dStr] || [];
    const dateTasks = tasks.filter(t => !t.isRecurring && t.date === dStr);
    return acc + dateTasks.filter(t => doneIds.includes(t.id) || t.selectValue === 'Done').length;
  }, 0);

  const pendingCount = totalCount - completedCount;

  // Active workload card calculation
  const activeCount = relevantDates.reduce((acc, dStr) => {
    const doneIds = completions[dStr] || [];
    const dateTasks = tasks.filter(t => !t.isRecurring && t.date === dStr);
    return acc + dateTasks.filter(t => (t.duration === 'Morning' || t.duration === 'Afternoon') && !doneIds.includes(t.id) && t.selectValue !== 'Done').length;
  }, 0);

  // Delayed count heuristic (e.g. pending work tasks or explicitly set delayed)
  const delayedCount = relevantDates.reduce((acc, dStr) => {
    const doneIds = completions[dStr] || [];
    const dateTasks = tasks.filter(t => !t.isRecurring && t.date === dStr);
    return acc + dateTasks.filter(t => (t.category === 'Review' || t.category === 'Call') && !doneIds.includes(t.id) && t.selectValue !== 'Done').length;
  }, 0);

  // Today specific tasks lists (from selected Date)
  const selectedDayDoneIds = completions[selectedDateStr] || [];
  const selectedDayTasks = tasks
    .filter(t => !t.isRecurring && t.date === selectedDateStr)
    .map(t => ({
      ...t,
      status: (selectedDayDoneIds.includes(t.id) || t.selectValue === 'Done') ? 'Completed' : 'Pending'
    }))
    .sort((a, b) => {
      if (a.priority === 'Frog' && b.priority !== 'Frog') return -1;
      if (a.priority !== 'Frog' && b.priority === 'Frog') return 1;
      return 0;
    });

  // Productivity score calculation
  const productivityScore = selectedDayTasks.length > 0
    ? Math.round((selectedDayTasks.filter(t => t.status === 'Completed').length / selectedDayTasks.length) * 100)
    : 0;

  // Dynamic Heuristic for Focus Minutes based on completed tasks (25 mins per task)
  const focusMins = selectedDayTasks.filter(t => t.status === 'Completed').length * 25;

  // Alert tasks (pending tasks with Frog priority)
  const alertTasks = useMemo(() => {
    // Alert tasks are always today's pending Frog tasks — not date-picker-relative
    const todayStr = formatDateObj(new Date());
    return tasks
      .filter(t =>
        !t.isRecurring &&
        t.date === todayStr &&
        t.priority === 'Frog' &&
        !completions[todayStr]?.includes(t.id) &&
        t.selectValue !== 'Done'
      )
      .slice(0, 3);
  }, [tasks, completions]);

  const todayFrogTasks = useMemo(() => {
    return selectedDayTasks.filter(t => t.priority === 'Frog');
  }, [selectedDayTasks]);

  // Tomorrow preview list
  const tomorrowPreviewTasks = useMemo(() => {
    const tom = new Date(selectedDate);
    tom.setDate(tom.getDate() + 1);
    const tomStr = formatDateObj(tom);
    return tasks.filter(t => !t.isRecurring && t.date === tomStr).slice(0, 4);
  }, [tasks, selectedDate]);

  // 7-Day Performance Chart Data based on selected date
  const weeklyChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(selectedDate);
      d.setDate(selectedDate.getDate() - (6 - i));
      const ds = formatDateObj(d);
      
      const doneIds = completions[ds] || [];
      const dateTasks = tasks.filter(t => !t.isRecurring && t.date === ds);
      const total = dateTasks.length;
      const done = dateTasks.filter(t => doneIds.includes(t.id) || t.selectValue === 'Done').length;
      const score = total > 0 ? Math.round((done / total) * 100) : 0;
      
      return {
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        score: score,
        tasks: done,
        focus: Math.round((done * 25 / 60) * 10) / 10
      };
    });
  }, [tasks, completions, selectedDate]);

  // Average weekly score
  const avgScore = useMemo(() => {
    const total = weeklyChartData.reduce((s, w) => s + w.score, 0);
    return Math.round(total / 7);
  }, [weeklyChartData]);

  // AI Insights suggestions generated in real-time
  const aiSuggestions = useMemo(() => {
    const list = [];
    if (productivityScore < 40) {
      list.push({ type: 'warning', text: '⚡ Low task completion so far. Focus on one high-priority item next.', icon: '⚡' });
    } else if (productivityScore >= 70) {
      list.push({ type: 'success', text: '🎉 Incredible job! Your execution rates are highly optimized.', icon: '🏆' });
    } else {
      list.push({ type: 'info', text: '💡 Work flow is stable. Maintain a steady pace to prevent exhaustion.', icon: '💡' });
    }

    if (currentHealth.water < 4) {
      list.push({ type: 'health', text: '💧 Hydration warning: Drink at least 4 more glasses of water today.', icon: '💧' });
    } else {
      list.push({ type: 'health', text: '🥗 Good hydration levels! Keep feeding your focus reserves.', icon: '🥗' });
    }

    if (focusMins >= 120) {
      list.push({ type: 'focus', text: '🧠 Intense mental focus recorded. Consider a short 10-minute break.', icon: '🧠' });
    } else {
      list.push({ type: 'focus', text: '⏰ Use Focus Mode to chip away at your scheduled Afternoon block.', icon: '⏰' });
    }

    list.push({ type: 'general', text: '📝 Check calendar frequently to keep track of upcoming custom plans.', icon: '📅' });

    return list;
  }, [productivityScore, currentHealth, focusMins]);

  // KPI cards metrics config
  const kpiCards = [
    { label: 'Total Tasks', value: totalCount, icon: ListTodo, bg: 'bg-blue-50 text-blue-600 border-blue-100', text: 'text-blue-700' },
    { label: 'Completed', value: completedCount, icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', text: 'text-emerald-700' },
    { label: 'Pending Tasks', value: pendingCount, icon: Clock, bg: 'bg-amber-50 text-amber-600 border-amber-100', text: 'text-amber-700' },
    { label: 'Delayed Focus', value: delayedCount, icon: AlertTriangle, bg: 'bg-rose-50 text-rose-600 border-rose-100', text: 'text-rose-700' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <FrogLogo className="w-16 h-16 animate-bounce" />
        <div className="text-gray-500 font-bold tracking-wide animate-pulse">Loading Dashboard Metrics from Supabase...</div>
      </div>
    );
  }

  return (
    <div className="p-1.5 sm:p-3 lg:p-4 space-y-3 lg:space-y-4 flex flex-col h-full min-h-0 overflow-y-auto text-left">

      {/* ── Time-Based Greeting Banner ── */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none">{greeting.emoji}</span>
          <div>
            <h2 className="text-base font-extrabold text-white leading-tight">
              {greeting.wish}, {user?.name?.split(' ')[0] || 'Friend'}! <FrogLogo className="w-5 h-5 inline-block ml-1 align-middle" />
            </h2>
            <p className="text-xs text-green-100/80 font-medium mt-0.5">{greeting.sub}</p>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end text-right">
          <span className="text-white/90 text-[11px] font-bold">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <span className="text-green-200/70 text-[10px] font-medium">
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
      
      {/* Date Filter & Switcher Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4 flex-shrink-0 text-left">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          
          {/* Week Calendar Navigation */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navWeek(-1)} 
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors border border-gray-200"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-left">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              {selectedDateStr === getTodayStr() ? (
                <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide">Today</span>
              ) : (
                <button 
                  onClick={() => setSelectedDate(new Date())} 
                  className="text-[9px] text-blue-600 hover:text-blue-800 font-extrabold uppercase tracking-wide hover:underline transition-all block mt-0.5"
                >
                  Back to Today
                </button>
              )}
            </div>
            <button 
              onClick={() => navWeek(1)} 
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors border border-gray-200"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Switcher Option & Date Selector */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            
            {/* Range Switcher */}
            <div className="flex bg-gray-100 rounded-lg p-1 shadow-inner flex-1 md:flex-none">
              {['Today', 'Weekly', 'Monthly'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`flex-1 md:flex-none px-3.5 py-1 text-xs font-bold rounded-md transition-all ${
                    timeRange === range 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Base Date Manual Select */}
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-sm h-[32px]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Base Date:</span>
              <input 
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="bg-transparent border-none text-xs font-bold text-indigo-650 focus:outline-none cursor-pointer" 
              />
            </div>

            {/* Add Task Button */}
            <button
              onClick={handleAddTaskClick}
              className="flex items-center justify-center gap-1.5 px-3.5 py-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition active:scale-95 shadow-sm h-[32px] flex-shrink-0"
            >
              <Plus size={14} />
              <span>Add Task</span>
            </button>

          </div>
        </div>

        {/* Week Quick Nav Bar Grid */}
        <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-gray-100">
          {weekDates.map((d) => {
            const ds = formatDateObj(d);
            const isSelected = ds === selectedDateStr;
            const isCurrentToday = ds === getTodayStr();
            const dayTasksCount = tasks.filter(t => !t.isRecurring && t.date === ds).length;

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(new Date(d))}
                className={`py-2 rounded-xl text-center transition-all border ${
                  isCurrentToday
                    ? isSelected
                      ? 'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-500/20 font-extrabold scale-105 z-10'
                      : 'bg-blue-500 border-blue-500 text-white shadow-sm hover:bg-blue-600 font-bold'
                    : isSelected
                      ? 'bg-sky-100 border-sky-350 text-sky-700 font-bold'
                      : 'bg-sky-50/40 border-sky-100 text-sky-500/80 hover:bg-sky-100/30 hover:border-sky-200'
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-tight opacity-80">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className="text-xs font-extrabold mt-0.5">{d.getDate()}</p>
                {dayTasksCount > 0 && (
                  <div className={`mx-auto mt-1 w-1.5 h-1.5 rounded-full ${isSelected || isCurrentToday ? 'bg-white' : 'bg-sky-500 animate-pulse'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert Section */}
      {alertTasks.length > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 shadow-sm text-left animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
            <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider">Immediate Actions Needed</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {alertTasks.map(task => (
              <div key={task.id} className="bg-white rounded-xl p-3 shadow-sm border border-rose-100 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 mt-1.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 flex items-center gap-1 truncate">
                      <FrogLogo className="w-4 h-4 select-none flex-shrink-0" />
                      <span>{task.description}</span>
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{task.duration} • {getCategoryEmoji(task.category)} {task.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/planner')} 
                  className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors whitespace-nowrap"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${kpi.bg}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
              <span className={`text-[8px] font-extrabold uppercase tracking-widest ${kpi.text}`}>
                {timeRange}
              </span>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-800">{kpi.value}</p>
              <p className="text-[10px] text-gray-450 font-bold uppercase tracking-wider mt-0.5">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Frog Tasks Section */}
      {todayFrogTasks.length > 0 && (
        <div className="bg-emerald-50/40 border border-emerald-250 rounded-2xl p-4.5 space-y-3 shadow-sm text-left animate-in fade-in slide-in-from-top-3 duration-250">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping"></span>
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1"><FrogLogo className="w-3.5 h-3.5" />Frog Tasks for Today ({todayFrogTasks.filter(t => t.status !== 'Completed').length} Pending)</h3>
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold italic bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5 hidden sm:block">
              "Eat a live frog first thing in the morning..."
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayFrogTasks.map((t, idx) => {
              const isCompleted = t.status === 'Completed';
              return (
                <div 
                  key={t.id || idx}
                  className={`border rounded-xl p-3 flex flex-col justify-between shadow-sm relative transition-all text-left ${
                    isCompleted 
                      ? 'bg-emerald-50/30 border-emerald-250 opacity-75 shadow-inner' 
                      : 'bg-white border-emerald-100 hover:border-emerald-350 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase rounded border ${
                        isCompleted 
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-800' 
                          : 'bg-emerald-50 border-emerald-150 text-emerald-700'
                      }`}>
                        {isCompleted ? '✓ Completed' : <span className="flex items-center gap-1"><FrogLogo className="w-3 h-3" />Active Frog</span>}
                      </span>
                      <span className="text-[9px] text-gray-500 font-semibold uppercase">
                        ⏰ {t.duration}
                      </span>
                    </div>
                    <h4 className={`text-xs md:text-sm font-bold text-gray-800 leading-snug flex items-start gap-1.5 ${isCompleted ? 'line-through text-gray-400 font-medium' : ''}`}>
                      <FrogLogo className="w-4 h-4 select-none flex-shrink-0" />
                      <span>{t.description}</span>
                    </h4>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-100 pt-2 mt-3">
                    <span className="text-[9px] text-indigo-650 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                      {getCategoryEmoji(t.category)} {t.category}
                    </span>
                    <button 
                      onClick={() => handleToggleTaskStatus(t.id)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all shadow-sm flex items-center gap-1 ${
                        isCompleted
                          ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white'
                          : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                      }`}
                    >
                      {isCompleted ? 'Undo' : <span className="flex items-center gap-1"><FrogLogo className="w-3.5 h-3.5" />Eat Frog</span>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-shrink-0">
        
        {/* Left Section - Productivity, Focus, and Weekly Charts */}
        <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
          
          {/* Productivity Gauge & Focus Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Productivity Circle Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-5 shadow-sm text-left">
              <ProgressCircle
                value={productivityScore}
                size={85}
                strokeWidth={7}
                color={productivityScore >= 70 ? '#10B981' : productivityScore >= 40 ? '#F59E0B' : '#EF4444'}
                label="Productive"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">Performance</span>
                </div>
                <p className="text-xs font-semibold text-gray-500">
                  {productivityScore >= 70 ? 'Excellent Focus' : productivityScore >= 40 ? 'Moderate Output' : 'Attention Needed'}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">7-Day average is: {avgScore}%</p>
              </div>
            </div>

            {/* Focus hours card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center border border-purple-100">
                  <Brain className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mind Focus Time</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <p className="text-xl font-extrabold text-gray-800">{Math.round((focusMins / 60) * 10) / 10}h</p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Focus Duration</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-gray-800">
                    {selectedDayTasks.filter(t => t.status === 'Completed').length}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Done Items</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((focusMins / 240) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 font-semibold mt-1">
                  <span>{Math.round(focusMins / 240 * 100)}% of 4h daily target</span>
                  <span>Goal: 4.0h</span>
                </div>
              </div>
            </div>

          </div>

          {/* Weekly Performance Recharts Chart */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Weekly Productivity Rate</h3>
                <p className="text-[10px] text-gray-400">Task completion percentage chart for past 7 days</p>
              </div>
              <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">
                Avg: {avgScore}%
              </span>
            </div>
            <ProductivityChart data={weeklyChartData} />
          </div>

          {/* Today's Tasks list */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex-1 flex flex-col justify-between text-left">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Scheduled Tasks List</h3>
                <p className="text-[10px] text-gray-400">Pending tasks scheduled for the active date</p>
              </div>
              <button 
                onClick={() => navigate('/planner')}
                className="text-[10px] font-bold text-indigo-600 hover:underline"
              >
                Open Planner →
              </button>
            </div>
            
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 flex-1">
              {selectedDayTasks.filter(t => t.status !== 'Completed').length > 0 ? (
                selectedDayTasks.filter(t => t.status !== 'Completed').map((task, idx) => (
                  <div 
                    key={task.id || idx}
                    className="flex items-center justify-between p-2.5 border border-gray-150 bg-gray-50/20 rounded-xl hover:bg-white transition-all shadow-sm text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-8 bg-indigo-500 rounded-full flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 flex items-center gap-1 truncate">
                          {task.priority === 'Frog' && <FrogLogo className="w-4 h-4 select-none flex-shrink-0" />}
                          <span>{task.description}</span>
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">⏰ {task.duration} • {getCategoryEmoji(task.category)} {task.category}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400 text-xs font-semibold flex flex-col items-center justify-center gap-2">
                  <Target size={24} className="text-gray-300" />
                  No pending tasks planned for {selectedDateStr}.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Section - Health Today, AI suggestions and Tomorrow preview */}
        <div className="space-y-6 flex flex-col justify-between">
          
          {/* Health Today Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Health Today</h3>
              <span className="text-[9px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-150">
                Water Target: {currentHealth.goal} glasses
              </span>
            </div>

            {/* Meals Status */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'breakfast', label: 'Breakfast', icon: Coffee, time: '8:00 AM' },
                { key: 'lunch', label: 'Lunch', icon: UtensilsCrossed, time: '1:30 PM' },
                { key: 'dinner', label: 'Dinner', icon: Moon, time: '8:30 PM' },
              ].map((meal) => {
                const isChecked = currentHealth[meal.key];
                return (
                  <button
                    key={meal.key}
                    onClick={() => toggleMeal(meal.key)}
                    className={`p-2.5 rounded-xl border text-center transition-all duration-100 active:scale-95 ${
                      isChecked 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-gray-50 border-gray-150 text-gray-550 hover:bg-gray-100'
                    }`}
                  >
                    <meal.icon className={`w-4 h-4 mx-auto mb-1 ${isChecked ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <p className="text-[9px] font-extrabold uppercase tracking-tight">{meal.label}</p>
                    <p className="text-[8px] opacity-80 mt-0.5">{isChecked ? '✓ Eaten' : meal.time}</p>
                  </button>
                );
              })}
            </div>

            {/* Water Tracker */}
            <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-cyan-800">
                  <Droplets className="w-4 h-4 text-cyan-600 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-tight">Water Intake</span>
                </div>
                <span className="text-xs font-extrabold text-cyan-700">{currentHealth.water}/{currentHealth.goal} glass</span>
              </div>
              
              <div className="h-2 bg-cyan-200 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((currentHealth.water / currentHealth.goal) * 100, 100)}%` }}
                />
              </div>

              {/* Water grid clicks */}
              <div className="flex gap-1.5">
                {Array.from({ length: currentHealth.goal }).map((_, i) => (
                  <button
                    key={i}
                    onClick={addWater}
                    className={`flex-1 h-4 rounded-sm transition-all duration-100 active:scale-95 border ${
                      i < currentHealth.water 
                        ? 'bg-cyan-500 border-cyan-600 shadow-sm' 
                        : 'bg-cyan-100 border-cyan-200 hover:bg-cyan-200'
                    }`}
                    title="Click to add 1 glass"
                  />
                ))}
              </div>
            </div>

            {/* Mood Tracker */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Smile className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Mood Indicator</span>
              </div>
              <div className="flex justify-between bg-gray-50 border border-gray-150 rounded-xl p-2">
                {['😊 Happy', '😐 Neutral', '💤 Tired', '😔 Sad'].map(mood => (
                  <button
                    key={mood}
                    onClick={() => setMood(mood)}
                    className={`flex-1 py-1 text-[10px] font-bold rounded transition-all duration-100 active:scale-95 ${
                      currentHealth.mood === mood 
                        ? 'bg-white text-amber-600 shadow-sm border border-amber-100' 
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* AI Insight Suggestions Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left space-y-3.5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">AI Insights & Suggest</h3>
                <p className="text-[9px] text-gray-400">Contextual daily wellness alerts</p>
              </div>
            </div>

            <div className="space-y-2">
              {aiSuggestions.map((s, idx) => (
                <div 
                  key={idx}
                  className={`p-2.5 rounded-xl text-xs leading-relaxed border font-medium ${
                    s.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                    s.type === 'warning' ? 'bg-rose-50 border-rose-100 text-rose-700 animate-pulse' :
                    s.type === 'health' ? 'bg-cyan-50 border-cyan-100 text-cyan-700' :
                    s.type === 'focus' ? 'bg-purple-50 border-purple-100 text-purple-700' :
                    'bg-indigo-50 border-indigo-100 text-indigo-700'
                  }`}
                >
                  <span className="mr-1">{s.icon}</span> {s.text}
                </div>
              ))}
            </div>
          </div>

          {/* Tomorrow Preview Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">Tomorrow's Schedule Preview</h3>
            
            <div className="space-y-2">
              {tomorrowPreviewTasks.length > 0 ? (
                tomorrowPreviewTasks.map((t, idx) => (
                  <div key={t.id || idx} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50 border border-gray-100 text-left">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 flex items-center gap-1 truncate">
                        {t.priority === 'Frog' && <FrogLogo className="w-4 h-4 select-none flex-shrink-0" />}
                        <span>{t.description}</span>
                      </p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">⏰ {t.duration} • {getCategoryEmoji(t.category)} {t.category}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No tasks planned for tomorrow yet.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* COMPLETE TASK LIST DETAILS PANEL (inline complete show by default at bottom) */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-gray-100 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <CheckSquare size={16} />
            </span>
            <div className="text-left">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Complete Tasks List Details</h3>
              <p className="text-[10px] text-gray-400">Detailed overview of scheduled tasks and completion statuses for selected timeframe</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 self-start sm:self-auto">
            {timeRange === 'Today' ? `Date: ${selectedDateStr}` : `Range: ${relevantDates[relevantDates.length - 1]} to ${relevantDates[0]}`}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[350px] overflow-y-auto border border-gray-150 rounded-lg shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 font-bold text-gray-500 uppercase tracking-tight text-[10px] bg-gray-50">Date</th>
                <th className="px-4 py-2.5 font-bold text-gray-500 uppercase tracking-tight text-[10px] bg-gray-50">Time</th>
                <th className="px-4 py-2.5 font-bold text-gray-500 uppercase tracking-tight text-[10px] bg-gray-50">Description</th>
                <th className="px-4 py-2.5 font-bold text-gray-500 uppercase tracking-tight text-[10px] bg-gray-50">Category</th>
                <th className="px-4 py-2.5 font-bold text-gray-500 uppercase tracking-tight text-[10px] bg-gray-50">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 bg-white">
              {relevantDates.map(dStr => {
                const dateCompletedIds = completions[dStr] || [];
                const dateTasks = tasks
                  .filter(t => !t.isRecurring && t.date === dStr)
                  .sort((a, b) => {
                    if (a.priority === 'Frog' && b.priority !== 'Frog') return -1;
                    if (a.priority !== 'Frog' && b.priority === 'Frog') return 1;
                    return 0;
                  });
                
                if (dateTasks.length === 0) return null;
                
                return dateTasks.map((t, idx) => {
                  const isDone = dateCompletedIds.includes(t.id) || t.selectValue === 'Done';
                  return (
                    <tr key={`${dStr}-${t.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 font-bold">
                        {dStr}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-bold">
                        {t.duration}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-bold text-left">
                        <div className="flex items-center gap-1.5">
                          {t.priority === 'Frog' && (
                            <FrogLogo className="w-5 h-5 select-none" title="Frog Task" />
                          )}
                          <span>{t.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-left">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 font-extrabold text-[9px] uppercase">
                          {getCategoryEmoji(t.category)} {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-left">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border ${
                          isDone 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : 'bg-amber-50 border-amber-100 text-amber-700'
                        }`}>
                          {isDone ? '✅ Completed' : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DYNAMIC POPUP MODAL FORM FOR NEW TASKS */}
      <ModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Task(s)"
        onSubmit={handleSubmit}
        submitText="Save Schedule"
        loading={modalLoading}
      >
        <div className="space-y-4 text-left">
          
          {/* Select the date */}
          <div className="space-y-1">
            <label className="block text-[10px] md:text-[11px] text-gray-650 font-bold uppercase tracking-wider">Select the date *</label>
            <input 
              type="date"
              required 
              value={formData.date} 
              onChange={(e) => setFormData({...formData, date: e.target.value})} 
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px] bg-white" 
            />
          </div>

          {/* Dynamic Task List Items - Multi-field Rows */}
          <div className="space-y-3.5 border-t border-gray-150 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Task Item Rows</h4>
                <p className="text-[9px] text-gray-405">Configure duration, category, priority, and description for each task item</p>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition active:scale-95 flex items-center gap-1 shadow-sm"
              >
                <Plus size={12} /> Add Task Row
              </button>
            </div>

            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {tasksList.map((row, idx) => (
                <div key={idx} className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 relative space-y-2.5 text-left">
                  
                  <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
                      Task Item #{idx + 1}
                    </span>
                    
                    {tasksList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="text-red-500 hover:text-red-750 hover:bg-rose-50 p-1 rounded-md transition"
                        title="Remove task row"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Task Description Field */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Task Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="What needs to be done?"
                      value={row.description}
                      onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[32px] bg-white font-medium shadow-sm"
                    />
                  </div>

                  {/* Grid Fields: Duration, Category, Priority */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Time Select */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Time *</label>
                      <select
                        required
                        value={row.duration}
                        onChange={(e) => handleFieldChange(idx, 'duration', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
                      >
                        {durationOptions.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category Select / Add */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Category *</label>
                      {row.isCreatingCategory ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            placeholder="New category..."
                            value={row.newCategoryText || ''}
                            onChange={(e) => handleFieldChange(idx, 'newCategoryText', e.target.value)}
                            className="w-full border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] h-[32px] bg-white font-medium"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCategoryInline(idx);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCategoryInline(idx)}
                            className="h-[32px] w-[30px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shrink-0"
                            title="Confirm"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFieldChange(idx, 'isCreatingCategory', false)}
                            className="h-[32px] w-[30px] flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-600 rounded text-[11px] shrink-0"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select
                          required
                          value={row.category}
                          onChange={(e) => handleCategorySelectChange(idx, e.target.value)}
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
                        >
                          {customCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value="__NEW__">+ New Category...</option>
                        </select>
                      )}
                    </div>

                    {/* Frog Toggle */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-555 uppercase tracking-wide">Frog Task?</label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(idx, 'priority', row.priority === 'Frog' ? '' : 'Frog')}
                        className={`w-full border rounded text-[10px] md:text-[11px] h-[32px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm ${
                          row.priority === 'Frog'
                            ? 'bg-emerald-50 border-emerald-355 text-emerald-700 font-extrabold'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {row.priority === 'Frog' ? <><FrogLogo className="w-3.5 h-3.5 inline-block mr-1" />Frog!</> : <><FrogLogo className="w-3.5 h-3.5 inline-block mr-1" />Mark Frog</>}
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

        </div>
      </ModalForm>

      <ModalAlert 
        {...alertConfig} 
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} 
      />

    </div>
  );
}
