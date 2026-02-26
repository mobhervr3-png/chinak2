import { create } from 'zustand';
import { fetchMessages, sendMessage } from '../services/api';
import { socket } from '../services/socket';

interface Message {
  id: number | string;
  orderId: number | string;
  userId: number | string;
  sender: 'USER' | 'ADMIN';
  text: string;
  createdAt: string;
}

interface ChatState {
  messagesByOrder: Record<string | number, Message[]>;
  isLoading: boolean;
  error: string | null;
  fetchMessages: (orderId: number | string) => Promise<void>;
  sendMessage: (orderId: number | string, text: string) => Promise<void>;
  addMessage: (message: Message) => void;
  initSocket: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByOrder: {},
  isLoading: false,
  error: null,

  initSocket: () => {
    socket.on('new_message', (message: Message) => {
      get().addMessage(message);
    });
  },

  fetchMessages: async (orderId: number | string) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await fetchMessages(orderId);
      set((state) => ({
        messagesByOrder: {
          ...state.messagesByOrder,
          [orderId]: messages,
        },
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch messages', isLoading: false });
    }
  },

  sendMessage: async (orderId: number | string, text: string) => {
    try {
      const newMessage = await sendMessage(orderId, text);
      set((state) => ({
        messagesByOrder: {
          ...state.messagesByOrder,
          [orderId]: [...(state.messagesByOrder[orderId] || []), newMessage],
        },
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to send message' });
      throw err;
    }
  },

  addMessage: (message: Message) => {
    set((state) => {
      const currentMessages = state.messagesByOrder[message.orderId] || [];
      // Avoid duplicates
      if (currentMessages.find((m) => m.id === message.id)) {
        return state;
      }
      return {
        messagesByOrder: {
          ...state.messagesByOrder,
          [message.orderId]: [...currentMessages, message],
        },
      };
    });
  },
}));
