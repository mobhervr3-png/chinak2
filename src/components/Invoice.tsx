import { forwardRef } from 'react';

interface InvoiceProps {
  order: any;
  settings: any;
}

const Invoice = forwardRef<HTMLDivElement, InvoiceProps>(({ order, settings }, ref) => {
  if (!order) return null;

  return (
    <div ref={ref} className="p-12 bg-white text-slate-900" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
        <div>
          <h1 className="text-3xl font-black text-primary mb-2">{settings?.storeName || 'متجري'}</h1>
          <p className="text-sm text-slate-500">{settings?.contactEmail}</p>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1 ltr" dir="ltr">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500/10 text-green-600">
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.432h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <span>{settings?.contactPhone}</span>
          </div>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold mb-2">فاتورة ضريبية</h2>
          <p className="text-sm font-bold text-slate-500">رقم الطلب: #{order.id}</p>
          <p className="text-sm text-slate-500">التاريخ: {new Date(order.createdAt).toLocaleDateString('ar-IQ')}</p>
        </div>
      </div>

      {/* Customer & Shipping */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">فاتورة إلى:</h3>
          <p className="font-bold text-lg">{order.user?.name}</p>
          <p className="text-sm text-slate-500" dir="ltr">{order.user?.phone}</p>
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">عنوان الشحن:</h3>
          <p className="text-sm font-bold">{order.address?.name}</p>
          <p className="text-sm text-slate-500">{order.address?.city}، {order.address?.province}</p>
          <p className="text-sm text-slate-500">{order.address?.street}</p>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1 ltr" dir="ltr">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500/10 text-green-600">
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.432h.006c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <span>{order.address?.phone}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-12">
        <thead>
          <tr className="border-b-2 border-slate-100 text-right">
            <th className="py-4 font-black text-sm text-slate-400 uppercase">المنتج</th>
            <th className="py-4 font-black text-sm text-slate-400 uppercase text-center">الكمية</th>
            <th className="py-4 font-black text-sm text-slate-400 uppercase text-left">السعر</th>
            <th className="py-4 font-black text-sm text-slate-400 uppercase text-left">المجموع</th>
          </tr>
        </thead>
        <tbody>
          {order.items?.map((item: any, index: number) => (
            <tr key={index} className="border-b border-slate-50">
              <td className="py-4">
                <p className="font-bold text-slate-800">{item.product?.name}</p>
                <p className="text-xs text-slate-400">{item.product?.id}</p>
              </td>
              <td className="py-4 text-center font-bold text-slate-600">{item.quantity}</td>
              <td className="py-4 text-left font-bold text-slate-600">{item.price.toLocaleString()} {settings?.currency}</td>
              <td className="py-4 text-left font-black text-slate-800">{(item.price * item.quantity).toLocaleString()} {settings?.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 font-bold">المجموع الفرعي:</span>
            <span className="font-bold text-slate-600">{order.items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0).toLocaleString()} {settings?.currency}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-rose-500">
              <span className="font-bold">الخصم:</span>
              <span className="font-bold">-{order.discountAmount.toLocaleString()} {settings?.currency}</span>
            </div>
          )}
          <div className="flex justify-between text-lg border-t border-slate-100 pt-3">
            <span className="font-black text-slate-900">الإجمالي:</span>
            <span className="font-black text-primary">{order.total.toLocaleString()} {settings?.currency}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-24 text-center border-t border-slate-100 pt-8">
        <p className="text-sm text-slate-400 font-bold mb-2">شكراً لتعاملكم معنا!</p>
        <p className="text-xs text-slate-300">{settings?.footerText}</p>
      </div>
    </div>
  );
});

Invoice.displayName = 'Invoice';

export default Invoice;
