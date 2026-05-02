import {Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { OperonMark } from "@/components/brand"

export default function Header(){
    return(
    <div className='w-full flex items-center justify-between px-4'>
      <div className='flex px-2 py-1'>
        <OperonMark className="h-8 w-8" />
      </div>
      <div className="flex px-2 py-1 justify-center items-center">
        <Button className="rounded-2xl ">Connect whatsapp<span className=""><ArrowRight className=""/></span></Button>
      </div>
    </div>
    )
}