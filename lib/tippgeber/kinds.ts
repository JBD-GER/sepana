export type TippgeberKind = "classic" | "private_credit"

export function normalizeTippgeberKind(value: unknown): TippgeberKind {
  return String(value ?? "").trim().toLowerCase() === "private_credit" ? "private_credit" : "classic"
}

export function tippgeberKindLabel(value: unknown) {
  return normalizeTippgeberKind(value) === "private_credit" ? "Privatkredit" : "Baufinanzierung"
}
