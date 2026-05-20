// Storage Manager - Handle all localStorage operations

const STORAGE_KEYS = {
  USERS: 'pcb_users',
  SETTINGS: 'pcb_settings',
  VENDORS: 'pcb_vendors_v3',
  COMPANIES: 'pcb_companies_v3',
  ITEMS: 'pcb_items_v3',
  GROUP_HEADS: 'pcb_group_heads_v3',
  UOMS: 'pcb_uoms_v3',
  DEPARTMENTS: 'pcb_departments_v3',
  TERMS_CONDITIONS: 'pcb_terms_conditions_v1',
  EQUIPMENTS: 'pcb_equipments_v1',
  TASKS: 'pcb_tasks_v3',
};

const DEFAULT_USERS = [
  { 
    id: 'admin', 
    name: 'Admin User', 
    password: 'admin123', 
    role: 'ADMIN', 
    accessPages: [],
    email: 'admin@company.com',
    phone: '+91 98765 43210',
    designation: 'Specialist / Chief Architect',
    department: 'General Division',
    bio: 'Oversees day-to-day operations, task management, and system configuration.'
  },
  { 
    id: 'user', 
    name: 'Employee 1', 
    password: 'user123', 
    role: 'USER', 
    accessPages: [],
    email: 'employee1@company.com',
    phone: '+91 98765 43211',
    designation: 'Frontend Engineer',
    department: 'Engineering Division',
    bio: 'Responsible for building robust user interfaces and maintaining standard web systems.'
  },
  { 
    id: 'user2', 
    name: 'Employee 2', 
    password: 'user123', 
    role: 'USER', 
    accessPages: [],
    email: 'employee2@company.com',
    phone: '+91 98765 43212',
    designation: 'Operations Lead',
    department: 'General Division',
    bio: 'Manages daily tasks, logistics execution, and operations scheduling.'
  }
];

const DEFAULT_SETTINGS = {
  groupHeads: ['IT', 'HR', 'Finance', 'Operations', 'Marketing'],
  paymentModes: ['Cash', 'Cheque', 'Bank Transfer', 'Online Payment'],
  lastSerialNumber: 0,
  durations: ['15m', '30m', '45m', '1h', '1.5h', '2h', '3h', '4h'],
  categories: ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health']
};

const generateDummyTasks = () => {
  const tasks = [];
  
  // Morning tasks (20 tasks)
  const morningList = [
    { desc: 'Breakfast', cat: 'Personal' },
    { desc: 'Meditation & Breathwork', cat: 'Health' },
    { desc: 'Gym Workout Routine', cat: 'Health' },
    { desc: 'Review Agenda & Schedule', cat: 'Work' },
    { desc: 'Standup Sync Meeting', cat: 'Meeting' },
    { desc: 'Inbox Zero Email Clean', cat: 'Work' },
    { desc: 'Follow-up with Supplier A', cat: 'Call' },
    { desc: 'Technical Lead Sync', cat: 'Meeting' },
    { desc: 'Review Indent Approvals', cat: 'Review' },
    { desc: 'Equipment Status Check', cat: 'Review' },
    { desc: 'Quality Check Reports', cat: 'Review' },
    { desc: 'Morning Tea Break', cat: 'Break' },
    { desc: 'Call Client X regarding Demo', cat: 'Call' },
    { desc: 'Log Production Metrics', cat: 'Work' },
    { desc: 'Review Equipment Purchase list', cat: 'Review' },
    { desc: 'Fill daily water bottle', cat: 'Health' },
    { desc: 'Team Motivation Pep-talk', cat: 'Meeting' },
    { desc: 'Review pending task backlog', cat: 'Review' },
    { desc: 'Clean desk and workspace', cat: 'Personal' },
    { desc: 'Calibration of Micrometer Set', cat: 'Work' }
  ];

  // Afternoon tasks (18 tasks)
  const afternoonList = [
    { desc: 'Lunch Break', cat: 'Personal' },
    { desc: 'Client Onboarding Presentation', cat: 'Meeting' },
    { desc: 'Code Review of Frontend PRs', cat: 'Review' },
    { desc: 'Frontend UI layout coding', cat: 'Work' },
    { desc: 'Architecture Alignment Sync', cat: 'Meeting' },
    { desc: 'Stretch & Walk Break', cat: 'Break' },
    { desc: 'Call Supplier B regarding PO', cat: 'Call' },
    { desc: 'Fill purchase requisitions', cat: 'Work' },
    { desc: 'Review Terms and Conditions', cat: 'Review' },
    { desc: 'Log afternoon operational log', cat: 'Work' },
    { desc: 'Review monthly compliance logs', cat: 'Review' },
    { desc: 'Call Lead Designer regarding UI', cat: 'Call' },
    { desc: 'Prepare vendor evaluation sheet', cat: 'Work' },
    { desc: 'Validate item serial numbers', cat: 'Review' },
    { desc: 'Department budgeting review', cat: 'Review' },
    { desc: 'Mid-day snack & water check', cat: 'Break' },
    { desc: 'Log QA defect reports', cat: 'Work' },
    { desc: 'Sync with Operations Manager', cat: 'Meeting' }
  ];

  // Evening tasks (10 tasks)
  const eveningList = [
    { desc: 'Evening Walk & Nature time', cat: 'Health' },
    { desc: 'Dinner', cat: 'Personal' },
    { desc: 'Call Operations team regarding dispatch', cat: 'Call' },
    { desc: 'Submit Daily Status Report', cat: 'Work' },
    { desc: 'Draft layout designs for tomorrow', cat: 'Work' },
    { desc: 'Post daily updates on Slack', cat: 'Work' },
    { desc: 'Call family member', cat: 'Personal' },
    { desc: 'Review task completions today', cat: 'Review' },
    { desc: 'Shutdown workspace layout check', cat: 'Personal' },
    { desc: 'Evening herbal tea', cat: 'Break' }
  ];

  // Night tasks (7 tasks)
  const nightList = [
    { desc: 'Read Technical Book or Blog', cat: 'Personal' },
    { desc: 'Plan Tomorrow\'s Targets', cat: 'Work' },
    { desc: 'Journaling & Reflection', cat: 'Personal' },
    { desc: 'Check calendar invitations', cat: 'Work' },
    { desc: 'Clean kitchen countertops', cat: 'Personal' },
    { desc: 'Backup main source database', cat: 'Work' },
    { desc: 'Bedtime breathing exercises', cat: 'Health' }
  ];

  let idCounter = 1;
  const build = (list, durationName) => {
    list.forEach((item, index) => {
      tasks.push({
        id: `TSK-${idCounter++}`,
        description: item.desc,
        duration: durationName,
        category: item.cat,
        priority: (index % 6 === 0) ? 'Frog' : '',
        status: 'Pending',
        timestamp: new Date().toISOString()
      });
    });
  };

  build(morningList, 'Morning');
  build(afternoonList, 'Afternoon');
  build(eveningList, 'Evening');
  build(nightList, 'Night');

  return tasks;
};

const seedCompletions = (tasksList) => {
  const completions = {};
  const today = new Date();
  
  // Seed only for past dates (strictly before today, e.g. i >= 1)
  for (let i = 1; i < 180; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    // For each day, randomly complete between 25 and 45 tasks out of 55
    const taskIds = tasksList.map(t => t.id);
    const shuffled = [...taskIds].sort(() => 0.5 - Math.random());
    const countCompleted = Math.floor(Math.random() * 21) + 25; // 25 to 45 tasks completed
    const completedIds = shuffled.slice(0, countCompleted);
    
    completions[dateStr] = completedIds;
  }
  
  localStorage.setItem('pcb_planner_completions_v1', JSON.stringify(completions));
};

export const initializeStorage = () => {
  // Check if we need to clean up legacy/dummy data - incremented key to clear database and load 55 tasks + 6m completions (strictly past only)
  if (!localStorage.getItem('dummy_data_cleaned_v5')) {
    localStorage.clear();
    localStorage.setItem('dummy_data_cleaned_v5', 'true');
  }

  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
    const dummyTasks = generateDummyTasks();
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(dummyTasks));
    seedCompletions(dummyTasks);
  }
};

export const getFromStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// User operations
export const getUsers = () => {
  const users = getFromStorage(STORAGE_KEYS.USERS);
  if (!users || !users.some(u => u.id === 'admin')) {
    saveToStorage(STORAGE_KEYS.USERS, DEFAULT_USERS);
    return DEFAULT_USERS;
  }
  return users;
};
export const saveUsers = (users) => saveToStorage(STORAGE_KEYS.USERS, users);

// Settings operations
export const getSettings = () => {
  const settings = getFromStorage(STORAGE_KEYS.SETTINGS) || {};
  return { ...DEFAULT_SETTINGS, ...settings };
};
export const saveSettings = (settings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings);

// Auth operations
export const getAuthUser = () => getFromStorage('pcb_authUser');
export const saveAuthUser = (user) => saveToStorage('pcb_authUser', user);
export const clearAuthUser = () => localStorage.removeItem('pcb_authUser');

// Vendor operations
export const getVendors = () => getFromStorage(STORAGE_KEYS.VENDORS) || [];
export const saveVendors = (vendors) => saveToStorage(STORAGE_KEYS.VENDORS, vendors);
export const saveVendor = (vendor) => {
  const vendors = getVendors();
  vendors.push(vendor);
  saveVendors(vendors);
};

// Company operations
export const getCompanies = () => getFromStorage(STORAGE_KEYS.COMPANIES) || [];
export const saveCompanies = (companies) => saveToStorage(STORAGE_KEYS.COMPANIES, companies);
export const saveCompany = (company) => {
  const companies = getCompanies();
  companies.push(company);
  saveCompanies(companies);
};

// Item Functions
export const getMasterItems = () => getFromStorage(STORAGE_KEYS.ITEMS) || [];
export const saveMasterItems = (items) => saveToStorage(STORAGE_KEYS.ITEMS, items);
export const saveMasterItem = (item) => {
  const items = getMasterItems();
  items.push(item);
  saveMasterItems(items);
};

// Group Head Functions
export const getGroupHeads = () => getFromStorage(STORAGE_KEYS.GROUP_HEADS) || [];
export const saveGroupHeads = (data) => saveToStorage(STORAGE_KEYS.GROUP_HEADS, data);
export const saveGroupHead = (item) => {
  const data = getGroupHeads();
  data.push(item);
  saveGroupHeads(data);
};

// UOM Functions
export const getUOMs = () => getFromStorage(STORAGE_KEYS.UOMS) || [];
export const saveUOMs = (data) => saveToStorage(STORAGE_KEYS.UOMS, data);
export const saveUOM = (item) => {
  const data = getUOMs();
  data.push(item);
  saveUOMs(data);
};

// Department Functions
export const getDepartments = () => getFromStorage(STORAGE_KEYS.DEPARTMENTS) || [];
export const saveDepartments = (data) => saveToStorage(STORAGE_KEYS.DEPARTMENTS, data);
export const saveDepartment = (item) => {
  const data = getDepartments();
  data.push(item);
  saveDepartments(data);
};

// Terms & Conditions Functions
export const getTermsConditions = () => getFromStorage(STORAGE_KEYS.TERMS_CONDITIONS) || [];
export const saveTermsConditions = (data) => saveToStorage(STORAGE_KEYS.TERMS_CONDITIONS, data);
export const saveTermsCondition = (item) => {
  const data = getTermsConditions();
  data.push(item);
  saveTermsConditions(data);
};

// Equipment Functions
export const getEquipments = () => {
  const equips = getFromStorage(STORAGE_KEYS.EQUIPMENTS) || [];
  if (equips.length === 0) {
    const dummyEquipments = [
      { id: 'DEIPL/M/D/01', equipmentName: 'Gauge Block (Micrometer Check Set)', makeModel: 'KCP / M11', instSrNo: '10751', rangeSize: '2.5 mm to 25mm', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/D/02', equipmentName: 'Caliper Checker', makeModel: 'KCP / CC600', instSrNo: '3866', rangeSize: '0 to 600 mm', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/D/03', equipmentName: 'Profile Projector', makeModel: 'Innovative Automation Product / V300 ECO', instSrNo: '378', rangeSize: 'X=150 mm , Y=100 mm', leastCount: '0.001 mm', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/D/04', equipmentName: 'Dial Calibration Tester', makeModel: 'MAYUR', instSrNo: '---', rangeSize: '0 to 25 mm', leastCount: '0.0002 mm', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/D/05', equipmentName: 'Granite Surfac Plate', makeModel: 'Luthra', instSrNo: '94875', rangeSize: '630 x 630 mm', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/D/TAC/01', equipmentName: 'Digital Tachometer', makeModel: 'Fluke / Fluke-930', instSrNo: '2324584', rangeSize: '1 RPM to 19999 RPM', leastCount: '0.01, 0.1,1 RPM', dateOfPurchase: 'Mar-24' },
      { id: 'DEIPL/LAB/04', equipmentName: 'Digital Vernier Caliper', makeModel: 'Mitutoyo', instSrNo: '6998', rangeSize: '0-300mm', leastCount: '0.01mm', dateOfPurchase: 'Mar-20' },
      { id: 'DEIPL/LAB/05', equipmentName: 'Ring Gauge', makeModel: 'KCP', instSrNo: 'KCP-68116-1', rangeSize: '50 mm', leastCount: '-', dateOfPurchase: 'Aug-24' },
      { id: 'DEIPL/LAB/05A', equipmentName: 'Ring Gauge', makeModel: 'KCP', instSrNo: 'KCP-68117-1', rangeSize: '5 mm', leastCount: '-', dateOfPurchase: 'Aug-24' },
      { id: 'DEIPL/LAB/06', equipmentName: 'Measuring Pin', makeModel: 'KCP', instSrNo: '-', rangeSize: '10 mm', leastCount: '-', dateOfPurchase: 'Aug-24' },
      { id: 'DEIPL/LAB/02', equipmentName: 'Load Cell & Indicator 200 kN', makeModel: 'Rudra & MCS / RSL 203 & LCI-200 kN', instSrNo: '1906301704 / 112-1219', rangeSize: '20 kN to 200 kN', leastCount: '0.002 kN', dateOfPurchase: 'Nov-19' },
      { id: 'DEIPL/LAB/03', equipmentName: 'Proving Ring 2000kN', makeModel: 'SBS / Integral', instSrNo: '2000KN.0386', rangeSize: '200 kN to 2000 kN', leastCount: '0.1 Div.', dateOfPurchase: 'Nov-19' },
      { id: 'DEIPL/LAB/09', equipmentName: 'Proving Ring 2000kN', makeModel: 'DRS Engineering & Calibration', instSrNo: '2000KN.0314', rangeSize: '200 kN to 2000 kN', leastCount: '0.1 Div.', dateOfPurchase: 'Apr-22' },
      { id: 'DEIPL/LAB/10', equipmentName: 'Proving Ring 2000kN', makeModel: 'DRS Engineering & Calibration', instSrNo: '2000KN.23.74', rangeSize: '200 kN to 2000 kN', leastCount: '0.1 Div.', dateOfPurchase: 'Jul-23' },
      { id: 'DEIPL/LAB/11', equipmentName: 'Proving Ring 2000kN', makeModel: 'R.K. Scientific Equipment', instSrNo: '2000KN.25118', rangeSize: '200 kN to 2000 kN', leastCount: '0.1 Div.', dateOfPurchase: 'Feb-25' },
      { id: 'DEIPL/TH/01', equipmentName: 'Digital Thermometer with 4 Wire RTD Sensor', makeModel: 'Yudian / Reliable', instSrNo: '1801111339 / 20C107201', rangeSize: '-80 to 300°C', leastCount: '0.01 °C', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/TH/03', equipmentName: 'Datalogger with 3 Wire RTD Sensors (10 Channel)', makeModel: 'Microcubs / Nascon', instSrNo: 'MRR / 150920/001', rangeSize: '-80 to 300°C', leastCount: '0.1 °C', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/Lab/07', equipmentName: 'Digital Weighing Balance', makeModel: 'RADWAG / PM 35.C32', instSrNo: '671889', rangeSize: '35000 g', leastCount: '0.1 g', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/Lab/08', equipmentName: 'Digital Weighing Balance', makeModel: 'RADWAG / PS 3000.X2', instSrNo: '671894', rangeSize: '3000 g', leastCount: '0.001 g', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/01', equipmentName: 'Standard Weights Box', makeModel: 'Weightronics', instSrNo: 'WT/AS-III/2020/3550', rangeSize: '1 mg to 200 g', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/02', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '0.5 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/03', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '1 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/04', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '2 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/05', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '2 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/06', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '5 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/07', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '10 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/08', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/09', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/10', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/11', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/12', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/AS-III/2020/3551', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/13', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/14', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/15', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/16', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/17', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/18', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/19', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/20', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/21', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/M/MV/22', equipmentName: 'Standard Weights', makeModel: 'Weightronics / Knob Type', instSrNo: 'WT/SL-WT/2020/3552', rangeSize: '20 kg', leastCount: 'NA.', dateOfPurchase: 'Sep-20' },
      { id: 'DEIPL/Env/01', equipmentName: 'Digital Thermo Hygrometer', makeModel: 'HTC-2', instSrNo: '-', rangeSize: '-10°C to 50°C 10%RH to 99%RH', leastCount: '0.1°C & 1%RH', dateOfPurchase: 'Dec-20' },
      { id: 'DEIPL/Env/02', equipmentName: 'Digital Thermo Hygrometer', makeModel: 'HTC-1', instSrNo: '-', rangeSize: '-10°C to 50°C 10%RH to 99%RH', leastCount: '0.1°C & 1%RH', dateOfPurchase: 'Dec-20' },
      { id: 'DEIPL/Env/03', equipmentName: 'Digital Thermo Hygrometer', makeModel: 'HTC-1', instSrNo: '-', rangeSize: '-10°C to 50°C 10%RH to 99%RH', leastCount: '0.1°C & 1%RH', dateOfPurchase: 'Dec-20' },
      { id: 'DEIPL/Env/04', equipmentName: 'Digital Thermo Hygrometer', makeModel: 'HTC-1', instSrNo: '-', rangeSize: '-10°C to 50°C 10%RH to 99%RH', leastCount: '0.1°C & 1%RH', dateOfPurchase: 'Dec-20' },
      { id: 'DEIPL/Env/05', equipmentName: 'Digital Thermo Hygrometer', makeModel: 'HTC-1', instSrNo: '-', rangeSize: '-10°C to 50°C 10%RH to 99%RH', leastCount: '0.1°C & 1%RH', dateOfPurchase: 'Dec-20' },
      { id: 'DEIPL/Env/06', equipmentName: 'Digital Altimeter', makeModel: 'ZD-2028/9 in 1', instSrNo: '-', rangeSize: '350 to 1100 hPa', leastCount: '0.1 hPa', dateOfPurchase: 'Dec-20' },
      { id: 'DEIPL/Env/07', equipmentName: 'Digital Thermometer', makeModel: '-', instSrNo: '-', rangeSize: '-50°C to 300°C', leastCount: '0.1°C', dateOfPurchase: 'Dec-20' },
      { id: 'DEIPL/Env/08', equipmentName: 'Digital Multimeter', makeModel: 'Fluke / 17B+', instSrNo: '57310040WS', rangeSize: '-', leastCount: '-', dateOfPurchase: 'Mar-24' },
      { id: 'DEIPL/Env/09', equipmentName: 'Digital Sound Level Meter', makeModel: 'Sigma', instSrNo: '240305433', rangeSize: '30-130dB', leastCount: '-', dateOfPurchase: 'Mar-24' },
      { id: 'DEIPL/Env/10', equipmentName: 'Lux Meter', makeModel: '', instSrNo: '', rangeSize: '', leastCount: '', dateOfPurchase: '' }
    ];
    
    // add unique IDs and timestamps
    const seeded = dummyEquipments.map((eq, i) => ({
      ...eq,
      internalId: `EQ-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString()
    }));
    
    saveToStorage(STORAGE_KEYS.EQUIPMENTS, seeded);
    return seeded;
  }
  return equips;
};
export const saveEquipments = (data) => saveToStorage(STORAGE_KEYS.EQUIPMENTS, data);
export const saveEquipment = (item) => {
  const data = getEquipments();
  data.push(item);
  saveEquipments(data);
};

// Task Functions
export const getTasks = () => {
  const tasks = getFromStorage(STORAGE_KEYS.TASKS) || [];
  if (tasks.length === 0) {
    const dummyTasks = generateDummyTasks();
    saveToStorage(STORAGE_KEYS.TASKS, dummyTasks);
    return dummyTasks;
  }
  return tasks;
};
export const saveTasks = (data) => saveToStorage(STORAGE_KEYS.TASKS, data);
export const saveTask = (item) => {
  const data = getTasks();
  data.push(item);
  saveTasks(data);
};

// Planner Completion Functions
export const getCompletions = () => getFromStorage('pcb_planner_completions_v1') || {};
export const saveCompletions = (data) => saveToStorage('pcb_planner_completions_v1', data);

// Export keys
export { STORAGE_KEYS };
