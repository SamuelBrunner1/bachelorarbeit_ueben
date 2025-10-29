"use client";
import { useState, useEffect, useRef, ReactNode } from "react";

interface Message {
  sender: string;
  text: string | ReactNode;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 🟦 Begrüßung beim Start – wie bei Magenta, aber in Blau
  useEffect(() => {
    setMessages([
      {
        sender: "Bot",
        text: (
          <div className="leading-snug animate-fadeIn">
            <span className="text-blue-600 font-bold text-3xl">Hallo,</span>
            <br />
            <span className="text-gray-900 text-2xl font-semibold">
              wie kann ich Ihnen heute helfen?
            </span>
          </div>
        ),
      },
    ]);
  }, []);

  // 📜 Scroll automatisch ans Ende bei neuer Nachricht
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✉️ Nachricht senden
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { sender: "Du", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      const botMessage = { sender: "Bot", text: data.reply || "..." };
      await new Promise((r) => setTimeout(r, 600)); // kleine Tippverzögerung
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
<div
  className="flex flex-col h-screen bg-[#fafafa] text-gray-800 p-6 md:p-8 transition-all duration-500"
  style={{ minHeight: "100vh" }}

>


      {/* HEADER – minimalistisch */}
      <div className="flex items-center justify-between mb-2">
        
        <button
          onClick={() => window.history.back()}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition"
        >
          
        </button>
      </div>

      {/* CHAT-BEREICH */}
      <div
        className="flex-1 overflow-y-auto mb-4 space-y-4 p-2 scroll-smooth transition-all duration-300"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === "Du" ? "justify-end" : "justify-start"}`}>
            <div
              className={`px-5 py-3 rounded-2xl max-w-[85%] text-[17px] leading-relaxed shadow-sm transition-all duration-200 ${
                m.sender === "Du"
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-none shadow-md"
                  : "bg-white/80 text-gray-800 backdrop-blur-sm rounded-bl-none shadow-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Tipp-Animation */}
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

      {/* EINGABE-FELD */}
      <div
        className="flex items-center bg-white/90 backdrop-blur-md border border-gray-200 
                   rounded-full overflow-hidden shadow-md focus-within:ring-2 focus-within:ring-blue-400 transition-all duration-300"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Nachricht eingeben..."
          className="flex-1 bg-transparent px-5 py-3 text-gray-700 text-[16px] focus:outline-none"
        />

        <button
          onClick={sendMessage}
          className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 
                     text-white px-6 py-3 font-semibold transition-all duration-300 active:scale-95"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

/* 🔹 Kleine Fade-In Animation */
