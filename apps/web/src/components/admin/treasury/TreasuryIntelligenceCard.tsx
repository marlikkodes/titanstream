import type React from 'react';

interface TreasuryIntelligenceCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon?: React.ReactNode;
  badgeText?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info';
  progress?: number; // 0 to 100
  progressColor?: string;
}

export const TreasuryIntelligenceCard: React.FC<TreasuryIntelligenceCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendPositive = true,
  icon,
  badgeText,
  badgeVariant = 'info',
  progress,
  progressColor = 'bg-usdt-green',
}) => {
  const badgeStyles = {
    success: 'bg-usdt-green/10 border-usdt-green/30 text-usdt-green',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    danger: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };

  return (
    <div className="bg-card-bg border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-text-tertiary">{title}</span>
        {icon && <div className="p-2.5 rounded-xl bg-control-bg border border-white/10 text-text-secondary">{icon}</div>}
      </div>

      {/* Main metric value */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-text-primary tracking-tight font-mono">{value}</span>
          {badgeText && (
            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${badgeStyles[badgeVariant]}`}>
              {badgeText}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-text-secondary">{subtitle}</p>}
      </div>

      {/* Progress bar if present */}
      {typeof progress === 'number' && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] text-text-tertiary">
            <span>Coverage</span>
            <span className="font-mono font-bold text-text-secondary">{progress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Trend indicator */}
      {trend && (
        <div className="text-[11px] font-semibold flex items-center gap-1 text-text-tertiary">
          <span className={trendPositive ? 'text-usdt-green font-bold' : 'text-rose-400 font-bold'}>{trend}</span>
        </div>
      )}
    </div>
  );
};
