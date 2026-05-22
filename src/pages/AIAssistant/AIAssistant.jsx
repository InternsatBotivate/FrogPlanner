import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, User, Bot, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePlannerStore } from '../../store/plannerStore';

export default function AIAssistant() {
  const { user } = useAuthStore();
  const { tasks, completions, addPlannerTasks } = usePlannerStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  // Initialize bot with a welcoming message and a dummy scheduling tutorial flow
  useEffect(() => {
    if (user) {
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: `Hello ${user.full_name || user.username}! 👋 I am your Frog Planner AI Assistant. I can help you analyze your tasks, track your completions, and review your daily schedule. Ask me anything about your planner!`,
          timestamp: new Date(Date.now() - 60000 * 5)
        },
        {
          id: 'demo-user',
          sender: 'user',
          text: 'schedule Client Review at Afternoon under Work',
          timestamp: new Date(Date.now() - 60000 * 4)
        },
        {
          id: 'demo-bot',
          sender: 'bot',
          text: `Sure! I have scheduled that task for you. 📅\n\n- **Task Details**: "Client Review"\n- **Time**: Afternoon\n- **Category**: Work\n\nIt has been successfully added to your planner database!`,
          timestamp: new Date(Date.now() - 60000 * 3)
        }
      ]);
    }
  }, [user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    // Add user message
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');

    // Simulate AI thinking and reply asynchronously
    const replyText = await generateBotReply(query);
    const botMsg = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: replyText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMsg]);
  };

  // Rule-based NLP processor based on real Supabase data
  const generateBotReply = async (query) => {
    if (!user?.id) return "Please log in to use the AI Assistant.";
    const cleanQuery = query.toLowerCase();
    
    // Read cached state directly from the outer lexical scope of usePlannerStore
    
    // Get today's date formatted local
    const yyyy = new Date().getFullYear();
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    const dd = String(new Date().getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const todayCompletedIds = completions[todayStr] || [];

    // 1. DYNAMIC TASK CREATION / SCHEDULING COMMANDS
    if (cleanQuery.includes('schedule') || cleanQuery.includes('add ') || cleanQuery.includes('create ') || cleanQuery.includes('plan ')) {
      // Parse duration
      let duration = 'Morning';
      if (cleanQuery.includes('morning')) duration = 'Morning';
      else if (cleanQuery.includes('afternoon')) duration = 'Afternoon';
      else if (cleanQuery.includes('evening')) duration = 'Evening';
      else if (cleanQuery.includes('night')) duration = 'Night';

      // Parse category
      let category = 'Work';
      const categories = ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
      for (const cat of categories) {
        if (cleanQuery.includes(cat.toLowerCase())) {
          category = cat;
          break;
        }
      }

      // Extract description text
      let desc = query
        .replace(/schedule/gi, '')
        .replace(/add/gi, '')
        .replace(/create/gi, '')
        .replace(/task/gi, '')
        .replace(/plan/gi, '')
        .replace(/at/gi, '')
        .replace(/in/gi, '')
        .replace(/to/gi, '')
        .replace(/for/gi, '')
        .replace(/under/gi, '')
        .replace(/category/gi, '')
        .replace(/morning/gi, '')
        .replace(/afternoon/gi, '')
        .replace(/evening/gi, '')
        .replace(/night/gi, '')
        .trim();

      // Clean up leading dashes or special chars
      desc = desc.replace(/^[^a-zA-Z0-9]+/, '').trim();

      if (desc.length > 2) {
        desc = desc.charAt(0).toUpperCase() + desc.slice(1);
        const newTask = {
          description: desc,
          duration: duration,
          category: category,
          priority: 'High',
          date: todayStr,
          selectValue: 'Select',
          remarks: ''
        };

        const createdTasks = await addPlannerTasks(user.id, [newTask]);

        if (createdTasks && createdTasks.length > 0) {
          return `Sure! I have scheduled that task for you. 📅\n\n- **Task Details**: "${desc}"\n- **Time**: ${duration}\n- **Category**: ${category}\n\nIt is now successfully added to your planner schedule database! You will see it listed on the Index page and across all days on the Planner.`;
        } else {
          return `Sorry, I encountered an issue adding that task to Supabase. Please try again.`;
        }
      }
    }

    // 2. HELP / GREETINGS
    if (cleanQuery.includes('hello') || cleanQuery.includes('hi ') || cleanQuery.includes('hey') || cleanQuery.includes('greet')) {
      return `Hi there! I am connected to your planner database. You can ask me questions like:\n- "Show my morning tasks"\n- "What is pending today?"\n- "Have I completed breakfast?"\n- "List all work tasks"\n\nOr schedule one: *"schedule Team Meeting at Afternoon under Work"*`;
    }

    if (cleanQuery.includes('help') || cleanQuery.includes('what can you do')) {
      return `I can analyze your planner data in real time! Try asking:\n1. "List my tasks"\n2. "What tasks are pending?"\n3. "Show afternoon tasks"\n4. "Check status of standup"\n5. "schedule Gym workout at Evening"`;
    }

    // 3. BREAKFAST / LUNCH / DINNER STATUS
    if (cleanQuery.includes('breakfast')) {
      const t = tasks.find(x => x.description.toLowerCase().includes('breakfast'));
      if (t) {
        const isDone = todayCompletedIds.includes(t.id);
        return `Your breakfast task is scheduled for the **Morning** under the **${t.category}** category. Status for today: **${isDone ? 'Completed ✅' : 'Pending ⏳'}**.`;
      }
    }

    if (cleanQuery.includes('lunch')) {
      const t = tasks.find(x => x.description.toLowerCase().includes('lunch'));
      if (t) {
        const isDone = todayCompletedIds.includes(t.id);
        return `Your lunch break is scheduled for the **Afternoon** (${t.category}). Status for today: **${isDone ? 'Completed ✅' : 'Pending ⏳'}**.`;
      }
    }

    if (cleanQuery.includes('dinner')) {
      const t = tasks.find(x => x.description.toLowerCase().includes('dinner'));
      if (t) {
        const isDone = todayCompletedIds.includes(t.id);
        return `Dinner is scheduled for the **Evening** (${t.category}). Status for today: **${isDone ? 'Completed ✅' : 'Pending ⏳'}**.`;
      }
    }

    // 4. TASKS BY TIMING / DURATION
    if (cleanQuery.includes('morning')) {
      const morningTasks = tasks.filter(t => t.duration === 'Morning');
      if (morningTasks.length === 0) return "You have no tasks scheduled for the morning.";
      return `Here are your **Morning** tasks:\n` + morningTasks.map((t, i) => `${i + 1}. **${t.description}** [${t.category}]`).join('\n');
    }

    if (cleanQuery.includes('afternoon')) {
      const afternoonTasks = tasks.filter(t => t.duration === 'Afternoon');
      if (afternoonTasks.length === 0) return "You have no tasks scheduled for the afternoon.";
      return `Here are your **Afternoon** tasks:\n` + afternoonTasks.map((t, i) => `${i + 1}. **${t.description}** [${t.category}]`).join('\n');
    }

    if (cleanQuery.includes('evening')) {
      const eveningTasks = tasks.filter(t => t.duration === 'Evening');
      if (eveningTasks.length === 0) return "You have no tasks scheduled for the evening.";
      return `Here are your **Evening** tasks:\n` + eveningTasks.map((t, i) => `${i + 1}. **${t.description}** [${t.category}]`).join('\n');
    }

    if (cleanQuery.includes('night')) {
      const nightTasks = tasks.filter(t => t.duration === 'Night');
      if (nightTasks.length === 0) return "You have no tasks scheduled for the night.";
      return `Here are your **Night** tasks:\n` + nightTasks.map((t, i) => `${i + 1}. **${t.description}** [${t.category}]`).join('\n');
    }

    // 5. GENERAL TASK LISTS & STATS
    if (cleanQuery.includes('pending') || cleanQuery.includes('status') || cleanQuery.includes('today')) {
      const pendingTasks = tasks.filter(t => !todayCompletedIds.includes(t.id));
      if (pendingTasks.length === 0) {
        return "Congratulations! You have completed all of your tasks for today! 🎉";
      }
      return `You have **${pendingTasks.length} pending tasks** left for today:\n` + pendingTasks.map((t, i) => `${i + 1}. **${t.description}** (${t.duration})`).join('\n');
    }

    if (cleanQuery.includes('complete') || cleanQuery.includes('done')) {
      const completedTasks = tasks.filter(t => todayCompletedIds.includes(t.id));
      if (completedTasks.length === 0) {
        return "You haven't marked any tasks as completed today yet. You can mark them done on the Planner page! ⏳";
      }
      return `Here are the **${completedTasks.length} tasks** you completed today:\n` + completedTasks.map((t, i) => `${i + 1}. **${t.description}** ✅`).join('\n');
    }

    if (cleanQuery.includes('task') || cleanQuery.includes('list') || cleanQuery.includes('show')) {
      if (tasks.length === 0) return "Your task database is empty. You can add tasks on the Index page!";
      return `You currently have **${tasks.length} total tasks** in your master schedule:\n` + tasks.map((t, i) => `${i + 1}. **${t.description}** (${t.duration})`).join('\n');
    }

    // 6. SEARCH BY CUSTOM QUERY / KEYWORD
    const matched = tasks.filter(t => t.description.toLowerCase().includes(cleanQuery) || t.category.toLowerCase().includes(cleanQuery));
    if (matched.length > 0) {
      return `I found **${matched.length} matching task(s)** in your schedule:\n` + matched.map((t, i) => `${i + 1}. **${t.description}** - Scheduled for **${t.duration}** under **${t.category}**`).join('\n');
    }

    // Fallback response
    return `I am not sure I understand "${query}". I can help you search your planner tasks, check morning/afternoon schedules, or list pending items. Try typing "help" to see what I can do!`;
  };

  const quickPrompts = [
    "What is pending today?",
    "Show my morning tasks",
    "List all tasks",
    "schedule Coffee Break at Afternoon under Personal",
    "schedule Quick Sync at Morning under Meeting"
  ];

  return (
    <div className="p-0 sm:p-2 md:p-6 flex flex-col h-full min-h-0">
      
      {/* Container wrapping the Chat view */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-800 uppercase tracking-tight">AI Planner Assistant</h2>
              <p className="text-[10px] text-gray-400">Powered by Frog Planner Local Knowledge Base</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (user) {
                setMessages([
                  {
                    id: 'welcome',
                    sender: 'bot',
                    text: `Chat refreshed! How can I help you with your daily schedule today, ${user.name}?`,
                    timestamp: new Date()
                  }
                ]);
              }
            }}
            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
            title="Clear Chat History"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Chat Messages Panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-bold text-xs' 
                  : 'bg-white border-gray-200 text-gray-600'
              }`}>
                {msg.sender === 'user' ? (user?.name?.charAt(0).toUpperCase() || 'U') : <Bot size={16} className="text-indigo-600" />}
              </div>

              {/* Message Content Bubble */}
              <div className={`rounded-xl p-3 text-xs md:text-sm border shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-indigo-600 border-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white border-gray-200 text-gray-700 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                <span className={`block text-[8px] mt-1 text-right ${
                  msg.sender === 'user' ? 'text-indigo-200' : 'text-gray-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts Panel */}
        <div className="p-3 border-t border-gray-150 bg-white flex flex-wrap gap-2">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              className="px-3 py-1 border border-indigo-100 bg-indigo-50/30 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-full text-[10px] md:text-xs font-semibold transition active:scale-95 shadow-sm"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Text Form */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="p-3 border-t border-gray-200 bg-white flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI Assistant about your tasks..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-xs md:text-sm shadow-inner bg-gray-50/50"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition active:scale-95 shadow-sm flex items-center justify-center flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </form>

      </div>

    </div>
  );
}
