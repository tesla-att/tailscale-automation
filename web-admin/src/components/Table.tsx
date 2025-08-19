import React, { useState, useMemo } from "react";

interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
  columns: string[] | TableColumn[];
  rows: any[];
  searchable?: boolean;
  className?: string;
}

const Icons = {
  Search: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  SortUp: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ),
  SortDown: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Empty: () => (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

export default function Table({ columns, rows, searchable = true, className = "" }: TableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Normalize columns to TableColumn format
  const normalizedColumns: TableColumn[] = useMemo(() => {
    return columns.map(col => 
      typeof col === 'string' 
        ? { key: col, label: col.charAt(0).toUpperCase() + col.slice(1), sortable: true }
        : col
    );
  }, [columns]);

  // Filter and sort data
  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows;

    // Apply search filter
    if (searchTerm && searchable) {
      filtered = rows.filter(row =>
        normalizedColumns.some(col => {
          const value = row[col.key];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [rows, searchTerm, sortConfig, normalizedColumns, searchable]);

  const handleSort = (columnKey: string) => {
    const column = normalizedColumns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    setSortConfig(prevConfig => {
      if (prevConfig?.key === columnKey) {
        if (prevConfig.direction === 'asc') {
          return { key: columnKey, direction: 'desc' };
        } else {
          return null; // Remove sorting
        }
      } else {
        return { key: columnKey, direction: 'asc' };
      }
    });
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <Icons.SortUp /> : <Icons.SortDown />;
  };

  return (
    <div className={`card animate-slide-up ${className}`}>
      {/* Enhanced Search Bar */}
      {searchable && (
        <div className="mobile-padding border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Icons.Search />
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-12 pr-4 rounded-xl transition-all duration-300 focus:shadow-md hover:shadow-sm"
              style={{ fontSize: 'var(--text-base)' }}
            />
          </div>
        </div>
      )}

      {/* Enhanced Table */}
      <div className="overflow-x-auto mobile-scroll">
        <table className="min-w-full divide-y divide-gray-200/80">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50">
            <tr>
              {normalizedColumns.map((column, index) => (
                <th
                  key={column.key}
                  className={`
                    mobile-padding text-left font-bold text-gray-700 uppercase tracking-wider
                    transition-all duration-300 ease-[var(--ease-out-expo)]
                    ${column.sortable ? 'cursor-pointer hover:bg-gray-100/80 select-none transform hover:scale-[1.02]' : ''}
                    animate-slide-down
                  `}
                  style={{ 
                    animationDelay: `${index * 0.05}s`,
                    fontSize: 'var(--text-xs)'
                  }}
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-3 group">
                    <span className="truncate">{column.label}</span>
                    {column.sortable && (
                      <div className="flex flex-col transition-all duration-300 group-hover:scale-110">
                        {getSortIcon(column.key) || (
                          <div className="w-4 h-4 text-gray-400 opacity-50 group-hover:opacity-100">
                            <Icons.SortUp />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200/60">
            {filteredAndSortedRows.length === 0 ? (
              <tr>
                <td colSpan={normalizedColumns.length} className="mobile-padding text-center animate-fade-in">
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="p-4 bg-gray-100 rounded-2xl animate-bounce-in">
                      <Icons.Empty />
                    </div>
                    <div className="space-y-2">
                      <p className="text-gray-600 font-semibold" style={{ fontSize: 'var(--text-base)' }}>
                        No data found
                      </p>
                      {searchTerm && (
                        <p className="text-gray-500" style={{ fontSize: 'var(--text-sm)' }}>
                          Try adjusting your search terms
                        </p>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedRows.map((row, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-gray-50/80 transition-all duration-300 ease-[var(--ease-out-expo)] group animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.02}s` }}
                >
                  {normalizedColumns.map((column) => (
                    <td key={column.key} className="mobile-padding whitespace-nowrap group-hover:transform group-hover:scale-[1.01] transition-transform duration-300">
                      <div style={{ fontSize: 'var(--text-sm)' }}>
                        {column.render
                          ? column.render(row[column.key], row)
                          : (
                            <span className="text-gray-900 font-medium">
                              {row[column.key] || (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </span>
                          )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Enhanced Footer with count */}
      {filteredAndSortedRows.length > 0 && (
        <div className="mobile-padding bg-gradient-to-r from-gray-50 to-gray-100/50 border-t border-gray-200/60 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="text-gray-600 font-medium" style={{ fontSize: 'var(--text-sm)' }}>
              <span className="hidden sm:inline">Showing </span>
              <span className="font-bold text-gray-900">{filteredAndSortedRows.length}</span>
              <span className="hidden sm:inline"> of </span>
              <span className="sm:hidden">/</span>
              <span className="font-bold text-gray-900">{rows.length}</span>
              <span className="hidden sm:inline"> entries</span>
              {searchTerm && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  filtered
                </span>
              )}
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="btn-ghost px-3 py-1.5 text-xs transition-all duration-300 hover:scale-105"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
