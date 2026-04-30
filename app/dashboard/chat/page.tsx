'use client';

import Header from '@/components/chat/Header';
import Input from '@/components/chat/ai-input/input';
import Message from '@/components/chat/message/messege';

export default function Chat(){
 return(
  <div className='min-h-screen w-full flex flex-col'>
   <Header/>
   <Message/>
   <Input/>
  </div>
 )
}
