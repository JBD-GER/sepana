export type Role = "customer" | "advisor" | "admin" | "tipgeber" | "insurance"

export function isRole(value: unknown): value is Role {
  return value === "customer" || value === "advisor" || value === "admin" || value === "tipgeber" || value === "insurance"
}
