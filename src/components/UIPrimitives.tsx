import React from 'react';
import { LucideIcon } from 'lucide-react';

export const GlassPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-[rgba(22,20,18,0.72)] backdrop-blur-md border border-white/12 rounded-2xl shadow-xl ${className}`}
    >
      {children}
    </div>
  );
};

export const ArchitecturalCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#1B1815] border border-white/10 rounded-2xl p-4 transition-all duration-200 ${
        onClick
          ? 'cursor-pointer hover:border-[#D6A77A]/40 hover:bg-[#201C18] active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const BrassButton: React.FC<{
  children?: React.ReactNode;
  text?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}> = ({ children, text, onClick, icon: Icon, className = '', disabled = false, type = 'button' }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-10 px-4 rounded-[10px] font-semibold text-xs tracking-wider uppercase inline-flex items-center justify-center gap-2 bg-[#D6A77A] text-[#0E0C0A] transition-all duration-150 hover:bg-[#e2b990] active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-md ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {text || children}
    </button>
  );
};

export const OutlinedBrassButton: React.FC<{
  children?: React.ReactNode;
  text?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  className?: string;
  disabled?: boolean;
}> = ({ children, text, onClick, icon: Icon, className = '', disabled = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 px-4 rounded-[10px] font-medium text-xs tracking-wider inline-flex items-center justify-center gap-2 border border-[#D6A77A] text-[#D6A77A] hover:bg-[#D6A77A]/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-all ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {text || children}
    </button>
  );
};

export const StatCard: React.FC<{
  title: string;
  value: string;
  subtext: string;
  badge?: string;
  className?: string;
}> = ({ title, value, subtext, badge, className = '' }) => {
  return (
    <ArchitecturalCard className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F6F2EC]/50">
          {title}
        </span>
        {badge && (
          <span className="bg-[#D6A77A]/15 text-[#D6A77A] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#D6A77A]/30">
            {badge}
          </span>
        )}
      </div>
      <div className="text-2xl lg:text-3xl font-bold font-serif-heading text-[#F6F2EC] mb-1">
        {value}
      </div>
      <div className="text-xs text-[#F6F2EC]/60">{subtext}</div>
    </ArchitecturalCard>
  );
};

export const EmptyStateView: React.FC<{
  title: string;
  description: string;
  actionText?: string;
  onActionClick?: () => void;
  icon?: LucideIcon;
}> = ({ title, description, actionText, onActionClick, icon: Icon }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-white/10 rounded-2xl bg-[#1B1815]/60 my-6">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-[#141210] border border-[#D6A77A]/30 flex items-center justify-center mb-4 text-[#D6A77A]">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-lg font-bold font-serif-heading text-[#F6F2EC] mb-2">{title}</h3>
      <p className="text-xs text-[#F6F2EC]/60 max-w-md mb-5 leading-relaxed">{description}</p>
      {actionText && onActionClick && (
        <BrassButton text={actionText} onClick={onActionClick} />
      )}
    </div>
  );
};
