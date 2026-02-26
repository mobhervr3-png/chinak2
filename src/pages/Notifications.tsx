import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Trash2, 
  ShoppingCart, 
  Truck, 
  Ticket, 
  User, 
  Wallet, 
  Info, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Tag,
  BellOff,
  Eraser
} from 'lucide-react';
import { useNotificationStore } from '../store/useNotificationStore';
import type { AppNotification } from '../store/useNotificationStore';
import { useShallow } from 'zustand/react/shallow';
import { useToastStore } from '../store/useToastStore';

const IconRenderer: React.FC<{ icon: string; className?: string }> = ({ icon, className }) => {
  const icons: { [key: string]: React.ElementType } = {
    shopping_cart: ShoppingCart,
    local_shipping: Truck,
    confirmation_number: Ticket,
    person: User,
    wallet: Wallet,
    info: Info,
    notifications: Bell,
    check_circle: CheckCircle2,
    cancel: XCircle,
    sell: Tag,
  };

  const IconComponent = icons[icon] || Bell;
  return <IconComponent size={24} strokeWidth={2.5} className={className} />;
};

interface NotificationItemProps {
  notification: AppNotification;
  onRead: (id: string | number) => void;
  onDelete: (id: string | number) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, onRead, onDelete
}) => {
  const navigate = useNavigate();
  const { icon, title, description, time, isUnread, color = 'blue', link } = notification;
  
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-primary',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-500',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
    gray: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  };

  const handleClick = () => {
    onRead(notification.id);
    if (link) navigate(link);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  return (
    <div 
      onClick={handleClick}
      className={`group relative flex gap-4 bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all cursor-pointer mb-3 shadow-sm hover:shadow-md ${!isUnread ? 'opacity-75' : ''}`}
    >
      {isUnread && (
        <div className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white dark:ring-surface-dark"></div>
      )}
      <div className={`flex shrink-0 items-center justify-center rounded-full h-12 w-12 mt-1 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
        <IconRenderer icon={icon} className="text-2xl" />
      </div>
      <div className="flex flex-1 flex-col gap-1 pr-2">
        <div className="flex justify-between items-start">
          <h4 className={`text-slate-900 dark:text-white text-base leading-tight ${isUnread ? 'font-bold' : 'font-medium'}`}>
            {title}
          </h4>
          <div className="flex items-center gap-2">
            <span className={`text-xs shrink-0 ${isUnread ? 'text-primary font-medium' : 'text-slate-400'}`}>
              {time}
            </span>
            <button 
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'offers'>('all');
  const { 
    notifications, 
    isLoading, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead, 
    clearAll, 
    deleteNotification 
  } = useNotificationStore(
    useShallow((state) => ({
      notifications: state.notifications,
      isLoading: state.isLoading,
      fetchNotifications: state.fetchNotifications,
      markAsRead: state.markAsRead,
      markAllAsRead: state.markAllAsRead,
      clearAll: state.clearAll,
      deleteNotification: state.deleteNotification
    }))
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    showToast('تم تحديد الكل كمقروء', 'success');
  };

  const handleClearAll = () => {
    if (window.confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) {
      clearAll();
      showToast('تم مسح جميع الإشعارات', 'info');
    }
  };

  const handleDeleteNotification = (id: string | number) => {
    deleteNotification(id);
    showToast('تم حذف الإشعار', 'info');
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'orders') return n.type === 'order';
    if (activeTab === 'offers') return n.type === 'offer';
    return true;
  });

  // Helper to group notifications by date
  const groupNotifications = (notifs: AppNotification[]) => {
    const groups: { [key: string]: AppNotification[] } = {
      'اليوم': [],
      'أمس': [],
      'سابقاً': []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifs.forEach(n => {
      if (!n.createdAt) {
        groups['اليوم'].push(n);
        return;
      }
      
      const notifDate = new Date(n.createdAt);
      notifDate.setHours(0, 0, 0, 0);

      if (notifDate.getTime() === today.getTime()) {
        groups['اليوم'].push(n);
      } else if (notifDate.getTime() === yesterday.getTime()) {
        groups['أمس'].push(n);
      } else {
        groups['سابقاً'].push(n);
      }
    });

    return groups;
  };

  const groupedNotifications = groupNotifications(filteredNotifications);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden rtl pb-safe pt-safe" dir="rtl">
      <header className="sticky top-0 z-50 bg-surface-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 transition-colors pt-safe">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center justify-center w-8 h-8 -mr-1 text-slate-900 dark:text-white active:opacity-70"
              >
                <ArrowRight size={24} />
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">الإشعارات</h1>
            </div>
            {notifications.length > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-primary text-sm font-medium hover:text-blue-600 transition-colors cursor-pointer"
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>
          
          <div className="px-5 pb-4">
            <div className="flex p-1 bg-slate-100 dark:bg-surface-dark rounded-xl">
              <button 
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all text-center ${
                  activeTab === 'all' 
                    ? 'bg-surface-light dark:bg-background-dark text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                الكل
              </button>
              <button 
                onClick={() => setActiveTab('orders')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all text-center ${
                  activeTab === 'orders' 
                    ? 'bg-surface-light dark:bg-background-dark text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                الطلبات
              </button>
              <button 
                onClick={() => setActiveTab('offers')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all text-center ${
                  activeTab === 'offers' 
                    ? 'bg-surface-light dark:bg-background-dark text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                العروض
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 pt-4 pb-32 overflow-y-auto no-scrollbar bg-slate-50/50 dark:bg-background-dark/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 text-sm">جاري تحميل الإشعارات...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="flex flex-col">
              {Object.entries(groupedNotifications).map(([group, notifs]) => (
                notifs.length > 0 && (
                  <div key={group} className="mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-1">{group}</h3>
                    {notifs.map((notif) => (
                      <NotificationItem 
                        key={notif.id} 
                        notification={notif}
                        onRead={markAsRead}
                        onDelete={handleDeleteNotification}
                      />
                    ))}
                  </div>
                )
              ))}
              
              <button 
                onClick={handleClearAll}
                className="mt-4 mb-8 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500/30 transition-all text-sm font-medium"
              >
                <Eraser size={18} />
                مسح جميع الإشعارات
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center mb-4">
                <BellOff size={40} className="text-slate-300" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">لا توجد إشعارات</h3>
              <p className="text-slate-500 text-sm">ستظهر إشعارات طلباتك وعروضنا هنا</p>
            </div>
          )}
        </main>
      </div>
  );
};

export default Notifications;
