"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MarkdownViewerProps {
  markdown: string | null;
}

export function MarkdownViewer({ markdown }: MarkdownViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!markdown) return null;

  return (
    <div className="glass-card mt-6 overflow-hidden flex flex-col w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 px-6 py-4 border-b border-white/10 flex justify-between items-center hover:bg-white/10 transition-colors"
      >
        <span className="flex items-center text-lg font-semibold text-blue-300">
          <FileText className="w-5 h-5 mr-3 text-blue-400" />
          View Parsed Markdown
        </span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-white/50" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/50" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-black/40 overflow-y-auto max-h-[500px]">
              <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap break-words">
                {markdown}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
