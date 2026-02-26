import React from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';

interface LatestOrdersProps {
  orders: any[];
  onViewAll: () => void;
}

const LatestOrders: React.FC<LatestOrdersProps> = ({ orders, onViewAll }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
      <div className="flex items-center justify-between mb-6 flex-row-reverse">
        <div className="flex items-center gap-2 flex-row-reverse">
          <History className="text-primary" size={20} />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('dashboard.overview.latest_orders')}</h3>
        </div>
        <button 
          onClick={onViewAll}
          className="text-sm font-bold text-primary hover:underline"
        >
          {t('dashboard.overview.view_all_orders')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="text-slate-400 text-[11px] font-black uppercase tracking-wider border-b border-slate-50 dark:border-slate-700/50 flex-row-reverse">
              <th className="pb-4 pr-4">{t('dashboard.overview.table.order_no')}</th>
              <th className="pb-4">{t('dashboard.overview.table.customer')}</th>
              <th className="pb-4">{t('dashboard.overview.table.date')}</th>
              <th className="pb-4">طريقة الدفع</th>
              <th className="pb-4">{t('dashboard.overview.table.amount')}</th>
              <th className="pb-4 text-center">{t('dashboard.overview.table.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {orders.slice(0, 5).map((order) => (
              <tr key={order.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="py-4 pr-4 font-bold text-slate-900 dark:text-white">#{order.id}</td>
                <td className="py-4">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{order.user?.name}</div>
                  <div className="text-[10px] text-slate-500" dir="ltr">{order.user?.phone}</div>
                </td>
                <td className="py-4 text-xs text-slate-500">
                  {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
                </td>
                <td className="py-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                  {order.paymentMethod === 'credit_card' ? 'بطاقة ائتمان' :
                   order.paymentMethod === 'cash' ? 'دفع نقداً' :
                   order.paymentMethod === 'zain_cash' ? 'زين كاش' : 'سوبر كي'}
                </td>
                <td className="py-4 font-black text-primary text-sm">
                  {order.total.toLocaleString()} {t('common.iqd')}
                </td>
                <td className="py-4">
                  <div className="flex justify-center">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                      order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                      order.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' :
                      order.status === 'AWAITING_PAYMENT' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                      order.status === 'PREPARING' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' :
                      order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                      order.status === 'ARRIVED_IRAQ' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400' :
                      'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400'
                    }`}>
                      {t(`status.${order.status.toLowerCase()}`)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LatestOrders;
