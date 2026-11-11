import React from 'react';
import { ComplaintPriority } from '../../types';
import { AlertTriangle, Minus, ArrowDown } from 'lucide-react';

interface PriorityBadgeProps {
  priority?: ComplaintPriority | string | null;
  size?: 'sm' | 'md' | 'lg';
  showPriorityWord?: boolean;
}

export function normalizePriority(priority?: string | null): ComplaintPriority {
  const upper = (priority || 'MEDIUM').trim().toUpperCase();
  if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
    return upper;
  }
  return 'MEDIUM';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  size = 'md',
  showPriorityWord = false,
}) => {
  const normalized = normalizePriority(priority);

  const configs: Record<
    ComplaintPriority,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    HIGH: {
      label: showPriorityWord ? 'High Priority' : 'High',
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />,
    },
    MEDIUM: {
      label: showPriorityWord ? 'Medium Priority' : 'Medium',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
      icon: <Minus className="w-3.5 h-3.5 flex-shrink-0" />,
    },
    LOW: {
      label: showPriorityWord ? 'Low Priority' : 'Low',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: <ArrowDown className="w-3.5 h-3.5 flex-shrink-0" />,
    },
  };

  const config = configs[normalized];

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold',
  };

  return (
    <span
      title={`${normalized.charAt(0) + normalized.slice(1).toLowerCase()} Priority`}
      className={`inline-flex items-center rounded-full border whitespace-nowrap ${config.bg} ${config.text} ${config.border} ${sizeClasses[size]}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
