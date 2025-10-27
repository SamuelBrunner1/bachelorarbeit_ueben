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
          {isMobile ? (
            <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200 shadow-sm bg-white/70 backdrop-blur">
                <div className="flex-1 text-center">
                  <h2 className="text-lg font-bold text-blue-700 tracking-wide">
                    ImmoBot
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                  aria-label="Chat schließen"
                >
                  ✕
                </button>
              </div>

              {/* Chat-Bereich */}
              <div className="flex-1 overflow-hidden bg-gradient-to-b from-white to-blue-50/50">
                <iframe
                  ref={iframeRef}
                  src="/chatbot"
                  className="w-full h-full border-0 text-[18px]"
                  style={{
                    height: "100%",
                    background: "linear-gradient(to bottom, white, #eff6ff)",
                  }}
                ></iframe>
              </div>
            </div>
          ) : (
            /* ✅ DESKTOP-POPUP */
            <div className="fixed bottom-20 right-6 bg-white rounded-2xl shadow-2xl w-96 h-[550px] flex flex-col z-50 animate-fadeIn">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white/70 backdrop-blur">
                <div className="flex-1 text-center">
                  <h3 className="font-semibold text-blue-700">ImmoBot</h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                  aria-label="Chat schließen"
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
