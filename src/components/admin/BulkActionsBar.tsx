import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Upload, Eye, EyeOff, Trash2, X } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  isPublishing: boolean;
  onBulkPublish: () => void;
  onBulkStatus: (active: boolean) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  isPublishing,
  onBulkPublish,
  onBulkStatus,
  onBulkDelete,
  onClearSelection
}) => {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 shadow-2xl border border-primary/20 rounded-2xl px-6 py-4 z-50 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 border-r pr-6 border-slate-100 dark:border-slate-700">
        <span className="w-6 h-6 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center">
          {selectedCount}
        </span>
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {t('dashboard.products.bulk_actions.selected_count', { count: selectedCount })}
        </span>
      </div>
      
      <div className="flex items-center gap-2 flex-row-reverse">
        <button 
          onClick={onBulkPublish}
          disabled={isPublishing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[11px] font-black hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {isPublishing ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Upload size={18} />
          )}
          نشر المختار
        </button>
        <button 
          onClick={() => onBulkStatus(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[11px] font-black hover:bg-emerald-100 transition-colors"
        >
          <Eye size={18} />
          {t('dashboard.products.bulk_actions.activate')}
        </button>
        <button 
          onClick={() => onBulkStatus(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[11px] font-black hover:bg-amber-100 transition-colors"
        >
          <EyeOff size={18} />
          {t('dashboard.products.bulk_actions.deactivate')}
        </button>
        <button 
          onClick={onBulkDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-black hover:bg-rose-100 transition-colors"
        >
          <Trash2 size={18} />
          {t('dashboard.products.bulk_actions.delete')}
        </button>
      </div>

      <button 
        onClick={onClearSelection}
        className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default BulkActionsBar;
