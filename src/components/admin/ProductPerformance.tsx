import React, { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { calculateInclusivePrice } from '../../utils/shipping';
import { fetchSettings } from '../../services/api';

interface ProductPerformanceProps {
  products: any[];
}

const ProductPerformance: React.FC<ProductPerformanceProps> = ({ products }) => {
  const { t } = useTranslation();
  const [rates, setRates] = useState<any>({
    airRate: 15400,
    seaRate: 182000,
    minFloor: 0
  });

  useEffect(() => {
    const loadRates = async () => {
      try {
        const settings = await fetchSettings();
        if (settings) {
          setRates({
            airRate: settings.airShippingRate || 15400,
            seaRate: settings.seaShippingRate || 182000,
            minFloor: 0
          });
        }
      } catch (error) {
        console.error('Failed to load shipping rates:', error);
      }
    };
    loadRates();
  }, []);

  const data = useMemo(() => products.slice(0, 8).map((p, i) => {
    const inclusivePrice = calculateInclusivePrice(
      p.price, 
      p.domesticShippingFee || 0,
      p.basePriceIQD,
      rates
    );
    return {
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      orders: (i * 7 + 13) % 40 + 10,
      revenue: inclusivePrice * ((i * 3 + 5) % 9 + 1)
    };
  }), [products, rates]);

  return (
    <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 flex flex-col">
      <div className="flex items-center justify-between mb-6 flex-row-reverse">
        <div className="flex items-center gap-2 flex-row-reverse">
          <TrendingUp className="text-primary" size={24} />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('dashboard.overview.product_performance')}</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400">{t('dashboard.overview.by_orders')}</span>
      </div>
      <div className="h-[350px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
            <XAxis type="number" hide orientation="top" />
            <YAxis 
              dataKey="name" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
              width={100}
              orientation="right"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                border: 'none', 
                borderRadius: '12px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 'bold',
                textAlign: 'right'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="orders" 
              stroke="#10b981" 
              fill="#10b981" 
              fillOpacity={0.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProductPerformance;
