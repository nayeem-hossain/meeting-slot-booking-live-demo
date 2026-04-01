declare module "@prisma/client" {
  export type Role = "ADMIN" | "MODERATOR" | "USER";
  export const Role: {
    ADMIN: Role;
    MODERATOR: Role;
    USER: Role;
  };

  export type BookingStatus = "ACTIVE" | "CANCELLED";
  export const BookingStatus: {
    ACTIVE: BookingStatus;
    CANCELLED: BookingStatus;
  };
}
