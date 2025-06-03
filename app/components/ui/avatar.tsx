import React from 'react';
import { IconRobot, IconUser } from '@tabler/icons-react';

interface AvatarProps {
  role: string;
}

export const Avatar: React.FC<AvatarProps> = ({ role }) => {
  return (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
      role === 'assistant' ? 'bg-blue-600' : 'bg-gray-600'
    }`}>
      {role === 'assistant' ? (
        <IconRobot size={20} className="text-white" />
      ) : (
        <IconUser size={20} className="text-white" />
      )}
    </div>
  );
}; 