"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, X, Beaker, Play } from "lucide-react";
import { CSVExporter } from "./CSVExporter";

export function SidebarDataModeler({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [dummyJson, setDummyJson] = useState<string>("");
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    setError(null);
    if (!dummyJson.trim()) {
        setParsedData(null);
        return;
    }
    try {
        const parsed = JSON.parse(dummyJson);
        // ensure it's an array for the exporter, or wrap it
        const arrayData = Array.isArray(parsed) ? parsed : [parsed];
        setParsedData(arrayData);
    } catch (err) {
        setError("Invalid JSON format. Please check your syntax.");
    }
  };

  const loadExample = () => {
      const example = {
        BenefitPlanName: "Signature Blue",
        Deductible: {
            Applicable: true,
            ServicesCoveredBeforeDeductible: "Preventive Care"
        },
        OutpatientServices: [
            { Service: "Primary care visit", NetworkCost: "$40 Copayment", NonNetworkCost: "60% Coinsurance" },
            { Service: "Specialist Visit", NetworkCost: "$80 Copayment", NonNetworkCost: "60% Coinsurance" }
        ]
      };
      setDummyJson(JSON.stringify(example, null, 2));
      setParsedData(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-2xl bg-gray-900 border-l border-white/10 shadow-2xl z-50 overflow-y-auto flex flex-col"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Database className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold">CSV Data Modeler</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-6 flex-1 flex flex-col gap-6">
                <div>
                   <div className="flex justify-between items-end mb-2">
                       <h3 className="text-sm font-semibold text-white/70">Paste Dummy JSON</h3>
                       <button onClick={loadExample} className="text-xs text-blue-400 hover:text-blue-300 flex items-center">
                           <Beaker className="w-3 h-3 mr-1" /> Load Example
                       </button>
                   </div>
                   <textarea 
                     value={dummyJson}
                     onChange={(e) => setDummyJson(e.target.value)}
                     className="glass-input h-64 font-mono text-sm resize-none whitespace-pre"
                     placeholder="{\n  'field': 'value'\n}"
                   />
                   {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                   
                   <button 
                     onClick={handleApply}
                     className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-colors shadow-lg"
                   >
                       <Play className="w-4 h-4 mr-2" />
                       Apply Data to Builder
                   </button>
                </div>

                {parsedData && (
                    <div className="mt-4 border-t border-white/10 pt-6">
                        <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            Mapping Preview Sandbox
                        </h3>
                        <CSVExporter data={parsedData} />
                    </div>
                )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
