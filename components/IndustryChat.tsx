"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type ChatMode = "realestate" | "fitness";

interface Message {
  sender: string;
  text: string | ReactNode;
}

interface IndustryChatProps {
  title: string;
  mode: ChatMode;
  subtitle: string;
}

function buildGreeting(title: string, subtitle: string): ReactNode {
  return (
    <div className="leading-snug animate-fadeIn">
      <span className="text-blue-600 font-bold text-3xl">{title}</span>
      <br />
      <span className="text-gray-900 text-2xl font-semibold">{subtitle}</span>
    </div>
  );
}

export default function IndustryChat({ title, mode, subtitle }: IndustryChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([
      {
        sender: "Bot",
        text: buildGreeting(title, subtitle),
      },
    ]);
  }, [title, subtitle]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "Du", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`/api/chat?mode=${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      const botMessage = { sender: "Bot", text: data.reply || "..." };
      await new Promise((resolve) => setTimeout(resolve, 600));
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "Bot", text: "⚠️ Der Chatbot ist momentan nicht erreichbar." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#fafafa] text-gray-800 p-6 md:p-8 transition-all duration-500" style={{ minHeight: "100vh" }}>
      <div className="flex items-center justify-between mb-4">
      
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-2 scroll-smooth transition-all duration-300">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.sender === "Du" ? "justify-end" : "justify-start"}`}>
            <div
              className={`px-5 py-3 rounded-2xl max-w-[85%] text-[17px] leading-relaxed shadow-sm transition-all duration-200 whitespace-pre-wrap wrap-break-word ${
                message.sender === "Du"
                  ? "bg-linear-to-r from-blue-600 to-blue-500 text-white rounded-br-none shadow-md"
                  : "bg-white/80 text-gray-800 backdrop-blur-sm rounded-bl-none shadow-sm"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-4 py-3 bg-white/80 border border-gray-200 rounded-2xl rounded-bl-none shadow-sm">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.1s]"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex items-center bg-white/90 backdrop-blur-md border border-gray-200 rounded-full overflow-hidden shadow-md focus-within:ring-2 focus-within:ring-blue-400 transition-all duration-300">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && sendMessage()}
          placeholder={mode === "fitness" ? "Frage zu Training, Kursen oder Mitgliedschaften eingeben..." : "Nachricht eingeben..."}
          className="flex-1 bg-transparent px-5 py-3 text-gray-700 text-[16px] focus:outline-none"
        />

        <button
          onClick={sendMessage}
          className="bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-6 py-3 font-semibold transition-all duration-300 active:scale-95"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
