import { OperonMark, OperonWordmark } from "@/components/brand"

export default function Header() {
  return (
    <div className="flex w-full items-center justify-between px-4">
      <div className="flex items-center gap-2 px-2 py-1">
        <OperonMark className="h-8 w-8" />
        <OperonWordmark height={16} />
      </div>
    </div>
  )
}