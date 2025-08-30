"use client"

import { useEffect, useState, useCallback } from "react"

export function BackgroundEffect() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Throttle mouse movement updates for better performance
  const throttledMouseUpdate = useCallback((e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleMouseMove = (e: MouseEvent) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => throttledMouseUpdate(e), 16) // ~60fps
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      clearTimeout(timeoutId)
    }
  }, [throttledMouseUpdate])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20" />

      {/* Animated gradient orbs - using CSS animations for better performance */}
      <div className="absolute inset-0">
        <div
          className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-primary/5 to-accent/5 blur-3xl"
          style={{
            left: "10%",
            top: "20%",
            animation: "float 6s ease-in-out infinite",
            willChange: "transform",
          }}
        />
        <div
          className="absolute w-80 h-80 rounded-full bg-gradient-to-r from-secondary/5 to-primary/5 blur-3xl"
          style={{
            right: "10%",
            bottom: "20%",
            animation: "float 8s ease-in-out infinite reverse",
            willChange: "transform",
          }}
        />
        <div
          className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-accent/5 to-secondary/5 blur-3xl"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            animation: "float 7s ease-in-out infinite",
            willChange: "transform",
          }}
        />
      </div>

      {/* Interactive cursor effect - optimized with will-change */}
      <div
        className="absolute w-32 h-32 rounded-full bg-gradient-to-r from-primary/3 to-transparent blur-2xl pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate(${mousePosition.x - 64}px, ${mousePosition.y - 64}px)`,
          willChange: "transform",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.5) 1px, transparent 0)
          `,
          backgroundSize: "24px 24px",
        }}
      />

      {/* CSS animations moved to a style tag for better performance */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px) rotate(0deg); 
          }
          33% { 
            transform: translateY(-20px) rotate(1deg); 
          }
          66% { 
            transform: translateY(10px) rotate(-1deg); 
          }
        }
      `}</style>
    </div>
  )
}
