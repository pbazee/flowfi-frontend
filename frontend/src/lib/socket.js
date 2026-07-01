import { create } from 'zustand'
import { io } from 'socket.io-client'

let socket = null

export function connectSocket(role, id) {
  if (socket?.connected) return socket
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    transports: ['websocket'],
  })
  socket.on('connect', () => {
    if (role === 'super_admin') socket.emit('join:admin')
    else if (role === 'tenant_admin' && id) socket.emit('join:tenant', id)
  })
  return socket
}

export function getSocket() { return socket }

export const useSocketStore = create(() => ({
  connected: false,
  setConnected: (v) => ({ connected: v }),
}))
