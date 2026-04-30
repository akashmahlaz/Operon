// Jab AI koi tool/function use kare tab yeh dikhta hai

export default function ToolPart({ tool }: { tool: any }) {
  const { toolName, state } = tool.toolInvocation;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/3 border border-white/10 w-fit">

      {/* Tool chal raha hai → spinner. Ho gaya → green dot */}
      {state === 'call' ? (
        <div className="w-3 h-3 rounded-full border border-white/20 border-t-white/60 animate-spin" />
      ) : (
        <div className="w-3 h-3 rounded-full bg-green-400/30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        </div>
      )}

      <span className="text-xs font-mono text-white/40">
        {state === 'call' ? `Running ${toolName}...` : `Used ${toolName}`}
      </span>

    </div>
  );
}