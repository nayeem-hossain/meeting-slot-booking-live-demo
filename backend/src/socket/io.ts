import { Server } from "socket.io";

let io: Server | null = null;

export function setSocketServer(instance: Server): void {
  io = instance;
}

export function emitRoomAvailability(roomId: string): void {
  if (!io) {
    return;
  }

  io.to(`room:${roomId}`).emit("availability:updated", {
    roomId,
    occurredAt: new Date().toISOString()
  });
}
