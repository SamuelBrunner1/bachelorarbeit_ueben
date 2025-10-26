"use client";
import { useState } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition z-50"
      >
        💬
      </button>

      {/* Popup */}
      {open && (
        <div className="fixed bottom-20 right-6 bg-white rounded-2xl shadow-2xl w-96 h-[550px] flex flex-col z-50">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">ImmoBot</h3>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          {/* Chatbereich */}
          <iframe
            src="/chatbot"
            className="w-full h-full border-0 rounded-b-2xl"
          ></iframe>
        </div>
      )}
    </>
  );
}
