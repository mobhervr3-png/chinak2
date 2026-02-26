import { create } from 'zustand';
import * as api from '../services/api';
import { socket } from '../services/socket';

export type AppNotification = {
  id: string | number;
  type: 'order' | 'offer' | 'system' | 'wallet';
  icon: string;
  title: string;
  description: string;
  time: string;
  isUnread: boolean;
  color?: string;
  link?: string;
  createdAt?: string;
};

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string | number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string | number) => Promise<void>;
  clearAll: () => Promise<void>;
  // Socket.io integration
  initSocket: (userId: string | number) => void;
  cleanupSocket: (userId: string | number) => void;
  // For optimistic updates or local-only notifications if needed
  addLocalNotification: (notification: any) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  initSocket: (userId: string | number) => {
    const eventName = `user_notification_${userId}`;
    
    // Remove existing listener if any to avoid duplicates
    socket.off(eventName);
    
    socket.on(eventName, (newNotif: any) => {
      const formattedNotif: AppNotification = {
        id: newNotif.id,
        type: newNotif.type,
        icon: newNotif.icon,
        title: newNotif.title,
        description: newNotif.description,
        time: new Date(newNotif.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        isUnread: true,
        color: newNotif.color,
        link: newNotif.link,
        createdAt: newNotif.createdAt
      };

      set((state) => ({
        notifications: [formattedNotif, ...state.notifications],
        unreadCount: state.unreadCount + 1
      }));
    });
  },

  cleanupSocket: (userId: string | number) => {
    socket.off(`user_notification_${userId}`);
  },

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const data = await api.fetchUserNotifications();
      const notifications = data.map((n: any) => ({
        id: n.id,
        type: n.type,
        icon: n.icon,
        title: n.title,
        description: n.description,
        time: new Date(n.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        isUnread: !n.isRead,
        color: n.color,
        link: n.link,
        createdAt: n.createdAt
      }));
      const unreadCount = notifications.filter((n: any) => n.isUnread).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string | number) => {
    try {
      await api.markUserNotificationAsRead(id);
      set((state) => {
        const updated = state.notifications.map((n) =>
          n.id === id ? { ...n, isUnread: false } : n
        );
        return {
          notifications: updated,
          unreadCount: Math.max(0, state.unreadCount - 1)
        };
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.markAllUserNotificationsAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isUnread: false })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  deleteNotification: async (id: string | number) => {
    try {
      await api.deleteUserNotification(id);
      set((state) => {
        const n = state.notifications.find((notif) => notif.id === id);
        return {
          notifications: state.notifications.filter((notif) => notif.id !== id),
          unreadCount: n?.isUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        };
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  },

  clearAll: async () => {
    try {
      await api.clearAllUserNotifications();
      set({ notifications: [], unreadCount: 0 });
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  },

  addLocalNotification: (notification) => {
    const newNotification: AppNotification = {
      ...notification,
      id: `local-${Math.random().toString(36).substring(7)}`,
      isUnread: true,
      time: 'الآن',
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
