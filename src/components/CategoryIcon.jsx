import React from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  Coffee,
  Folder,
  HeartPulse,
  House,
  Phone,
  Plane,
  SearchCheck,
  WalletCards,
} from 'lucide-react';

const getCategoryIcon = (category = '') => {
  const value = category.toLowerCase().trim();
  if (/health|gym|fitness|workout|exercise|sport/.test(value)) return HeartPulse;
  if (/work|office|job|meeting|task|project/.test(value)) return BriefcaseBusiness;
  if (/personal|self|home|life/.test(value)) return House;
  if (/learning|study|book|course|read|class/.test(value)) return BookOpen;
  if (/finance|money|tax|budget|bill|pay|salary/.test(value)) return WalletCards;
  if (/travel|trip|flight|vacation|tour|journey/.test(value)) return Plane;
  if (/call|phone|talk/.test(value)) return Phone;
  if (/review|check|inspect/.test(value)) return SearchCheck;
  if (/break|tea|coffee|lunch/.test(value)) return Coffee;
  return Folder;
};

const CategoryIcon = ({ category, size = 14, className = '', strokeWidth = 1.9 }) => {
  const Icon = getCategoryIcon(category);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
};

export default CategoryIcon;
