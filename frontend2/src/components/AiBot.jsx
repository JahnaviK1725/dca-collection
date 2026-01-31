import { useState, useEffect } from "react";
import Spline from "@splinetool/react-spline";

const AiBot = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [message, setMessage] = useState("System Online.");

  useEffect(() => {
    const insights = [
      "📢 Tip: Click 'Analytics' for charts.",
      "⚠️ Alert: 3 High Risk accounts.",
      "✅ Success: Payment from Costco.",
      "📉 Risk dropped by 12%."
    ];
    let i = 0;
    const interval = setInterval(() => {
      setMessage(insights[i]);
      i = (i + 1) % insights.length;
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        pointerEvents: 'none', 
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      
      {/* 💬 CHAT BUBBLE */}
      <div 
        className={`
            relative mb-2 text-center 
            pointer-events-auto transition-all duration-500 ease-in-out
            shadow-sm border border-blue-100
            ${isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"}
        `}
        style={{ 
            animation: 'float 4s ease-in-out infinite',
            backgroundColor: '#F0F9FF', 
            color: '#0c4a6e',           
            borderRadius: '16px',
            minWidth: '160px', 
            maxWidth: '200px',
            padding: '10px 14px', 
        }}
      >
           {/* 🟢 NEW GREETING LINE */}
           <div className="text-[12px] font-bold text-slate-800 mb-1">
             Hi, I'm Feddie! 👋
           </div>

           {/* HEADER ROW (Centered) */}
           <div className="flex items-center justify-center w-full mb-2">
             <div className="flex items-center gap-1.5 bg-blue-100/50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                <span className="text-[7px] font-extrabold uppercase tracking-widest text-blue-600 opacity-90 whitespace-nowrap">AI Insight</span>
             </div>
           </div>

           {/* Message Body */}
           <p className="text-[10px] font-medium leading-relaxed text-slate-600">
             {message}
           </p>

           {/* 👇 The Tail */}
           <div 
             style={{ 
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translate(-50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                backgroundColor: '#F0F9FF', 
                borderBottom: '1px solid #e0f2fe',
                borderRight: '1px solid #e0f2fe',
                borderRadius: '0 0 1px 0',
             }}
           ></div>
      </div>

      {/* 🤖 ROBOT CONTAINER */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="group hover:scale-105 transition-transform duration-300"
        style={{
          width: '180px',    
          height: '180px',   
          cursor: 'pointer',
          pointerEvents: 'auto',
          position: 'relative',
          overflow: 'hidden', 
          borderRadius: '50%',
        }}
      >
        {/* 🔍 ZOOM WRAPPER */}
        <div style={{
            position: 'absolute',
            width: '170%',      
            height: '170%',
            top: '-35%',        
            left: '-35%',       
        }}>
            <Spline 
              scene="https://prod.spline.design/6gxFy1AjbR2-yc6w/scene.splinecode"
              style={{ 
                width: '100%', 
                height: '100%',
                backgroundColor: 'transparent', 
              }}
            />
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

    </div>
  );
};

export default AiBot;