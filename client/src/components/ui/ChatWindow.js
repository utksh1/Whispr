"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

export function ChatWindow({ peer, messages, messageDraft, onMessageChange, onSendMessage, isBusy }) {
  const scrollRef = useRef(null);

  function formatMessageTime(message) {
    const timestamp = message.timestamp || message.createdAt || message.sentAt;
    if (!timestamp) {
      return "";
    }

    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="flex-1 flex flex-col bg-surface relative overflow-hidden">
      {/* Chat Header */}
      <div className="px-8 py-6 flex items-center justify-between z-10 bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
            {peer?.username?.[0]?.toUpperCase() || "W"}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface">{peer?.username || "Whispr"}</h2>
            <p className="text-sm text-on-surface-variant font-light">Quietly listening...</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button type="button" className="text-outline cursor-pointer hover:text-on-surface transition-colors" aria-label="Search conversation">
            <Icon name="search" className="text-2xl" />
          </button>
          <button type="button" className="text-outline cursor-pointer hover:text-on-surface transition-colors" aria-label="Conversation info">
            <Icon name="info" className="text-2xl" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 flex flex-col space-y-6"
      >
        <div className="flex justify-center my-4">
          <span className="text-xs uppercase tracking-widest text-on-surface-variant font-label">Conversation Secured</span>
        </div>

        {messages.map((msg, idx) => {
          const isSent = msg.sender === "me";
          return (
            <div 
              key={msg.id || idx}
              className={`flex items-start max-w-[80%] gap-4 ${isSent ? "ml-auto justify-end" : ""}`}
            >
              <div className={`rounded-3xl px-6 py-4 font-body leading-relaxed shadow-[0_5px_20px_rgba(48,51,51,0.02)] ${
                isSent 
                ? "bg-gradient-to-br from-primary to-primary-dim text-on-primary rounded-tr-sm" 
                : "bg-surface-container-high text-on-surface rounded-tl-sm"
              }`}>
                <p>{msg.plaintext || msg.content}</p>
                <span className={`text-[10px] mt-2 block opacity-60 ${isSent ? "text-primary-fixed text-right" : "text-on-surface-variant"}`}>
                  {formatMessageTime(msg)}
                  {msg.integrityStatus === "verified" && " ✓"}
                </span>
              </div>
            </div>
          );
        })}
        
        {isBusy && (
          <div className="flex items-start max-w-[80%] gap-4 mt-8 opacity-60">
            <div className="bg-surface-container-low rounded-full px-4 py-2 flex items-center gap-1 h-8">
              <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-pulse delay-75"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-pulse delay-150"></div>
            </div>
          </div>
        )}
      </div>

      {/* Message Input Area */}
      <form 
        onSubmit={onSendMessage}
        className="bg-surface z-10"
      >
        <div className="flex items-center gap-4 bg-surface px-6 py-4 border-t border-outline-variant/20 focus-within:bg-surface-container-low transition-all">
          <button type="button" className="text-outline cursor-pointer hover:text-on-surface transition-colors" aria-label="Add attachment">
            <Icon name="add" className="text-2xl" />
          </button>
          <input 
            className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface font-body placeholder:text-on-surface-variant/50" 
            placeholder="Whisper something..." 
            type="text"
            value={messageDraft}
            onChange={(e) => onMessageChange(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!messageDraft.trim() || isBusy}
            className="bg-primary hover:bg-primary-dim text-on-primary rounded-full w-10 h-10 flex items-center justify-center transition-colors shadow-[0_5px_15px_rgba(91,97,80,0.2)] disabled:opacity-50"
          >
            <Icon name="send" className="text-sm" />
          </button>
        </div>
      </form>
    </section>
  );
}
