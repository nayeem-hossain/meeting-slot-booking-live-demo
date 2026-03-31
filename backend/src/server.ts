import { createServer } from "http";
import { Server } from "socket.io";
import { env, isAllowedOrigin } from "./config/env.js";
import { app } from "./app.js";
import { setSocketServer } from "./socket/io.js";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    }
  }
});

setSocketServer(io);

io.on("connection", (socket) => {
  socket.on("availability:watch-room", (roomId: string) => {
    socket.join(`room:${roomId}`);
  });
});

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API listening on http://localhost:${env.PORT}`);
});
