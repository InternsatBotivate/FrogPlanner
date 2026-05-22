// Storage Manager - Handle all localStorage operations

const STORAGE_KEYS = {
  SETTINGS: 'pcb_settings',
  VENDORS: 'pcb_vendors_v3',
  COMPANIES: 'pcb_companies_v3',
  ITEMS: 'pcb_items_v3',
  GROUP_HEADS: 'pcb_group_heads_v3',
  UOMS: 'pcb_uoms_v3',
  DEPARTMENTS: 'pcb_departments_v3',
  TERMS_CONDITIONS: 'pcb_terms_conditions_v1',
};

const DEFAULT_SETTINGS = {
  groupHeads: ['IT', 'HR', 'Finance', 'Operations', 'Marketing'],
  paymentModes: ['Cash', 'Cheque', 'Bank Transfer', 'Online Payment'],
  lastSerialNumber: 0,
  durations: ['15m', '30m', '45m', '1h', '1.5h', '2h', '3h', '4h'],
  categories: ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health']
};

export const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
};

export const getFromStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Settings operations
export const getSettings = () => {
  const settings = getFromStorage(STORAGE_KEYS.SETTINGS) || {};
  return { ...DEFAULT_SETTINGS, ...settings };
};
export const saveSettings = (settings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings);

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

// Export keys
export { STORAGE_KEYS };
