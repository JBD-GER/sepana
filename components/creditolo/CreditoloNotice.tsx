import { CREDITOLO_INTAKE_NOTICE } from "@/lib/creditolo/notice"

export default function CreditoloNotice() {
  return (
    <p className="my-3 text-sm leading-relaxed text-slate-600">
      {CREDITOLO_INTAKE_NOTICE}{" "}
      <a href="https://www.creditolo.de/datenschutz/" target="_blank" rel="noreferrer" className="underline">
        Datenschutz bei Creditolo
      </a>
    </p>
  )
}
