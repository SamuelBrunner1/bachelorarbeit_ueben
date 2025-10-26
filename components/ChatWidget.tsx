"use client";
import { useState } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="chat-toggle fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white 
                   p-4 rounded-full shadow-lg transition z-50"
      >
        💬
      </button>

      {/* Popup */}
      {open && (
        <div className="fixed bottom-20 right-6 bg-white rounded-2xl shadow-2xl w-96 h-[550px] flex flex-col z-50">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-blue-600 text-white rounded-t-2xl">
            <h3 className="font-semibold">ImmoBot</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Chatbereich */}
          <iframe
            src="/chatbot"
            className="w-full h-full border-0 rounded-b-2xl bg-white"
          ></iframe>
        </div>
      )}
    </>
  );
}
