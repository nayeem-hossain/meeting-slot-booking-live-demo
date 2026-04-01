import { PrismaClient, Role } from "../../backend/src/generated/prisma/index.js";
import bcrypt from "../../backend/node_modules/bcryptjs/index.js";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const modPassword = await bcrypt.hash("Mod12345!", 10);
  const userPassword = await bcrypt.hash("User12345!", 10);

  await prisma.user.upsert({
    where: { email: "admin@meeting.local" },
    update: {
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: adminPassword
    },
    create: {
      name: "Admin",
      email: "admin@meeting.local",
      passwordHash: adminPassword,
      role: Role.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "moderator@meeting.local" },
    update: {
      name: "Moderator",
      role: Role.MODERATOR,
      passwordHash: modPassword
    },
    create: {
      name: "Moderator",
      email: "moderator@meeting.local",
      passwordHash: modPassword,
      role: Role.MODERATOR
    }
  });

  await prisma.user.upsert({
    where: { email: "user@meeting.local" },
    update: {
      name: "User",
      role: Role.USER,
      passwordHash: userPassword
    },
    create: {
      name: "User",
      email: "user@meeting.local",
      passwordHash: userPassword,
      role: Role.USER
    }
  });

  const rooms = [
    {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Orion Boardroom",
      capacity: 12,
      features: ["TV", "Projector", "Speaker", "Conference Mics"],
      hourlyRate: 95
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      name: "Atlas Strategy Room",
      capacity: 8,
      features: ["TV", "Speaker", "Whiteboard"],
      hourlyRate: 70
    },
    {
      id: "20000000-0000-4000-8000-000000000003",
      name: "Nova Conference Hall",
      capacity: 20,
      features: ["Projector", "Conference Mics", "Speaker", "Video Bar"],
      hourlyRate: 130
    },
    {
      id: "20000000-0000-4000-8000-000000000004",
      name: "Focus Pod 1",
      capacity: 4,
      features: ["TV", "No Conference Mics"],
      hourlyRate: 35
    },
    {
      id: "20000000-0000-4000-8000-000000000005",
      name: "Focus Pod 2",
      capacity: 4,
      features: ["TV", "No Conference Mics", "Speaker"],
      hourlyRate: 38
    },
    {
      id: "20000000-0000-4000-8000-000000000006",
      name: "Harbor Meeting Suite",
      capacity: 10,
      features: ["Projector", "TV", "Speaker", "Conference Mics"],
      hourlyRate: 88
    },
    {
      id: "20000000-0000-4000-8000-000000000007",
      name: "Summit Collaboration Room",
      capacity: 14,
      features: ["TV", "Speaker", "Interactive Display"],
      hourlyRate: 102
    },
    {
      id: "20000000-0000-4000-8000-000000000008",
      name: "Pulse Huddle Space",
      capacity: 6,
      features: ["TV", "No Conference Mics", "Whiteboard"],
      hourlyRate: 48
    }
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { id: room.id },
      update: {
        name: room.name,
        capacity: room.capacity,
        features: room.features,
        hourlyRate: room.hourlyRate
      },
      create: room
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
