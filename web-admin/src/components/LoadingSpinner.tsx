interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ size = "md", text, className = "" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-4 mobile-padding ${className}`}>
      <div className={`
        ${sizeClasses[size]} 
        animate-spin text-blue-600 animate-bounce-in
        transition-all duration-300 hover:scale-110
      `}>
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>
      {text && (
        <p className="text-gray-600 animate-pulse-soft font-medium" style={{ fontSize: 'var(--text-sm)' }}>
          {text}
        </p>
      )}
    </div>
  );
}

export function TableLoadingSkeleton({ rows = 5, columns = 3 }: { rows?: number; columns?: number }) {
  return (
    <div className="card animate-slide-up">
      <div className="mobile-padding border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="h-10 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-xl animate-shimmer"></div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200/80">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="mobile-padding animate-slide-down" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="h-4 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 rounded-lg animate-shimmer"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200/60">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="animate-fade-in-up" style={{ animationDelay: `${rowIndex * 0.1}s` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="mobile-padding">
                    <div 
                      className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-lg animate-shimmer"
                      style={{ 
                        animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s`,
                        width: colIndex === 0 ? '60%' : colIndex === columns - 1 ? '40%' : '80%'
                      }}
                    ></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-padding bg-gradient-to-r from-gray-50 to-gray-100/50 border-t border-gray-200/60 animate-slide-up">
        <div className="h-5 w-32 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-lg animate-shimmer"></div>
      </div>
    </div>
  );
}
