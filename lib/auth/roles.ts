export type Role = "customer" | "advisor" | "admin"

export function isRole(value: unknown): value is Role {
  return value === "customer" || value === "advisor" || value === "admin"
}
