"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripHorizontal, Download, Save, Upload, X, Edit2, Check, Plus, ArrowRight, ArrowDown, Code } from "lucide-react";

interface CSVExporterProps {
  data: any[];
}

interface ColumnDef {
  id: string; // The original flattened key
  label: string; // the display name
  script?: string; // Optional JS script to run to transform the string data
}

type Orientation = "horizontal" | "vertical";

// -------------------------------------------------------------
// Advanced JSON Exploder - Handles Cartesian Products for arrays
// -------------------------------------------------------------
function isObject(val: any) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function explodeJSON(obj: any, prefix = ''): any[] {
    if (Array.isArray(obj)) {
        if (obj.length === 0) return [{}];
        let rows: any[] = [];
        for (const item of obj) {
            const itemRows = explodeJSON(item, prefix);
            rows.push(...itemRows);
        }
        return rows;
    } else if (isObject(obj)) {
        let baseRow: any = {};
        let arrayKeys: string[] = [];
        
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (Array.isArray(val)) {
                arrayKeys.push(key);
            } else if (isObject(val)) {
                 const nestedBase = explodeJSON(val, newKey);
                 // If the nested object resolved to multiple rows (unlikely unless it contained arrays), 
                 // we just take the first one for the base row to avoid complexity here.
                 Object.assign(baseRow, nestedBase[0]); 
            } else {
                 baseRow[newKey] = val;
            }
        }

        if (arrayKeys.length === 0) {
            return [baseRow];
        }

        const explodedArrays: Record<string, any[]> = {};
        let maxArrLen = 0;
        
        for (const arrKey of arrayKeys) {
            const arrVal = obj[arrKey];
            const arrPrefix = prefix ? `${prefix}.${arrKey}` : arrKey;
            const exploded = explodeJSON(arrVal, arrPrefix);
            explodedArrays[arrKey] = exploded;
            if (exploded.length > maxArrLen) {
                maxArrLen = exploded.length;
            }
        }

        let resultRows: any[] = [];
        for (let i = 0; i < maxArrLen; i++) {
            let row = { ...baseRow };
            for (const arrKey of arrayKeys) {
                const arrRows = explodedArrays[arrKey];
                if (i < arrRows.length) {
                    row = { ...row, ...arrRows[i] };
                }
            }
            resultRows.push(row);
        }

        return resultRows;
    } else {
        return [{ [prefix]: obj }];
    }
}

function SortableItem({ 
    column, 
    onRemove, 
    onUpdate 
}: { 
    column: ColumnDef; 
    onRemove: (id: string) => void;
    onUpdate: (oldId: string, newId: string, newLabel: string, newScript?: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(column.id);
  const [editLabel, setEditLabel] = useState(column.label);
  const [editScript, setEditScript] = useState(column.script || "");

  const handleSave = () => {
    onUpdate(column.id, editId.trim() || column.id, editLabel.trim() || column.label, editScript.trim() || undefined);
    setIsEditing(false);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex flex-col gap-2 bg-white/10 hover:bg-white/15 px-4 py-3 rounded-lg border border-white/10 shrink-0 relative group min-w-[200px]"
    >
      <div className="flex justify-between items-center w-full">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-white/10 rounded">
          <GripHorizontal className="w-4 h-4 text-white/50" />
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(column.id); }}
          className="text-white/30 hover:text-red-400 hover:bg-white/5 p-1 rounded transition-colors"
          title="Remove from export"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="flex flex-col gap-1 w-full">
        {isEditing ? (
            <div className="flex flex-col gap-2 bg-black/40 rounded p-2 border border-white/10 w-full mb-1">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 uppercase font-semibold tracking-wider">Feature Key (JSON Path)</label>
                    <input 
                        type="text" 
                        value={editId} 
                        onChange={e => setEditId(e.target.value)}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleSave(); }}
                        className="bg-black/50 border border-white/5 outline-none rounded text-xs text-green-300 px-2 py-1.5 focus:border-white/20"
                        placeholder="e.g. data.id"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 uppercase font-semibold tracking-wider">CSV Header Label</label>
                    <input 
                        autoFocus
                        type="text" 
                        value={editLabel} 
                        onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleSave(); }}
                        className="bg-black/50 border border-white/5 outline-none rounded text-xs text-blue-200 px-2 py-1.5 focus:border-white/20 w-full"
                        placeholder="e.g. ID"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 uppercase font-semibold tracking-wider flex justify-between">
                        <span>JS Transformer</span>
                        <span className="text-[9px] text-white/30 lowercase">(optional)</span>
                    </label>
                    <textarea 
                        value={editScript} 
                        onChange={e => setEditScript(e.target.value)}
                        className="bg-black/50 border border-white/5 outline-none rounded text-xs text-yellow-200/80 px-2 py-1.5 focus:border-white/20 w-full min-h-[50px] font-mono scrollbar-thin resize-y"
                        placeholder="return value;"
                    />
                </div>
                <button onMouseDown={(e) => { e.preventDefault(); handleSave() }} className="mt-1 w-full bg-green-600/20 hover:bg-green-600/40 text-green-400 py-1.5 rounded transition-colors flex items-center justify-center text-xs font-semibold">
                    <Check className="w-3 h-3 mr-1" /> Save Column Info
                </button>
            </div>
        ) : (
            <div className="flex items-start justify-between w-full group/text">
                <div className="flex flex-col overflow-hidden pr-2">
                    <span className="font-semibold text-sm text-blue-200 flex items-center gap-1.5 truncate">
                        <span className="truncate" title={`Header: ${column.label}`}>{column.label}</span>
                        {column.script && (
                            <span className="shrink-0 flex items-center" title="Has JS Transformer Script">
                                <Code className="w-3.5 h-3.5 text-yellow-400/80" />
                            </span>
                        )}
                    </span>
                    <span className="font-mono text-[10px] text-green-400/70 truncate mt-0.5" title={`Path: ${column.id}`}>{column.id}</span>
                </div>
                <button 
                    onClick={() => {
                        setEditId(column.id);
                        setEditLabel(column.label);
                        setEditScript(column.script || "");
                        setIsEditing(true);
                    }} 
                    className="opacity-0 group-hover/text:opacity-100 text-white/40 hover:text-white transition-opacity mt-1 shrink-0"
                >
                    <Edit2 className="w-3 h-3" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
}

export function CSVExporter({ data }: CSVExporterProps) {
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const prevDataRef = useRef<string>("");

  // Compute flattenedData directly on every render — no hooks, no stale state
  const flattenedData: any[] = (() => {
    if (!data || data.length === 0) return [];
    const arrayData = Array.isArray(data) ? data : [data];
    let finalRows: any[] = [];
    for (const item of arrayData) {
        finalRows.push(...explodeJSON(item));
    }
    return finalRows;
  })();

  // Only update columns when data actually changes (by serialized comparison)
  const dataFingerprint = JSON.stringify(data);
  useEffect(() => {
    if (dataFingerprint === prevDataRef.current) return;
    prevDataRef.current = dataFingerprint;

    if (flattenedData.length === 0) {
      setColumns([]);
      return;
    }
    
    const allKeys = new Set<string>();
    flattenedData.forEach(obj => {
      if (typeof obj === 'object' && obj !== null) {
          Object.keys(obj).forEach(key => allKeys.add(key));
      }
    });
    
    const newColumns: ColumnDef[] = Array.from(allKeys).map(k => {
        const parts = k.split('.');
        return { id: k, label: parts[parts.length - 1] };
    });
    setColumns(newColumns);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFingerprint]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex(col => col.id === active.id);
        const newIndex = items.findIndex(col => col.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveColumn = (id: string) => setColumns(prev => prev.filter(c => c.id !== id));
  const handleUpdateColumn = (oldId: string, newId: string, newLabel: string, newScript?: string) => setColumns(prev => prev.map(c => c.id === oldId ? { id: newId, label: newLabel, script: newScript } : c));
  const handleAddCustomColumn = () => setColumns(prev => [...prev, { id: `custom_field_${Date.now()}`, label: 'New Custom Field' }]);

  const getProcessedValue = (row: any, colDef: ColumnDef) => {
      let val = row[colDef.id];
      if (colDef.script) {
          try {
              const func = new Function('value', 'row', colDef.script);
              val = func(val, row);
          } catch (e) {
              console.error(`Error executing script for column ${colDef.label}`, e);
              val = `[Script Error]`;
          }
      }
      if (typeof val === 'object') val = JSON.stringify(val);
      return val;
  };

  const handleGenerateCSV = () => {
    if (!flattenedData || !columns.length) return;

    let csvRows: string[] = [];

    const toCsvField = (val: any) => {
        if (val === null || val === undefined) return "";
        if (typeof val === 'object') val = JSON.stringify(val);
        const strVal = String(val).replace(/"/g, '""');
        if (strVal.search(/("|,|\n)/g) >= 0) {
          return `"${strVal}"`;
        }
        return strVal;
    };

    if (orientation === "horizontal") {
        // Standard LTR Export
        csvRows.push(columns.map(c => toCsvField(c.label)).join(","));
        for (const row of flattenedData) {
          const values = columns.map(colDef => toCsvField(getProcessedValue(row, colDef)));
          csvRows.push(values.join(","));
        }
    } else {
        // Vertical / TTB Export (Transpose)
        // Col 1 is the headers. Col 2 is row 1. Col 3 is row 2.
        for (let colIndex = 0; colIndex < columns.length; colIndex++) {
            const colDef = columns[colIndex];
            const rowValues = [toCsvField(colDef.label)]; // The header is the first item on the line
            for (let rowIndex = 0; rowIndex < flattenedData.length; rowIndex++) {
                rowValues.push(toCsvField(getProcessedValue(flattenedData[rowIndex], colDef)));
            }
            csvRows.push(rowValues.join(","));
        }
    }
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `extracted_data_${orientation}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveConfig = () => {
    const config = { "csv_columns_mapping": columns, "orientation": orientation };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "csv_mapping_config.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
            const result = JSON.parse(event.target?.result as string);
            if (result.csv_columns_mapping && Array.isArray(result.csv_columns_mapping)) {
                if(result.csv_columns_mapping.length > 0 && typeof result.csv_columns_mapping[0] === 'object') {
                   setColumns(result.csv_columns_mapping);
                } else {
                   setColumns(result.csv_columns_mapping.map((id: string) => ({ id, label: id })));
                }
            }
            if (result.orientation && (result.orientation === "horizontal" || result.orientation === "vertical")) {
                setOrientation(result.orientation);
            }
        } catch (err) {
            console.error("Invalid config file");
        }
      };
      reader.readAsText(file);
    }
  };

  if (!data) return null;

  const previewData = flattenedData.slice(0, 5);

  return (
    <div className="flex flex-col gap-4 mt-6 p-6 bg-black/30 rounded-xl border border-white/10">
      <div className="flex justify-between items-center mb-2">
         <div>
            <h4 className="font-bold text-lg text-white mb-1">Dynamic CSV Mapping</h4>
            <p className="text-sm text-white/50">Drag left-to-right to reorder. Rename headers or edit data keys.</p>
         </div>
         <div className="flex gap-2">
            <label className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-md cursor-pointer flex items-center transition-colors">
              <Upload className="w-3 h-3 mr-2" /> Load Mapping
              <input type="file" className="hidden" accept=".json" onChange={handleLoadConfig} />
            </label>
            <button 
                onClick={handleSaveConfig}
                className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-md flex items-center transition-colors"
                title="Save mapping configuration for reuse"
            >
              <Save className="w-3 h-3 mr-2 outline-none" /> Save Mapping
            </button>
         </div>
      </div>

      <div className="flex overflow-x-auto pb-4 gap-3 scrollbar-thin scrollbar-thumb-white/20 items-stretch min-h-[100px]">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={columns.map(c => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map(col => (
              <SortableItem 
                 key={col.id} 
                 column={col} 
                 onRemove={handleRemoveColumn}
                 onUpdate={handleUpdateColumn}
              />
            ))}
          </SortableContext>
        </DndContext>
        
        {/* Add custom column button */}
        <button 
            onClick={handleAddCustomColumn}
            className="flex items-center justify-center min-w-[200px] bg-white/5 hover:bg-white/10 border border-dashed border-white/30 rounded-lg shrink-0 transition-colors group cursor-pointer"
        >
            <Plus className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 mb-2">
         <div className="text-sm font-semibold text-white/70">Export Layout Orientation</div>
         <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
             <button 
                 onClick={() => setOrientation("horizontal")}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center ${orientation === "horizontal" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
             >
                 <ArrowRight className="w-3 h-3 mr-1" /> Left to Right
             </button>
             <button 
                 onClick={() => setOrientation("vertical")}
                 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center ${orientation === "vertical" ? "bg-purple-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
             >
                 <ArrowDown className="w-3 h-3 mr-1" /> Top to Bottom
             </button>
         </div>
      </div>

      {/* Real-time Preview */}
      <div className="border border-white/10 rounded-lg overflow-hidden flex flex-col max-h-[400px]">
          <div className="bg-white/5 px-4 py-2 text-xs font-semibold text-white/50 tracking-widest uppercase border-b border-white/10 sticky top-0 z-20">
             Live Preview (First {previewData.length} records)
          </div>
          <div className="overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm text-left text-gray-300">
                  {orientation === "horizontal" ? (
                      <>
                          <thead className="text-xs text-white/60 bg-black/50 border-b border-white/10 sticky top-0 z-10">
                              <tr>
                                  {columns.map(c => (
                                      <th key={`th-${c.id}`} className="px-4 py-3 font-medium whitespace-nowrap border-r border-white/5 last:border-0 truncate max-w-[200px]" title={c.label}>
                                          {c.label}
                                      </th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody>
                              {previewData.map((row, idx) => (
                                  <tr key={`tr-${idx}`} className="border-b border-white/5 bg-black/20 hover:bg-white/5 transition-colors">
                                      {columns.map(c => {
                                          let val = getProcessedValue(row, c);
                                          return (
                                              <td key={`td-${c.id}-${idx}`} className="px-4 py-3 whitespace-nowrap border-r border-white/5 last:border-0 truncate max-w-[300px]" title={String(val ?? "")}>
                                                  {String(val ?? "")}
                                              </td>
                                          )
                                      })}
                                  </tr>
                              ))}
                          </tbody>
                      </>
                  ) : (
                      <tbody>
                          {columns.map(col => (
                              <tr key={`vtr-${col.id}`} className="border-b border-white/5 bg-black/20 hover:bg-white/5 transition-colors">
                                  {/* Header Column first */}
                                  <th className="px-4 py-3 font-medium whitespace-nowrap border-r border-white/20 bg-black/50 sticky left-0 z-10 truncate max-w-[200px]" title={col.label}>
                                      {col.label}
                                  </th>
                                  {/* Then Row Columns */}
                                  {previewData.map((row, idx) => {
                                      let val = getProcessedValue(row, col);
                                      return (
                                          <td key={`vtd-${col.id}-${idx}`} className="px-4 py-3 whitespace-nowrap border-r border-white/5 last:border-0 truncate max-w-[300px]" title={String(val ?? "")}>
                                              {String(val ?? "")}
                                          </td>
                                      )
                                  })}
                              </tr>
                          ))}
                      </tbody>
                  )}
              </table>
          </div>
      </div>

      <button 
        onClick={handleGenerateCSV}
        className="btn-primary w-full mt-4 flex items-center justify-center"
      >
        <Download className="w-5 h-5 mr-3" /> Download Extracted Data CSV
      </button>
    </div>
  );
}
