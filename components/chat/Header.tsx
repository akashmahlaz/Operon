import {Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Image from "next/image"

export default function Header(){
    return(
    <div className='w-full bg-gray-800 flex items-center justify-between px-4'>
      <div className='flex px-2 py-1 bg-green-400 '>
        <Image src={"/globe.svg"} alt='Logo' width={100} height={100} className="h-8 w-8 rounded-2xl bg-white"/>
      </div>
      <div className="flex px-2 py-1 justify-center items-center">
        <Button className="rounded-2xl ">Connect whatsapp<span className=""><ArrowRight className=""/></span></Button>
      </div>
    </div>
    )
}