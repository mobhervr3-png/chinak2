/// <reference types="vite/client" />
import { io } from 'socket.io-client';
import { getBaseDomain } from './api';

const SOCKET_URL = getBaseDomain();

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
