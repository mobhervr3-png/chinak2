import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

interface SalesAnalysisProps {
  monthlySales: any[];
}

const SalesAnalysis: React.FC<SalesAnalysisProps> = ({ monthlySales }) => {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
      <div className="flex items-center justify-between mb-8 flex-row-reverse">
        <div className="flex items-center gap-2 flex-row-reverse">
          <BarChart3 className="text-primary" size={24} />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('dashboard.overview.sales_analysis')}</h3>
        </div>
        <select className="text-xs font-bold bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-1 px-3 outline-none text-slate-500 text-right">
          <option>{t('dashboard.overview.last_12_months')}</option>
          <option>{t('dashboard.overview.last_30_days')}</option>
        </select>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlySales}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1e40af" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#1e40af" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                backgroundColor: '#fff',
                padding: '12px'
              }}
              itemStyle={{ fontWeight: 900, fontSize: '12px' }}
              labelStyle={{ fontWeight: 900, fontSize: '10px', color: '#64748b', marginBottom: '4px' }}
            />
            <Area 
              type="monotone" 
              dataKey="total" 
              stroke="#1e40af" 
              strokeWidth={4}
              fillOpacity={1} 
              fill="url(#colorSales)" 
              name={t('dashboard.overview.sales')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesAnalysis;
