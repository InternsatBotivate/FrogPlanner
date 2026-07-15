/**
 * aiService.js — FrogPlanner AI Assistant (web)
 * ──────────────────────────────────────────────────────────────────────────
 * Talks to the shared serverless proxy (api/ai-chat.js) which holds the
 * Cerebras key server-side and runs the gpt-oss-120b model. The browser never
 * sees the key — it authenticates each call with the user's session token.
 *
 * The tool-calling loop runs here in the browser: the model decides which tool
 * to call, we execute it against the user's own planner/projects, feed the
 * result back, and repeat until the model produces a final answer.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { createProjectTask, fetchProjects } from './projectService';
import { usePlannerStore } from '../store/plannerStore';

// Same-origin by default (web app + proxy are one Vercel deployment). Override
// with VITE_AI_PROXY_URL only if the proxy lives elsewhere.
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || '/api/ai-chat';
const SESSION_KEY = 'fp_session_token';

const DURATIONS = ['Morning', 'Afternoon', 'Evening', 'Night', 'All Day'];

export function isAiConfigured() {
  return true; // proxy is same-origin; availability is checked at request time
}

const jsonObject = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const stringEnum = (values) => ({ type: 'string', enum: values });

export const ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'List the user’s tasks. Optional date or range filter.',
      parameters: jsonObject({
        date: { type: 'string', description: 'YYYY-MM-DD date filter.' },
        range: { type: 'string', enum: ['today', 'tomorrow', 'week', 'all'] },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create one task.',
      parameters: jsonObject(
        {
          description: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD date.' },
          duration: stringEnum(DURATIONS),
          category: { type: 'string' },
          isFrog: { type: 'boolean' },
        },
        ['description'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task complete.',
      parameters: jsonObject(
        { taskId: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD completion date.' } },
        ['taskId', 'date'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update one field of a task.',
      parameters: jsonObject(
        {
          taskId: { type: 'string' },
          field: { type: 'string', enum: ['description', 'duration', 'category', 'priority', 'date', 'remarks'] },
          value: { type: ['string', 'null'] },
        },
        ['taskId', 'field', 'value'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task. Only after the user explicitly confirmed.',
      parameters: jsonObject({ taskId: { type: 'string' } }, ['taskId']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_projects',
      description: 'List projects for this user.',
      parameters: jsonObject({}),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_project_task',
      description: 'Add a checklist item to a project.',
      parameters: jsonObject(
        { projectId: { type: 'number' }, description: { type: 'string' } },
        ['projectId', 'description'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_summary',
      description: "Summarize today's planner totals.",
      parameters: jsonObject({ date: { type: 'string', description: 'YYYY-MM-DD date.' } }),
    },
  },
];

const formatDateStr = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const defaultDate = () => formatDateStr(new Date());

function rangeBounds(range) {
  const today = new Date();
  if (range === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const date = formatDateStr(tomorrow);
    return { start: date, end: date };
  }
  if (range === 'week') {
    const day = today.getDay() || 7; // Mon=1..Sun=7
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: formatDateStr(monday), end: formatDateStr(sunday) };
  }
  if (range === 'all') return null;
  const date = defaultDate();
  return { start: date, end: date };
}

function parseArgs(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function serializeTask(task, date) {
  return {
    id: task.id,
    description: task.description,
    duration: task.duration,
    category: task.category,
    priority: task.priority,
    date: task.date || date,
    done: task.selectValue === 'Done',
    remarks: task.remarks,
  };
}

async function ensurePlannerData(userId) {
  const store = usePlannerStore.getState();
  if (!store.hasLoaded || store.loadedUserId !== userId) {
    await store.fetchPlannerData(userId);
  }
  return usePlannerStore.getState();
}

async function executeTool(userId, toolName, rawArgs) {
  const args = parseArgs(rawArgs);
  const store = await ensurePlannerData(userId);

  switch (toolName) {
    case 'get_tasks': {
      const explicitDate = typeof args.date === 'string' ? args.date : null;
      const bounds = explicitDate ? { start: explicitDate, end: explicitDate } : rangeBounds(args.range);
      const tasks = bounds
        ? store.tasks.filter((t) => t.date && t.date >= bounds.start && t.date <= bounds.end)
        : store.tasks;
      return { tasks: tasks.map((t) => serializeTask(t, explicitDate || undefined)) };
    }
    case 'create_task': {
      const description = typeof args.description === 'string' ? args.description.trim() : '';
      if (!description) throw new Error('Task description is required.');
      const payload = {
        description,
        date: typeof args.date === 'string' ? args.date : defaultDate(),
        duration: typeof args.duration === 'string' && DURATIONS.includes(args.duration) ? args.duration : 'Morning',
        category: typeof args.category === 'string' && args.category.trim() ? args.category.trim() : 'Work',
        priority: args.isFrog ? 'Frog' : '',
        selectValue: 'Select',
        remarks: '',
      };
      const created = await usePlannerStore.getState().addPlannerTasks(userId, [payload]);
      return { created: (created || []).map((t) => serializeTask(t)) };
    }
    case 'complete_task': {
      const taskId = typeof args.taskId === 'string' ? args.taskId : '';
      const date = typeof args.date === 'string' ? args.date : defaultDate();
      if (!taskId) throw new Error('taskId is required.');
      const ok = await usePlannerStore.getState().toggleCompletion(userId, taskId, date, true);
      return { success: ok };
    }
    case 'update_task': {
      const taskId = typeof args.taskId === 'string' ? args.taskId : '';
      const field = typeof args.field === 'string' ? args.field : '';
      if (!taskId || !field) throw new Error('taskId and field are required.');
      const current = usePlannerStore.getState().tasks.find((t) => t.id === taskId);
      if (!current) throw new Error('Task not found.');
      const allowed = ['description', 'duration', 'category', 'priority', 'date', 'remarks'];
      if (!allowed.includes(field)) throw new Error('Unsupported task field.');
      const payload = {
        description: field === 'description' && typeof args.value === 'string' ? args.value : current.description,
        duration: field === 'duration' && typeof args.value === 'string' ? args.value : current.duration,
        category: field === 'category' && typeof args.value === 'string' ? args.value : current.category,
        priority: field === 'priority' && typeof args.value === 'string' ? args.value : current.priority,
        date: field === 'date' && typeof args.value === 'string' ? args.value : current.date,
        remarks: field === 'remarks' && typeof args.value === 'string' ? args.value : current.remarks,
        isRecurring: current.isRecurring,
      };
      const updated = await usePlannerStore.getState().updateTask(taskId, payload);
      return { updated: updated ? serializeTask(updated) : { id: taskId, ...payload } };
    }
    case 'delete_task': {
      const taskId = typeof args.taskId === 'string' ? args.taskId : '';
      if (!taskId) throw new Error('taskId is required.');
      const ok = await usePlannerStore.getState().deleteTask(taskId);
      return { success: ok };
    }
    case 'get_projects': {
      return { projects: await fetchProjects(userId) };
    }
    case 'add_project_task': {
      const projectId = typeof args.projectId === 'number' ? args.projectId : Number(args.projectId);
      const description = typeof args.description === 'string' ? args.description.trim() : '';
      if (!projectId || !description) throw new Error('projectId and description are required.');
      return { task: await createProjectTask(projectId, description) };
    }
    case 'get_daily_summary': {
      const date = typeof args.date === 'string' ? args.date : defaultDate();
      const dayTasks = store.tasks.filter((t) => !t.isRecurring && t.date === date);
      const completed = store.completions[date] || [];
      return {
        date,
        total: dayTasks.length,
        completed: dayTasks.filter((t) => completed.includes(t.id) || t.selectValue === 'Done').length,
        pending: dayTasks.filter((t) => !completed.includes(t.id) && t.selectValue !== 'Done').length,
        frogs: dayTasks.filter(
          (t) => t.priority === 'Frog' && !completed.includes(t.id) && t.selectValue !== 'Done',
        ).length,
      };
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Compact system prompt — kept short to reduce tokens per request (Cerebras has
// a tokens-per-minute limit and this loops for tool calls). Still tenant-aware.
function buildSystemPrompt(user) {
  const firstName = (user.full_name || user.username || 'there').split(' ')[0];
  const categories = user.custom_categories?.length
    ? user.custom_categories.join(', ')
    : 'Work, Meeting, Call, Personal, Review, Break, Health';
  const role = user.user_role || user.role || 'USER';
  const org = user.business_name ? ` (${user.business_name})` : '';

  return [
    'You are Frog Assistant inside FrogPlanner, a daily planner by Botivate whose motto is ' +
      '"Eat the Frog" — do your most important task first. Features: Planner, Next-Day Planner, ' +
      'All Tasks, Recurring Tasks, Projects, Calendar (Google sync), health tracking. Tasks have a ' +
      'time slot, a category, and can be flagged a "Frog" (top priority).',
    `User: ${firstName}, role ${role}${org}. Today: ${defaultDate()}.`,
    `Time slots: ${DURATIONS.join(', ')}. Categories: ${categories}.`,
    'Use the tools to read/create/update/complete/delete THIS user’s tasks and projects, and to ' +
      'summarize their day. You can only access this user’s own data. Keep replies short and friendly. ' +
      'Use YYYY-MM-DD for dates. Prefer exact task IDs from get_tasks. Ask for confirmation before ' +
      'deleting unless the user already clearly confirmed.',
  ].join('\n');
}

// Only send recent turns to the model to keep requests small.
const MAX_HISTORY = 8;

async function chatCompletion(messages) {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) throw new Error('Please sign in again to use the AI Assistant.');

  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, tools: ASSISTANT_TOOLS, tool_choice: 'auto' }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      (response.status === 401 ? 'Please sign in again to use the AI Assistant.' : `AI request failed (${response.status}).`);
    throw new Error(message);
  }
  return json;
}

/**
 * runAssistant — drive the model + tool loop and return the final text.
 * @param {{ user: object, messages: {role: string, content: string}[] }} args
 */
export async function runAssistant({ user, messages }) {
  const loopMessages = [{ role: 'system', content: buildSystemPrompt(user) }, ...messages.slice(-MAX_HISTORY)];

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const completion = await chatCompletion(loopMessages);
    const assistant = completion?.choices?.[0]?.message;
    if (!assistant) throw new Error('AI returned an empty response.');
    loopMessages.push(assistant);

    if (!assistant.tool_calls?.length) {
      return assistant.content || 'Done.';
    }

    for (const call of assistant.tool_calls) {
      try {
        const result = await executeTool(user.id, call.function.name, call.function.arguments);
        loopMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      } catch (error) {
        loopMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool failed.' }),
        });
      }
    }
  }

  return 'I hit my tool-use limit for this request. Try asking in a smaller step.';
}
