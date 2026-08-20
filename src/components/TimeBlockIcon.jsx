import React from 'react';
import { Clock3, Moon, Sun, Sunrise, Sunset } from 'lucide-react';

const iconForTimeBlock = (block = '') => {
  const value = block.toLowerCase();
  if (value.includes('morning')) return Sunrise;
  if (value.includes('afternoon')) return Sun;
  if (value.includes('evening')) return Sunset;
  if (value.includes('night')) return Moon;
  return Clock3;
};

const TimeBlockIcon = ({ block, size = 14, className = '', strokeWidth = 1.9 }) => {
  const Icon = iconForTimeBlock(block);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
};

export default TimeBlockIcon;
