import { Server } from "socket.io";

import { config } from "../config/env.js";
import { ROLES, verifyToken } from "../middleware/authMiddleware.js";

let io = null;

/**
 * Rooms:
 *   public            every connected client (inventory changes)
 *   admin             admin console
 *   hospital:{id}     staff of one hospital
 *   ambulance:{id}    crew of one ambulance
 *   emergency:{code}  anyone who knows the (unguessable) tracking code
 *
 * Events carry only identifiers; clients refetch through the authorised REST API,
 * so sockets never leak data that the REST layer would refuse.
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: config.frontendOrigins, credentials: true }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(); // anonymous (citizen / dashboard)
    }

    try {
      socket.data.user = verifyToken(token);
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("public");

    const user = socket.data.user;

    if (user?.role === ROLES.ADMIN) {
      socket.join("admin");
    } else if (user?.role === ROLES.HOSPITAL_ADMIN) {
      socket.join(`hospital:${user.hospitalId}`);
    } else if (user?.role === ROLES.AMBULANCE_CREW && user.ambulanceId) {
      socket.join(`ambulance:${user.ambulanceId}`);
    }

    socket.on("emergency:track", (code) => {
      if (typeof code === "string" && /^CC-[A-Z0-9]{8}$/.test(code)) {
        socket.join(`emergency:${code}`);
      }
    });

    socket.on("emergency:untrack", (code) => {
      if (typeof code === "string") {
        socket.leave(`emergency:${code}`);
      }
    });
  });

  return io;
};

export const connectedClients = () => io?.engine.clientsCount ?? 0;

const emit = (rooms, event, payload) => {
  if (!io) return;
  let target = io;
  for (const room of rooms) target = target.to(room);
  target.emit(event, payload);
};

/** An emergency changed: tell the citizen, its ambulance, involved hospitals and admins. */
export const notifyEmergency = ({ code, ambulanceId, hospitalIds = [] }) => {
  const rooms = [`emergency:${code}`, "admin"];
  if (ambulanceId) rooms.push(`ambulance:${ambulanceId}`);
  for (const id of hospitalIds) rooms.push(`hospital:${id}`);
  emit(rooms, "emergency:changed", { code });
};

/** A hospital's inventory or surgeon status changed. */
export const notifyInventory = (hospitalId) => {
  emit(["public"], "inventory:changed", { hospitalId });
};

export const notifyAudit = () => {
  emit(["admin"], "audit:new", {});
};
