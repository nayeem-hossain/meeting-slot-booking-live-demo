import { PrismaClient, Role } from "../../backend/src/generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const modPassword = await bcrypt.hash("Mod12345!", 10);
  const userPassword = await bcrypt.hash("User12345!", 10);

  await prisma.user.upsert({
    where: { email: "admin@meeting.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@meeting.local",
      passwordHash: adminPassword,
      role: Role.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "moderator@meeting.local" },
    update: {},
    create: {
      name: "Moderator",
      email: "moderator@meeting.local",
      passwordHash: modPassword,
      role: Role.MODERATOR
    }
  });

  await prisma.user.upsert({
    where: { email: "user@meeting.local" },
    update: {},
    create: {
      name: "User",
      email: "user@meeting.local",
      passwordHash: userPassword,
      role: Role.USER
    }
  });

  await prisma.room.createMany({
    data: [
      {
        name: "Conference A",
        capacity: 10,
        features: ["TV", "Projector"],
        hourlyRate: 60
      },
      {
        name: "Conference B",
        capacity: 6,
        features: ["TV"],
        hourlyRate: 40
      }
    ],
    skipDuplicates: true
  });
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
