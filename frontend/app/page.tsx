"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, FileText, CheckCircle2, ChevronRight, Loader2, Database, Upload, FileJson, 
  Settings2, LayoutDashboard, FileCode2, TableProperties, Play, Beaker, Copy, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { CSVExporter } from "./components/CSVExporter";
import { SpreadsheetMapper } from "./components/SpreadsheetMapper";

type Tab = "parse" | "extract" | "mapping";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("parse");

  // Parse State
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isJsonCollapsed, setIsJsonCollapsed] = useState(true);
  const [isExtractedCollapsed, setIsExtractedCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract State
  const [schemaText, setSchemaText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const schemaInputRef = useRef<HTMLInputElement>(null);



  // Mapping state (dummy)
  const [dummyJson, setDummyJson] = useState<string>("");
  const [mappingData, setMappingData] = useState<any[] | null>(null);
  const [dummyError, setDummyError] = useState<string | null>(null);
  const [mappingMode, setMappingMode] = useState<"builder" | "spreadsheet">("spreadsheet");

  // Sync extraction -> mapping
  useEffect(() => {
     if (extractedData) {
         const arrayData = Array.isArray(extractedData) ? extractedData : [extractedData];
         setMappingData(arrayData);
         setDummyJson(JSON.stringify(arrayData, null, 2));
         setDummyError(null);
     }
  }, [extractedData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setParseResult(null);
      setExtractedData(null);
      setParseError(null);
      setExtractError(null);
    }
  };

  const handleSchemaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSchemaText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    
    setIsParsing(true);
    setParseError(null);
    
    const formData = new FormData();
    formData.append("document", file);
    
    try {
      const response = await axios.post("http://localhost:8080/api/parse", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setParseResult(response.data);
      setActiveTab("extract");
    } catch (error: any) {
      console.error("Parse Error:", error);
      setParseError(error.response?.data?.error || "An error occurred during parsing.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleExtract = async () => {
    if (!parseResult || !schemaText) return;
    
    setIsExtracting(true);
    setExtractError(null);
    
    let parsedSchema;
    try {
      parsedSchema = JSON.parse(schemaText);
    } catch (error) {
      setExtractError("Invalid JSON Schema format.");
      setIsExtracting(false);
      return;
    }
    try {
      const formData = new FormData();
      formData.append("schema", JSON.stringify(parsedSchema));
      formData.append("markdown", parseResult?.markdown ? parseResult.markdown : JSON.stringify(parseResult));

      const response = await axios.post("http://localhost:8080/api/extract", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      // Unwrap the "extraction" key if present
      const raw = response.data;
      const actual = raw?.extraction ? raw.extraction : raw;
      setExtractedData(actual);
      // Removed the auto-jump to "mapping" tab to allow user to view data directly
    } catch (error: any) {
      console.error("Extract Error:", error);
      setExtractError(error.response?.data?.error || "An error occurred during extraction.");
    } finally {
      setIsExtracting(false);
    }
  };



  const handleApplyDummyData = () => {
    setDummyError(null);
    if (!dummyJson.trim()) {
        setMappingData(null);
        return;
    }
    try {
        const parsed = JSON.parse(dummyJson);
        const arrayData = Array.isArray(parsed) ? parsed : [parsed];
        setMappingData(arrayData);
        // Do not overwrite actual extractedData so the original is preserved
    } catch (err) {
        setDummyError("Invalid JSON format. Please check your syntax.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0A0A0A] text-white">
      
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-black/40 border-r border-white/10 md:h-screen sticky top-0 flex flex-col pt-8 z-20">
         <div className="px-6 mb-8 flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
               <Database className="w-5 h-5 text-red-500" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">ADE Pipeline</h1>
         </div>

         <div className="flex-1 px-4 space-y-2">
            <button 
                onClick={() => setActiveTab("parse")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'parse' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
               <FileText className="w-5 h-5" />
               1. Parse Doc
            </button>
            <button 
                onClick={() => setActiveTab("extract")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'extract' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
               <FileJson className="w-5 h-5" />
               2. Extract Data
               {extractedData && <CheckCircle2 className="w-4 h-4 ml-auto text-green-400" />}
            </button>
            <button 
                onClick={() => setActiveTab("mapping")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'mapping' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
               <TableProperties className="w-5 h-5" />
               3. CSV Mapping
               {mappingData && <CheckCircle2 className="w-4 h-4 ml-auto text-green-400" />}
            </button>
         </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto w-full max-w-5xl mx-auto">
        
        {/* PARSE TAB */}
        <AnimatePresence mode="wait">
          {activeTab === "parse" && (
            <motion.div 
               key="parse-tab"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="flex flex-col gap-6"
            >
                <div className="glass-card p-8 flex flex-col">
                    <h2 className="text-2xl font-bold mb-2">Upload Document</h2>
                    <p className="text-white/50 mb-8">Convert PDFs or Images into clean, structured Markdown using Landing AI.</p>
                    
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[200px]
                        ${file ? 'border-green-500/50 bg-green-500/5' : 'border-white/20 hover:border-red-400/50 hover:bg-white/5'}`}
                    >
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".pdf,.png,.jpg,.jpeg" 
                            onChange={handleFileChange}
                        />
                        
                        {file ? (
                        <>
                            <FileText className="w-12 h-12 text-green-400 mb-4" />
                            <p className="font-semibold text-lg text-green-300">{file.name}</p>
                            <p className="text-sm text-gray-400 mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </>
                        ) : (
                        <>
                            <UploadCloud className="w-12 h-12 text-gray-500 mb-4" />
                            <p className="font-semibold text-lg mb-2">Click to select a file</p>
                            <p className="text-sm text-gray-400">Supports PDF, PNG, JPG</p>
                        </>
                        )}
                    </div>

                    <button 
                        onClick={handleParse} 
                        disabled={!file || isParsing || !!parseResult}
                        className="btn-primary w-full group mt-2 flex items-center justify-center !py-4"
                    >
                        {isParsing ? (
                        <><Loader2 className="w-5 h-5 mr-3 animate-spin"/> Parsing Document...</>
                        ) : parseResult ? (
                        <><CheckCircle2 className="w-5 h-5 mr-3 text-green-300"/> Parsed Successfully</>
                        ) : (
                        <>Parse Document <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"/></>
                        )}
                    </button>
                    
                    {parseError && (
                        <div className="p-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {parseError}
                        </div>
                    )}
                </div>

                {parseResult && (
                  <div className="glass-card overflow-hidden border border-white/10 mt-2">
                    <div className="bg-white/5 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors"
                         onClick={() => setIsJsonCollapsed(!isJsonCollapsed)}>
                       <h3 className="font-bold flex items-center text-white/90">
                          <FileCode2 className="w-5 h-5 mr-2 text-blue-400" /> 
                          Parsed API Response
                       </h3>
                       <div className="flex items-center gap-4">
                         <button 
                             onClick={(e) => {
                                 e.stopPropagation();
                                 navigator.clipboard.writeText(JSON.stringify(parseResult, null, 2));
                             }}
                             className="text-xs bg-white/10 text-white hover:bg-white/20 px-3 py-1.5 rounded flex items-center transition-colors shadow-none"
                         >
                             <Copy className="w-3 h-3 mr-1" /> Copy JSON
                         </button>
                         {isJsonCollapsed ? <ChevronDown className="w-5 h-5 text-white/50" /> : <ChevronUp className="w-5 h-5 text-white/50" />}
                       </div>
                    </div>
                    
                    <AnimatePresence>
                      {!isJsonCollapsed && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/10 overflow-hidden"
                        >
                          <div className="p-4 bg-black/80 overflow-y-auto max-h-[500px]">
                            <pre className="font-mono text-xs text-blue-300">
                                {JSON.stringify(parseResult, null, 2)}
                            </pre>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
            </motion.div>
          )}

          {/* EXTRACT TAB */}
          {activeTab === "extract" && (
            <motion.div 
               key="extract-tab"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="flex flex-col gap-6"
            >
                {!parseResult ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center border border-yellow-500/20">
                        <FileText className="w-12 h-12 text-yellow-500/50 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No Document Context</h3>
                        <p className="text-white/50 max-w-sm mb-6">You must successfully parse a document in the previous step before you can run an extraction.</p>
                        <button onClick={() => setActiveTab('parse')} className="text-sm bg-white/10 px-6 py-2 rounded-lg hover:bg-white/20 transition-colors">Go back to Parse</button>
                    </div>
                ) : (
                    <div className="glass-card p-8 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                             <div>
                                <h2 className="text-2xl font-bold mb-1">Define Schema</h2>
                                <p className="text-white/50 mb-6">Provide the JSON schema to extract structured objects.</p>
                             </div>
                             <div className="flex gap-2">
                                <label className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md flex items-center transition-colors cursor-pointer text-white/90">
                                    <Upload className="w-4 h-4 mr-2 text-white/70" /> Load Schema .json
                                    <input 
                                        type="file" 
                                        ref={schemaInputRef} 
                                        className="hidden" 
                                        accept=".json" 
                                        onChange={handleSchemaFileChange}
                                    />
                                </label>
                             </div>
                        </div>

                        <textarea 
                            value={schemaText}
                            onChange={(e) => setSchemaText(e.target.value)}
                            placeholder={'{\n  "type": "object",\n  "properties": {}\n}'}
                            className="glass-input flex-1 min-h-[300px] font-mono text-sm resize-y whitespace-pre"
                        />

                        <button 
                            onClick={handleExtract} 
                            disabled={!parseResult || !schemaText || isExtracting}
                            className={`btn-primary flex items-center justify-center w-full group mt-6 ${extractedData && !isExtracting ? 'bg-green-600 hover:bg-green-500 shadow-green-900/50' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'} !py-4`}
                        >
                            {isExtracting ? (
                            <><Loader2 className="w-5 h-5 mr-3 animate-spin"/> Processing Extraction...</>
                            ) : extractedData ? (
                            <><Database className="w-5 h-5 mr-3" /> Overwrite Extracted Data</>
                            ) : (
                            <><Database className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform"/> Run Extraction</>
                            )}
                        </button>

                        {extractError && (
                            <div className="p-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {extractError}
                            </div>
                        )}
                    </div>
                )}

                {/* Show raw JSON outcome in collapsible view */}
                {extractedData && (
                    <div className="glass-card overflow-hidden flex flex-col w-full border-green-500/20 border">
                        <div 
                            className="bg-green-500/10 px-6 py-4 border-b border-green-500/20 flex justify-between items-center cursor-pointer hover:bg-green-500/20 transition-colors"
                            onClick={() => setIsExtractedCollapsed(!isExtractedCollapsed)}
                        >
                            <h3 className="font-bold flex items-center text-green-300">
                                <CheckCircle2 className="w-5 h-5 mr-2" /> 
                                Extracted Data
                            </h3>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2))}
                                    className="text-xs bg-green-500/20 text-green-200 px-3 py-1.5 rounded-lg hover:bg-green-500/30 flex items-center transition-colors"
                                >
                                    <Copy className="w-3 h-3 mr-1" /> Copy JSON
                                </button>
                                <button onClick={() => setActiveTab('mapping')} className="text-xs bg-green-500/20 text-green-200 px-3 py-1.5 rounded-lg hover:bg-green-500/30 flex items-center transition-colors">
                                    Proceed to Map CSV <ChevronRight className="w-3 h-3 ml-1" />
                                </button>
                                <div 
                                    className="p-1 rounded-full hover:bg-white/10 ml-2 cursor-pointer transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setIsExtractedCollapsed(!isExtractedCollapsed); }}
                                >
                                    {isExtractedCollapsed ? <ChevronDown className="w-5 h-5 text-green-300/70" /> : <ChevronUp className="w-5 h-5 text-green-300/70" />}
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {!isExtractedCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 bg-black/60 overflow-y-auto max-h-[400px]">
                                        <pre className="font-mono text-xs text-white/70">
                                            {JSON.stringify(extractedData, null, 2)}
                                        </pre>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </motion.div>
          )}

          {/* MAPPING TAB */}
          {activeTab === "mapping" && (
            <motion.div 
               key="mapping-tab"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="flex flex-col gap-6"
            >
               <div className="glass-card p-8 flex flex-col border-purple-500/20">
                    <h2 className="text-2xl font-bold mb-1">CSV Modeler Sandbox</h2>
                    <p className="text-white/50 mb-6">Drag and construct the perfect CSV export. Supply custom dummy JSON if you'd like to test layouts independently.</p>
                    
                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/10 w-fit mb-6">
                        <button 
                            onClick={() => setMappingMode("spreadsheet")}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${mappingMode === "spreadsheet" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                        >
                            <TableProperties className="w-4 h-4 mr-2" /> Spreadsheet Mapper
                        </button>
                        <button 
                            onClick={() => setMappingMode("builder")}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${mappingMode === "builder" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                        >
                            <LayoutDashboard className="w-4 h-4 mr-2" /> Drag & Drop Builder
                        </button>
                    </div>

                    {mappingMode === "builder" ? (
                        <>
                            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
                                <div className="flex justify-between items-end mb-2">
                                   <h3 className="text-sm font-semibold text-white/70">Data Input Source</h3>
                                   <button 
                                     onClick={() => {
                                         const example = { BenefitPlanName: "Signature Blue", Nested: { Field: 1 }, MyArray: [{ A: 1, B: 2 }, { A: 3, B: 4 }] };
                                         setDummyJson(JSON.stringify(example, null, 2));
                                     }} 
                                     className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                                   >
                                       <Beaker className="w-3 h-3 mr-1" /> Inject Array Example
                                   </button>
                                </div>
                                <textarea 
                                    value={dummyJson}
                                    onChange={(e) => setDummyJson(e.target.value)}
                                    className="w-full bg-black/50 text-blue-200 font-mono text-xs p-4 rounded border border-white/5 resize-y focus:outline-none focus:border-white/20 min-h-[150px]"
                                    placeholder="Enter test JSON data here..."
                                />
                                {dummyError && <p className="text-red-400 text-xs mt-2">{dummyError}</p>}
                                
                                <div className="flex justify-end gap-3 mt-3">
                                    {extractedData && (
                                        <button 
                                          onClick={() => {
                                            const arrayData = Array.isArray(extractedData) ? extractedData : [extractedData];
                                            setMappingData(arrayData);
                                            setDummyJson(JSON.stringify(arrayData, null, 2));
                                            setDummyError(null);
                                          }}
                                          className="text-sm border border-white/10 px-4 py-2 hover:bg-white/5 rounded transition-colors"
                                        >
                                            Reset to Actual Extraction
                                        </button>
                                    )}
                                    <button 
                                        onClick={handleApplyDummyData}
                                        className="text-sm bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded flex items-center transition-colors font-medium shadow-lg shadow-purple-900/50"
                                    >
                                        <Play className="w-4 h-4 mr-2" />
                                        Apply to Builder
                                    </button>
                                </div>
                            </div>

                            {!mappingData || mappingData.length === 0 ? (
                                <div className="border border-white/5 rounded-xl bg-white/5 border-dashed p-10 text-center flex flex-col items-center">
                                    <TableProperties className="w-10 h-10 text-white/20 mb-3" />
                                    <p className="text-white/40">No valid data applied to the modeler yet. Apply a JSON object to begin.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <CSVExporter key={JSON.stringify(mappingData).length} data={mappingData} />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="relative">
                            {!mappingData || mappingData.length === 0 ? (
                                <div className="border border-white/5 rounded-xl bg-white/5 border-dashed p-10 text-center flex flex-col items-center">
                                    <TableProperties className="w-10 h-10 text-white/20 mb-3" />
                                    <p className="text-white/40">You must extract data in the previous step, or inject some dummy data, before using the Spreadsheet Mapper.</p>
                                </div>
                            ) : (
                                <SpreadsheetMapper data={mappingData} />
                            )}
                        </div>
                    )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
