import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, BarChart3, CheckCircle2, Clock, Users, Info } from 'lucide-react';

interface StatsCardsProps {
  stats: any;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const { t } = useTranslation();

  const statItems = [
    { 
      label: t('dashboard.overview.total_sales'), 
      value: `${stats?.totalSales?.toLocaleString() || 0} ${t('common.iqd')}`, 
      icon: CreditCard, 
      color: 'bg-emerald-500',
      info: 'المبيعات الإجمالية تشمل رسوم الشحن والخصومات'
    },
    { 
      label: t('dashboard.overview.avg_order'), 
      value: `${Math.round(stats?.averageOrderValue || 0).toLocaleString()} ${t('common.iqd')}`, 
      icon: BarChart3, 
      color: 'bg-blue-500',
      info: 'متوسط قيمة الطلب الواحد شاملاً الشحن'
    },
    { label: t('dashboard.overview.completed_orders'), value: stats?.deliveredOrders || 0, icon: CheckCircle2, color: 'bg-indigo-500' },
    { label: t('dashboard.overview.pending_orders'), value: stats?.pendingOrders || 0, icon: Clock, color: 'bg-amber-500' },
    { label: t('dashboard.overview.users_count'), value: stats?.totalUsers || 0, icon: Users, color: 'bg-slate-600' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {statItems.map((stat, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 group hover:border-primary/30 transition-all duration-300 text-right">
          <div className="flex items-center gap-4 flex-row-reverse">
            <div className={`${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-${stat.color.split('-')[1]}-500/20`}>
              <stat.icon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                {stat.info && (
                  <div className="group/info relative">
                    <Info size={10} className="text-slate-300 cursor-help" />
                    <div className="absolute bottom-full right-0 mb-2 w-32 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                      {stat.info}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
