import React from 'react';

export function CypherGuideIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="200" height="200" rx="20" fill="#0a0a0a"/>
      <polygon points="100,30 160,65 160,135 100,170 40,135 40,65" 
               fill="none" stroke="#00d9ff" strokeWidth="8"/>
      <path d="M110,55 L70,120 L95,120 L85,155 L135,90 L105,90 Z" fill="#ff9500"/>
      <circle cx="100" cy="105" r="14" fill="#0a0a0a" stroke="#ff9500" strokeWidth="5"/>
    </svg>
  );
}

export default CypherGuideIcon;
