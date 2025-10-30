import amqp from "amqplib";

const defaultRoomResolvers = {
  "restaurant.created": (payload) => {
    const rooms = ["admin:restaurants", "catalog:restaurants"];
    const restaurantId = payload?.restaurant?.id;
    if (restaurantId) {
      rooms.push(`restaurant:${restaurantId}`);
    }
    const ownerUserId = payload?.ownerUserId || payload?.restaurant?.owner_id;
    if (ownerUserId) {
      rooms.push(`restaurant-owner:${ownerUserId}`);
    }
    return rooms;
  },
  "restaurant.branch.created": (payload) => {
    const rooms = [];
    const restaurantId = payload?.restaurantId || payload?.branch?.restaurant_id;
    if (restaurantId) {
      rooms.push(`restaurant:${restaurantId}`);
    }
    const branchId = payload?.branch?.id || payload?.branchId;
    if (branchId) {
      rooms.push(`restaurant-branch:${branchId}`);
    }
    return rooms;
  },
  "restaurant.branch.schedules.updated": (payload) => {
    const rooms = [];
    if (payload?.restaurantId) {
      rooms.push(`restaurant:${payload.restaurantId}`);
    }
    if (payload?.branchId) {
      rooms.push(`restaurant-branch:${payload.branchId}`);
    }
    return rooms;
  },
  "restaurant.member.invited": (payload) => {
    const rooms = [];
    if (payload?.restaurantId) {
      rooms.push(`restaurant:${payload.restaurantId}`);
    }
    return rooms;
  },
  "menu.category.created": (payload) => {
    if (payload?.restaurantId) {
      return [`restaurant:${payload.restaurantId}`];
    }
    return [];
  },
  "menu.product.created": (payload) => {
    if (payload?.restaurantId) {
      return [`restaurant:${payload.restaurantId}`];
    }
    return [];
  },
  "menu.option-group.created": (payload) => {
    if (payload?.restaurantId) {
      return [`restaurant:${payload.restaurantId}`];
    }
    return [];
  },
  "menu.combo.created": (payload) => {
    if (payload?.restaurantId) {
      return [`restaurant:${payload.restaurantId}`];
    }
    return [];
  },
  "menu.promotion.created": (payload) => {
    const rooms = [];
    if (payload?.restaurantId) {
      rooms.push(`restaurant:${payload.restaurantId}`);
    }
    return rooms;
  },
  "owner.registration.submitted": () => ["admin:restaurants"],
  "owner.email.verified": (payload) => (payload?.ownerId ? [`restaurant-owner:${payload.ownerId}`] : []),
  "owner.approved": (payload) => {
    const rooms = ["admin:restaurants"];
    if (payload?.ownerId) {
      rooms.push(`restaurant-owner:${payload.ownerId}`);
    }
    return rooms;
  },
  "owner.rejected": () => ["admin:restaurants"],
  "catalog.tax.template.created": () => ["admin:catalog"],
  "catalog.calendar.created": () => ["admin:catalog"],
  "catalog.tax.assignment.created": (payload) => {
    const rooms = ["admin:catalog"];
    if (payload?.restaurantId) {
      rooms.push(`restaurant:${payload.restaurantId}`);
    }
    if (payload?.branchId) {
      rooms.push(`restaurant-branch:${payload.branchId}`);
    }
    return rooms;
  },
};

function resolveRooms(event, messageRooms, payload) {
  if (Array.isArray(messageRooms) && messageRooms.length) {
    return messageRooms.filter(Boolean);
  }
  const resolver = defaultRoomResolvers[event];
  if (!resolver) {
    return [];
  }
  const resolved = resolver(payload);
  return Array.isArray(resolved) ? resolved.filter(Boolean) : [];
}

export async function connectRabbitMQ(io) {
  try {
    const url = process.env.RABBITMQ_URL;
    const queue = process.env.RABBITMQ_QUEUE || "socket_events";
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });

    console.log(`[socket-gateway] listening to queue: ${queue}`);

    channel.consume(queue, (msg) => {
      if (!msg) {
        return;
      }
      try {
        const data = JSON.parse(msg.content.toString());
        dispatchEvent(io, data);
      } catch (err) {
        console.error("[socket-gateway] failed to process message", err);
      } finally {
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("[socket-gateway] RabbitMQ error:", error);
  }
}

function dispatchEvent(io, message) {
  if (!message || typeof message !== "object") {
    io.emit("server-event", message);
    return;
  }

  const { event, payload, rooms } = message;
  if (!event) {
    io.emit("server-event", message);
    return;
  }

  const targetRooms = resolveRooms(event, rooms, payload);
  if (targetRooms.length > 0) {
    console.log(
      `[socket-gateway] dispatching ${event} -> ${targetRooms.join(", ")}`,
    );
    targetRooms.forEach((room) => io.to(room).emit(event, payload));
    return;
  }

  console.log(`[socket-gateway] broadcasting ${event}`);
  io.emit(event, payload);
}
