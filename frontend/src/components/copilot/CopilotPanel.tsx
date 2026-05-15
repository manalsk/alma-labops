'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bot, Send, X, ChevronDown, AlertCircle, Loader2, Database,
} from 'lucide-react';
import { useCopilot } from '@/hooks/useCopilot';
import type { CopilotMessage, Role } from '@/types';

const SUGGESTED_PROMPTS: Record<Role, string[]> = {
  pi: [
    'What needs my attention today?',
    'Which items are out of stock?',
    'What purchase requests are pending approval?',
    'Show overdue tasks',
  ],
  researcher: [
    'Which items are critically low stock?',
    'What packages need review?',
    'What purchase requests are pending?',
    'Show my open tasks',
  ],
  student: [
    'What tasks are assigned to me?',
    'Which items are low stock?',
    'What items does the lab currently have?',
  ],
};

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-2xl rounded-tr-sm bg-teal-600 text-white px-4 py-2.5 max-w-[85%]">
        <p className="text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: CopilotMessage }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        {msg.was_refused ? (
          <div className="inline-flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 max-w-full">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">{msg.content}</p>
          </div>
        ) : (
          <div className="rounded-xl rounded-tl-sm bg-white border border-slate-200 px-3 py-2.5">
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
        )}
        {msg.context_sources && msg.context_sources.length > 0 && !msg.was_refused && (
          <button
            onClick={() => setSourcesOpen((o) => !o)}
            className="mt-1.5 ml-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Database className="w-3 h-3" />
            {msg.context_sources.join(', ')}
            <ChevronDown className={`w-3 h-3 transition-transform ${sourcesOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
        {sourcesOpen && msg.context_sources && (
          <div className="mt-1 ml-1 flex flex-wrap gap-1">
            {msg.context_sources.map((src) => (
              <span key={src} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {src}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  role: Role;
}

export function CopilotPanel({ role }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { askQuestion } = useCopilot();

  const hideOnKB =
    pathname?.startsWith('/knowledge-base') ||
    pathname?.startsWith('/audit-logs') ||
    pathname?.startsWith('/settings') ||
    false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await askQuestion(q);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.answer,
          was_refused: res.was_refused,
          context_sources: res.context_sources,
          tokens_used: res.tokens_used,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'An error occurred. Please try again.',
          was_refused: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const prompts = SUGGESTED_PROMPTS[role] ?? SUGGESTED_PROMPTS.researcher;

  if (hideOnKB) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 shadow-lg transition-all hover:shadow-xl text-sm font-medium"
        >
          <Bot className="w-4 h-4" />
          Ask ALMA
        </button>
      )}

      {/* Slide-over panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 z-50 w-100 bg-white border-l border-slate-200 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Operational Copilot</p>
                  <p className="text-xs text-slate-400">Grounded in live lab data</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-6">
                  <Bot className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-500 font-medium">Operational assistant</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-65">
                    Ask about inventory, tasks, packages, or procurement — answers are grounded in live lab data.
                  </p>

                  {/* Suggested prompts */}
                  <div className="mt-5 flex flex-col gap-1.5 w-full">
                    {prompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-left text-xs text-slate-600 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-lg px-3 py-2 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) =>
                msg.role === 'user'
                  ? <UserBubble key={msg.id} content={msg.content} />
                  : <AssistantBubble key={msg.id} msg={msg} />
              )}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <div className="rounded-xl rounded-tl-sm bg-white border border-slate-200 px-3 py-2.5">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggested prompts (after first message) */}
            {messages.length > 0 && !loading && (
              <div className="px-4 py-2 border-t border-slate-100 flex gap-1.5 overflow-x-auto">
                {prompts.slice(0, 3).map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="shrink-0 text-xs bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-100 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about inventory, tasks, packages…"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 max-h-28 overflow-y-auto"
                  style={{ minHeight: '42px' }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                  className="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
