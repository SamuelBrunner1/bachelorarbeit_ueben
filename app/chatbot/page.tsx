"use client";
import { useState, useEffect, useRef } from "react";

export default function ChatbotPage() {
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Begrüßung beim Start
  useEffect(() => {
    setMessages([{ sender: "Bot", text: "👋 Hallo! Wie kann ich Ihnen helfen?" }]);
  }, []);

  // Automatisch nach unten scrollen bei neuer Nachricht
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keyboard-Erkennung (Mobile)
  useEffect(() => {
    const handleResize = () => {
      // Prüft, ob sich das Fenster durch die Tastatur sichtbar verkleinert hat
      if (window.innerHeight < document.documentElement.clientHeight - 150) {
        setKeyboardVisible(true);
      } else {
        setKeyboardVisible(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Nachricht senden
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { sender: "Du", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      const botMessage = { sender: "Bot", text: data.reply || "..." };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "Bot", text: "⚠️ Der Chatbot ist momentan nicht erreichbar." },
      ]);
    }
  };

  return (
    <div
      className={`flex flex-col h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100 
                  text-gray-800 p-4 rounded-b-2xl transition-all duration-300
                  ${keyboardVisible ? "pb-24" : "pb-6"}`}
      style={{ minHeight: "100vh" }}
    >
      {/* Nachrichtenbereich */}
      <div
        className="flex-1 overflow-y-auto mb-4 space-y-3 p-3 sm:p-4
                   bg-white/80 backdrop-blur-md border border-gray-200
                   rounded-2xl shadow-inner scroll-smooth"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.sender === "Du" ? "justify-end" : "justify-start"}`}
          >
         <div
className={`px-5 py-3 rounded-2xl text-[16px] md:text-[15px] leading-[1.5] tracking-wide max-w-[80%] shadow-sm ${
    m.sender === "Du"
      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-none shadow-md"
      : "bg-gray-100 text-gray-800 rounded-bl-none shadow-inner"
  }`}
>
  {m.text}
</div>

          </div>
        ))}
        {/* Scroll-Anker */}
        <div ref={messagesEndRef} />
      </div>

      {/* Eingabebereich */}
      <div
        className="flex items-center bg-white border border-gray-200
                   rounded-full overflow-hidden shadow-md p-[2px]
                   transition-all duration-300"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Nachricht eingeben..."
          className="flex-1 bg-transparent px-4 py-3 text-[17px] md:text-[15px]
                     text-gray-700 focus:outline-none"
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white
                     px-5 py-3 font-medium transition rounded-full
                     active:scale-95"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
