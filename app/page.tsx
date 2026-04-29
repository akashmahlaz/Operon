'use client';

import Header from '@/components/chat/Header';
import Input from '@/components/chat/input';
import Message from '@/components/chat/Message';


export default function Chat(){
 return(
  <div className='min-h-screen flex items-center justify-center'>
    <div className='w-full min-h-screen flex flex-col justify-between border border-white/10'>
     {/* Header */}
     <Header/>
     {/* {Message} */}
     <Message/>
     {/* input */}
     <Input/>
    </div>
  </div>
 )
}
