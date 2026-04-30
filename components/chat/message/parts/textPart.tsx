// Sirf text bubble render karta hai — user ka aur AI ka alag style

export default function TextPart({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <div className={`
      px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
      ${isUser
        ? 'bg-green-400/15 text-white/90 rounded-tr-sm border border-green-400/20'
        : 'bg-white/5 text-white/80 rounded-tl-sm border border-white/10'
      }
    `}>
      {text}
    </div>
  );
}