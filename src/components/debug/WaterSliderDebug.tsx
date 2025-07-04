import React, { useState, useEffect, useRef } from 'react';

interface DebugValue {
  label: string;
  value: any;
  timestamp: number;
}

interface DebugWindowProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

class DebugLogger {
  private static instance: DebugLogger;
  private values: Map<string, DebugValue> = new Map();
  private listeners: Set<() => void> = new Set();
  
  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }
  
  log(label: string, value: any) {
    this.values.set(label, {
      label,
      value,
      timestamp: Date.now()
    });
    this.notifyListeners();
  }
  
  getValues(): DebugValue[] {
    return Array.from(this.values.values()).sort((a, b) => a.label.localeCompare(b.label));
  }
  
  addListener(callback: () => void) {
    this.listeners.add(callback);
  }
  
  removeListener(callback: () => void) {
    this.listeners.delete(callback);
  }
  
  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
  
  clear() {
    this.values.clear();
    this.notifyListeners();
  }
}

export const debugLogger = DebugLogger.getInstance();

const DebugWindow: React.FC<DebugWindowProps> = ({ 
  isOpen = false, 
  onToggle 
}) => {
  const [values, setValues] = useState<DebugValue[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  
  useEffect(() => {
    const updateValues = () => {
      setValues(debugLogger.getValues());
    };
    
    debugLogger.addListener(updateValues);
    updateValues(); // Initial load
    
    return () => {
      debugLogger.removeListener(updateValues);
    };
  }, []);
  
  const formatValue = (value: any): string => {
    if (typeof value === 'number') {
      return value.toFixed(3);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 1);
    }
    return String(value);
  };
  
  const getTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 1000) return 'now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };
  
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 9999,
          fontFamily: 'monospace'
        }}
      >
        🐛 Debug
      </button>
    );
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: '10svh',
      right: '10px',
      width: '300px',
      maxHeight: isMinimized ? '40px' : '400px',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      border: '1px solid #333',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: 'monospace',
      zIndex: 9999,
      overflow: 'hidden',
      transition: 'max-height 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderBottom: isMinimized ? 'none' : '1px solid #333'
      }}>
        <span>🐛 Debug Window ({values.length})</span>
        <div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              marginRight: '8px',
              fontSize: '12px'
            }}
          >
            {isMinimized ? '📈' : '📉'}
          </button>
          <button
            onClick={() => debugLogger.clear()}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              marginRight: '8px',
              fontSize: '12px'
            }}
          >
            🗑️
          </button>
          <button
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Content */}
      {!isMinimized && (
        <div style={{
          padding: '8px',
          maxHeight: '340px',
          overflowY: 'auto'
        }}>
          {values.map((item, index) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '4px 0',
                borderBottom: index < values.length - 1 ? '1px solid #333' : 'none',
                gap: '8px'
              }}
            >
              <div style={{
                fontWeight: 'bold',
                color: '#4CAF50',
                minWidth: '100px',
                wordBreak: 'break-word'
              }}>
                {item.label}:
              </div>
              <div style={{
                textAlign: 'right',
                color: '#FFF',
                flex: 1,
                wordBreak: 'break-word'
              }}>
                {formatValue(item.value)}
                <div style={{
                  fontSize: '9px',
                  color: '#888',
                  marginTop: '2px'
                }}>
                  {getTimestamp(item.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {values.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: '#888', 
              padding: '20px' 
            }}>
              No debug data yet...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugWindow;