"use client";
import { useState, useEffect, useRef } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 🕓 Dynamische Begrüßung
  useEffect(() => {
    const hour = new Date().getHours();
    // könnte später für dynamischen Text genutzt werden
  }, []);

  // 📱 Erkennen, ob das Gerät mobil ist
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ⬇️ Scrollt automatisch ans Ende, wenn Keyboard öffnet (Mobile)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleFocus = () => {
      if (window.innerWidth < 768) {
        iframe.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };

    window.addEventListener("focusin", handleFocus);
    return () => window.removeEventListener("focusin", handleFocus);
  }, []);

  return (
    <>
      {/* 💬 Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="chat-toggle fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl transition-all duration-300 z-50"
        >
          💬
        </button>
      )}

      {/* 🪟 Chatfenster */}
      {open && (
        <>
      {/* ✅ MOBILE-VOLLANSICHT */}
{/* ✅ MOBILE-VOLLANSICHT */}
{isMobile ? (
  <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn">
    {/* Header – sanfter blauer Verlauf wie Desktop-Version */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50/80 shadow-sm backdrop-blur-sm">
      <div className="flex-1 text-center relative">
        <h2 className="text-lg font-semibold text-gray-800 tracking-wide">
          ImmoBot
        </h2>
        {/* Blauer Akzentbalken unter Titel */}
        <span className="absolute -bottom-[2px] left-1/2 w-6 h-[2px] bg-blue-600 rounded-full -translate-x-1/2"></span>
      </div>

      <button
        onClick={() => setOpen(false)}
        className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition"
        aria-label="Chat schließen"
      >
        ✕
      </button>
    </div>

    {/* Chat-Bereich */}
    <div className="flex-1 overflow-hidden bg-gradient-to-b from-white to-blue-50/50">
      <iframe
        src="/chatbot"
        className="w-full h-full border-0"
        style={{
          height: "100%",
          background: "linear-gradient(to bottom, white, #eff6ff)",
        }}
      ></iframe>
    </div>
  </div>
) : (
  /* ✅ DESKTOP-POPUP */
<div className="fixed bottom-12 right-10 bg-white rounded-2xl shadow-2xl border border-gray-300/70 w-[520px] h-[720px] flex flex-col z-50 animate-fadeIn backdrop-blur-sm">
    {/* Header */}
<div className="flex justify-between items-center px-5 py-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50/80 shadow-sm">
  <div className="flex-1 text-center relative">
    <h2 className="text-lg font-semibold text-gray-800 tracking-wide">ImmoBot</h2>
    <span className="absolute -bottom-[2px] left-1/2 w-6 h-[2px] bg-blue-600 rounded-full -translate-x-1/2"></span>
  </div>
  <button
    onClick={() => setOpen(false)}
    className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition"
  >
    ✕
  </button>
</div>



    {/* Chat-Bereich */}
    <iframe
      src="/chatbot"
      className="w-full h-full border-0 rounded-b-2xl"
    ></iframe>
  </div>
)}

        </>
      )}
    </>
  );
}
