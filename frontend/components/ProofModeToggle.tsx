"use client"

import { Shield, Sparkles, Wifi, WifiOff } from "lucide-react"
import { Switch } from "./ui/switch"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"

interface ProofModeToggleProps {
  isProofMode: boolean
  onToggle: (value: boolean) => void
  isChatMode?: boolean
  backendConnected?: boolean | null
}

export function ProofModeToggle({
  isProofMode,
  onToggle,
  isChatMode = false,
  backendConnected,
}: ProofModeToggleProps) {

  return (
    <div className={`fixed ${isChatMode ? 'top-6 right-6' : 'bottom-6 right-6'} z-20`}>
      <div className="flex flex-col items-end gap-4">
        {/* Logo and Status - only show when not in chat mode */}
        {!isChatMode && (
          <div className="flex items-center gap-4 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 border border-border/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm text-foreground">PerFlexity</span>
            </div>

            {/* Backend Status */}
            {backendConnected !== null && (
              <Badge variant={backendConnected ? "default" : "destructive"} className="text-xs">
                {backendConnected ? (
                  <>
                    <Wifi className="w-3 h-3 mr-1" />
                    Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 mr-1" />
                    Offline
                  </>
                )}
              </Badge>
            )}
          </div>
        )}

        {/* Proof Mode Toggle */}
        <div className="flex items-center gap-3 bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 border border-border/50">
          <Shield className={`w-4 h-4 ${isProofMode ? "text-primary" : "text-muted-foreground"}`} />
          <Label htmlFor="proof-mode" className="text-sm cursor-pointer">
            Proof Mode
          </Label>
          <Switch
            id="proof-mode"
            checked={isProofMode}
            onCheckedChange={onToggle}
            disabled={backendConnected === false}
          />
        </div>
      </div>
    </div>
  )
}
