'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RAGResponse, RAGSource } from '@/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGSource[];
  was_refused?: boolean;
  tokens_used?: number | null;
}

interface Props {
  onAsk: (question: string) => Promise<RAGResponse>;
}

function SourceList({ sources }: { sources: RAGSource[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;
  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 font-medium transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {sources.length} source{sources.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-medium text-slate-700 mb-1">
                {s.document_title}
                <span className="ml-1.5 text-slate-400 font-normal">
                  (chunk {s.chunk_index} · {(s.similarity * 100).toFixed(0)}% match)
                </span>
              </p>
              <p className="text-slate-500 leading-relaxed line-clamp-3">{s.excerpt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-teal-600" />
      </div>
      <div className="flex-1 min-w-0">
        {msg.was_refused ? (
          <div className="inline-flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{msg.content}</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            {msg.sources && <SourceList sources={msg.sources} />}
          </div>
        )}
        {msg.tokens_used != null && (
          <p className="text-xs text-slate-400 mt-1 ml-1">{msg.tokens_used} tokens</p>
        )}
      </div>
    </div>
  );
}

export function RAGPanel({ onAsk }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await onAsk(question);
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        was_refused: res.was_refused,
        tokens_used: res.tokens_used,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'An error occurred while querying the knowledge base. Please try again.',
        was_refused: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-800">ALMA Knowledge Assistant</h3>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Answers are grounded only in your approved KB documents.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Bot className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400 font-medium">Ask about your lab protocols</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Try "What are the biohazard waste disposal steps?" or "How do I submit a procurement request?"
            </p>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="flex justify-end">
              <div className="rounded-xl bg-teal-600 text-white px-4 py-2.5 max-w-[80%]">
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ) : (
            <AssistantMessage key={msg.id} msg={msg} />
          )
        )}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-teal-600" />
            </div>
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about lab protocols…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 max-h-32 overflow-y-auto"
            style={{ minHeight: '42px' }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-10 px-3 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 ml-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
