"use client"

import type React from "react"
import { useState } from "react"
import { Search, Sparkles, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Alert, AlertDescription } from "./ui/alert"

interface HomeScreenProps {
  onSearch: (query: string) => void
  backendConnected: boolean | null
}

export function HomeScreen({ onSearch, backendConnected }: HomeScreenProps) {
  const [query, setQuery] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() && backendConnected !== false) {
      onSearch(query)
    }
  }

  const suggestedQueries = [
    "What are the latest developments in AI?",
    "How does renewable energy work?",
    "Explain quantum computing simply",
    "What's new in space exploration?",
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Backend Status */}
        {backendConnected !== null && (
          <div className="mb-6">
            <Alert
              className={
                backendConnected
                  ? "border-green-200 bg-green-50 dark:bg-green-950"
                  : "border-red-200 bg-red-50 dark:bg-red-950"
              }
            >
              {backendConnected ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription
                className={backendConnected ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}
              >
                {backendConnected
                  ? "Connected to backend server"
                  : "Backend server not available. Please start your Python backend."}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Logo/Title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-primary mr-3" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              PerFlexity
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">Ask anything, get instant answers with sources</p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="relative mb-8">
          <div className="relative group">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={backendConnected === false ? "Backend not available..." : "Ask me anything..."}
              className="w-full h-14 px-6 pr-16 rounded-xl border-2 bg-background/80 backdrop-blur-sm transition-all duration-300 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 shadow-lg group-hover:shadow-xl"
              disabled={backendConnected === false}
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-2 top-2 h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 transition-all duration-200"
              disabled={!query.trim() || backendConnected === false}
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </form>

        {/* Suggested Queries */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center mb-4">Try asking:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestedQueries.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setQuery(suggestion)}
                disabled={backendConnected === false}
                className="p-4 text-left rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card hover:border-border transition-all duration-200 hover:shadow-md group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm text-foreground/80 group-hover:text-foreground">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
