"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Download, Save, Upload, Type, Database, RefreshCw, X } from "lucide-react";
import { JSONPath } from 'jsonpath-plus';

interface SpreadsheetMapperProps {
  data: any[];
}

const ROWS = 20;
const COLS = 10;
const COL_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

type CellData = {
  value: string; // The formula/text entered by the user
};

type GridData = {
  [key: string]: CellData; // e.g., "A1": { value: "Header" }
};

export function SpreadsheetMapper({ data }: SpreadsheetMapperProps) {
  // Compute default grid from the first data object to auto-populate headers and some paths
  const initialGrid: GridData = {};
  
  if (data && data.length > 0) {
     const firstItem = data[0];
     
     // Recursively find all typical path keys from the object
     const getPaths = (obj: any, prefix = ''): {key: string, path: string}[] => {
         let paths: {key: string, path: string}[] = [];
         
         if (Array.isArray(obj)) {
             // For arrays, we just take the first element's structure to figure out the columns
             if (obj.length > 0) {
                 const arrPaths = getPaths(obj[0], `${prefix}[0]`);
                 paths = paths.concat(arrPaths);
             }
         } else if (typeof obj === 'object' && obj !== null) {
             for (const k of Object.keys(obj)) {
                 const newPrefix = prefix ? `${prefix}.${k}` : k;
                 
                 // If the nested property is a primitive or empty array, add it as a column
                 if (typeof obj[k] !== 'object' || obj[k] === null || (Array.isArray(obj[k]) && obj[k].length === 0)) {
                     paths.push({ key: prefix ? `${prefix}.${k}` : k, path: `$[0].${newPrefix}` });
                 } else {
                     // Otherwise recurse
                     paths = paths.concat(getPaths(obj[k], newPrefix));
                 }
             }
         } else {
             // Primitive root (unlikely but possible)
             paths.push({ key: prefix || 'value', path: `$[0]${prefix ? '.' + prefix : ''}` });
         }
         return paths;
     };

     if (typeof firstItem === 'object' && firstItem !== null) {
         const allPaths = getPaths(firstItem);
         
         let colIdx = 0;
         for (const item of allPaths) {
             if (colIdx >= COL_NAMES.length) break; // Limit to available columns
             
             const col = COL_NAMES[colIdx];
             // Row 1: Header Name (using the last part of the path for readability)
             const keyParts = item.key.split('.');
             const shortName = keyParts[keyParts.length - 1].replace(/\[\d+\]/g, '');
             initialGrid[`${col}1`] = { value: shortName };
             
             // Row 2: Generated JSONPath
             initialGrid[`${col}2`] = { value: item.path };
             
             colIdx++;
         }
     }
  }

  const [grid, setGrid] = useState<GridData>(initialGrid);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [viewMode, setViewMode] = useState<"formula" | "preview">("formula");
  
  // Drag to fill state
  const [dragStartCell, setDragStartCell] = useState<string | null>(null);
  const [dragCurrentCell, setDragCurrentCell] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  // Handle click outside to commit edit
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
         commitEdit();
         setSelectedCell(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingCell, editValue, selectedCell]);

  const commitEdit = () => {
    if (editingCell) {
      setGrid(prev => ({
        ...prev,
        [editingCell]: { value: editValue }
      }));
      setEditingCell(null);
    }
  };

  const handleCellClick = (cellId: string) => {
    if (isDragging) return; // Ignore click if finishing a drag
    commitEdit();
    setSelectedCell(cellId);
  };

  const handleCellDoubleClick = (cellId: string) => {
    setSelectedCell(cellId);
    setEditingCell(cellId);
    setEditValue(grid[cellId]?.value || "");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) {
      if (e.key === "Enter") {
        commitEdit();
        // Move down one row if possible
        const { col, row } = parseCellId(editingCell);
        if (row < ROWS) {
            setSelectedCell(`${col}${row + 1}`);
        }
      } else if (e.key === "Escape") {
        setEditingCell(null); // Cancel edit
      }
      return;
    }

    if (selectedCell) {
      if (e.key === "Enter") {
        handleCellDoubleClick(selectedCell);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        setGrid(prev => {
          const newGrid = { ...prev };
          delete newGrid[selectedCell];
          return newGrid;
        });
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        // Start editing and replace
        setEditingCell(selectedCell);
        setEditValue(e.key);
      }
      
      // Arrow navigation
      const { col, colIdx, row } = parseCellId(selectedCell);
      if (e.key === "ArrowUp" && row > 1) setSelectedCell(`${col}${row - 1}`);
      if (e.key === "ArrowDown" && row < ROWS) setSelectedCell(`${col}${row + 1}`);
      if (e.key === "ArrowLeft" && colIdx > 0) setSelectedCell(`${COL_NAMES[colIdx - 1]}${row}`);
      if (e.key === "ArrowRight" && colIdx < COL_NAMES.length - 1) setSelectedCell(`${COL_NAMES[colIdx + 1]}${row}`);
    }
  };

  const parseCellId = (id: string) => {
    const match = id.match(/([A-Z])(\d+)/);
    if (!match) return { col: "A", colIdx: 0, row: 1 };
    return {
      col: match[1],
      colIdx: COL_NAMES.indexOf(match[1]),
      row: parseInt(match[2], 10)
    };
  };

  // --- Drag to Fill Logic ---
  const handleDragHandleMouseDown = (e: React.MouseEvent, cellId: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStartCell(cellId);
    setDragCurrentCell(cellId);
  };

  const handleCellMouseEnter = (cellId: string) => {
    if (isDragging) {
      setDragCurrentCell(cellId);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStartCell && dragCurrentCell && dragStartCell !== dragCurrentCell) {
      applyDragFill(dragStartCell, dragCurrentCell);
    }
    setIsDragging(false);
    setDragStartCell(null);
    setDragCurrentCell(null);
  };

  // Attach global mouse up to catch drops outside cells
  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDragging, dragStartCell, dragCurrentCell]); // Need these dependencies for closure


  const applyDragFill = (startId: string, endId: string) => {
    const start = parseCellId(startId);
    const end = parseCellId(endId);
    
    // Determine drag direction (vertical or horizontal only)
    const isVertical = start.colIdx === end.colIdx;
    const isHorizontal = start.row === end.row;

    if (!isVertical && !isHorizontal) return; // Only 1D drags supported for simplicity

    const sourceValue = grid[startId]?.value || "";
    if (!sourceValue) return;

    const newGrid = { ...grid };

    if (isVertical) {
      const step = start.row < end.row ? 1 : -1;
      let count = 1;
      for (let r = start.row + step; step > 0 ? r <= end.row : r >= end.row; r += step) {
         const targetId = `${start.col}${r}`;
         newGrid[targetId] = { value: incrementJsonPath(sourceValue, count * step) };
         count++;
      }
    } else {
        const step = start.colIdx < end.colIdx ? 1 : -1;
        let count = 1;
        for (let c = start.colIdx + step; step > 0 ? c <= end.colIdx : c >= end.colIdx; c += step) {
            const targetId = `${COL_NAMES[c]}${start.row}`;
            newGrid[targetId] = { value: incrementJsonPath(sourceValue, count * step) };
            count++;
        }
    }

    setGrid(newGrid);
  };

  // Detects things like `$[0].name` and increments the *last* bracketed number
  const incrementJsonPath = (baseStr: string, increment: number): string => {
    // Find all occurrences of bracketed numbers, e.g. [0], [12]
    const regex = /\[(\d+)\]/g;
    let match;
    let matches = [];
    while ((match = regex.exec(baseStr)) !== null) {
        matches.push({ index: match.index, length: match[0].length, num: parseInt(match[1], 10) });
    }

    if (matches.length > 0) {
        // We only want to increment the LAST bracketed number found
        const lastMatch = matches[matches.length - 1];
        const newNum = Math.max(0, lastMatch.num + increment); // prevent negative indices
        const prefix = baseStr.substring(0, lastMatch.index);
        const suffix = baseStr.substring(lastMatch.index + lastMatch.length);
        return `${prefix}[${newNum}]${suffix}`;
    }
    
    // If no numbers in brackets to increment, just copy the string
    return baseStr;
  };


  // --- Evaluation Logic ---
  const evaluateCell = (value: string): string => {
      if (!value) return "";
      if (!value.startsWith("$")) return value; // Treat paths starting with $ as JSONPaths, else literal text

      try {
        // jsonpath-plus expects the root object. Since our `data` prop might be a single object
        // inside an array or just the object itself, we ensure it can query properly.
        const result = JSONPath({ path: value, json: data });
        
        // Result is an array of matches. If empty, return empty string.
        if (!result || result.length === 0) return "";
        
        // Extract string values
        let val = result[0];
        
        // Sometimes jsonpath returns elements wrapped in an extra array if queried oddly
        if (Array.isArray(val) && val.length === 1) {
            val = val[0];
        }
        
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val);
      } catch (err) {
        return "#ERROR!";
      }
  };

  const getDisplayValue = (cellId: string) => {
      const cell = grid[cellId];
      if (!cell) return "";
      
      if (editingCell === cellId) return editValue; // Show raw input while editing

      if (viewMode === "preview") {
          return evaluateCell(cell.value);
      }
      return cell.value;
  };


  // --- UI Helpers ---
  const isInDragRange = (cellId: string) => {
    if (!dragStartCell || !dragCurrentCell) return false;
    const start = parseCellId(dragStartCell);
    const curr = parseCellId(dragCurrentCell);
    const target = parseCellId(cellId);

    // Vertical drag check
    if (start.colIdx === curr.colIdx && start.colIdx === target.colIdx) {
       const minR = Math.min(start.row, curr.row);
       const maxR = Math.max(start.row, curr.row);
       return target.row >= minR && target.row <= maxR;
    }
    
    // Horizontal drag check
    if (start.row === curr.row && start.row === target.row) {
        const minC = Math.min(start.colIdx, curr.colIdx);
        const maxC = Math.max(start.colIdx, curr.colIdx);
        return target.colIdx >= minC && target.colIdx <= maxC;
    }

    return false;
  };

  // --- Export ---
  const handleExportCSV = () => {
      let csvContent = "";
      for (let r = 1; r <= ROWS; r++) {
          let rowValues = [];
          for (let c = 0; c < COL_NAMES.length; c++) {
              const cellId = `${COL_NAMES[c]}${r}`;
              const cellValue = grid[cellId]?.value || "";
              // We always export the EVALUATED result, regardless of current view
              let evalStr = cellValue.startsWith("$") ? evaluateCell(cellValue) : cellValue;
              
              // Escape quotes and handle commas
              let safeStr = String(evalStr).replace(/"/g, '""');
              if (safeStr.search(/("|,|\n)/g) >= 0) {
                  safeStr = `"${safeStr}"`;
              }
              rowValues.push(safeStr);
          }
          // Do not export completely empty rows at the bottom
          // (Basic implementation: exports all 20 rows. In a real app, trim trailing empty rows)
          csvContent += rowValues.join(",") + "\n";
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `spreadsheet_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };


  return (
    <div className="flex flex-col gap-4 mt-6 p-6 bg-black/30 rounded-xl border border-white/10"
         onKeyDown={handleKeyDown}
         tabIndex={0} 
         ref={gridRef}
    >
      <div className="flex justify-between items-center mb-2">
         <div>
            <h4 className="font-bold text-lg text-white mb-1">Interactive Excel Mapper</h4>
            <p className="text-sm text-white/50">Enter headers and JSON paths (start with `$`). Drag corner handle to auto-increment array indices.</p>
         </div>
         <div className="flex gap-4 items-center">
            {/* View Toggle */}
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                 <button 
                     onClick={() => { commitEdit(); setViewMode("formula"); }}
                     className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center ${viewMode === "formula" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                 >
                     <Type className="w-3 h-3 mr-1" /> View Paths
                 </button>
                 <button 
                     onClick={() => { commitEdit(); setViewMode("preview"); }}
                     className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center ${viewMode === "preview" ? "bg-green-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                 >
                     <Database className="w-3 h-3 mr-1" /> Preview Data
                 </button>
             </div>
             
             <button 
                onClick={() => setGrid({})}
                className="text-xs text-red-400 hover:bg-red-400/10 px-3 py-1.5 rounded-md flex items-center transition-colors"
             >
                <RefreshCw className="w-3 h-3 mr-1" /> Clear Grid
             </button>
         </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto border border-white/10 rounded-lg bg-black/50 select-none max-h-[600px] h-[600px] relative">
         <table className="w-full text-sm text-left cell-border-collapse table-fixed" style={{ borderCollapse: 'collapse' }}>
            <thead className="sticky top-0 z-20 bg-gray-900 border-b border-white/10 shadow shadow-black">
                <tr>
                    <th className="w-10 bg-gray-900 border-r border-white/10"></th>
                    {COL_NAMES.map(col => (
                        <th key={col} className="w-40 font-semibold text-center py-1 bg-gray-900 border-r border-white/10 text-white/50">
                            {col}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: ROWS }).map((_, rIdx) => {
                    const rowNum = rIdx + 1;
                    return (
                        <tr key={rowNum}>
                            {/* Row Headers */}
                            <td className="sticky left-0 z-10 bg-gray-900 border-r border-b border-white/10 text-center font-semibold text-white/50 w-10">
                                {rowNum}
                            </td>
                            {/* Cells */}
                            {COL_NAMES.map(colName => {
                                const cellId = `${colName}${rowNum}`;
                                const isSelected = selectedCell === cellId;
                                const isEditing = editingCell === cellId;
                                const isDragHighlighted = isInDragRange(cellId);
                                const hasData = !!grid[cellId]?.value;
                                
                                const isError = viewMode === "preview" && getDisplayValue(cellId) === "#ERROR!";
                                
                                return (
                                    <td 
                                        key={cellId}
                                        onClick={() => handleCellClick(cellId)}
                                        onDoubleClick={() => handleCellDoubleClick(cellId)}
                                        onMouseEnter={() => handleCellMouseEnter(cellId)}
                                        className={`
                                            relative h-8 px-2 border-r border-b border-white/10 truncate
                                            ${isSelected ? 'outline outline-2 outline-blue-500 -outline-offset-2 z-10 bg-blue-500/10' : ''}
                                            ${isDragHighlighted && !isSelected ? 'bg-blue-500/20' : ''}
                                            ${!isSelected && !isDragHighlighted ? 'hover:bg-white/5 cursor-cell' : ''}
                                            ${isError ? 'text-red-400 bg-red-500/10' : 'text-gray-300'}
                                        `}
                                    >
                                        {isEditing ? (
                                            <input 
                                                ref={inputRef}
                                                type="text"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                className="absolute inset-0 w-full h-full bg-blue-900/50 text-white px-2 outline-none"
                                            />
                                        ) : (
                                            <span className={`${hasData && !grid[cellId]?.value.startsWith('$') ? 'font-bold text-white' : 'font-mono text-xs'}`} title={getDisplayValue(cellId)}>
                                                {getDisplayValue(cellId)}
                                            </span>
                                        )}

                                        {/* Drag Handle */}
                                        {isSelected && !isEditing && (
                                            <div 
                                                className="absolute bottom-[-3px] right-[-3px] w-[6px] h-[6px] bg-blue-500 outline outline-1 outline-black cursor-crosshair z-20"
                                                onMouseDown={(e) => handleDragHandleMouseDown(e, cellId)}
                                            />
                                        )}
                                    </td>
                                )
                            })}
                        </tr>
                    )
                })}
            </tbody>
         </table>
      </div>

      <button 
        onClick={handleExportCSV}
        className="btn-primary w-full mt-4 flex items-center justify-center bg-green-600 hover:bg-green-500 shadow-green-900/50"
      >
        <Download className="w-5 h-5 mr-3" /> Export Spreadsheeet to CSV
      </button>
    </div>
  );
}
