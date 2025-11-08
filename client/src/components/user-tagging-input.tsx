import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AtSign } from 'lucide-react';

interface User {
  handle: string;
  displayName: string;
  profileImageUrl?: string;
}

interface UserTaggingInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onUserTag?: (user: User) => void;
}

export function UserTaggingInput({ 
  value, 
  onChange, 
  placeholder = "What's happening?",
  className = "",
  onUserTag
}: UserTaggingInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentTag, setCurrentTag] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Extract current @mention being typed
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeCursor = value.substring(0, cursorPosition);
    const match = beforeCursor.match(/@(\w*)$/);
    
    if (match && match[1] !== undefined) {
      setCurrentTag(match[1]);
      setShowSuggestions(match[1].length >= 1); // Show suggestions after typing @ and at least 1 character
    } else {
      setCurrentTag('');
      setShowSuggestions(false);
    }
  }, [value, cursorPosition]);

  // Search users based on current tag
  const { data: userSearchData } = useQuery({
    queryKey: ['/api/social/users/search', currentTag],
    queryFn: async () => {
      if (!currentTag || currentTag.length < 1) return { users: [] };
      
      const response = await fetch(`/api/social/users/search?q=${encodeURIComponent(currentTag)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to search users');
      return response.json();
    },
    enabled: showSuggestions && currentTag.length >= 1,
  });

  const users = userSearchData?.users || [];

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setCursorPosition(e.currentTarget.selectionStart);
  };

  const handleUserSelect = (user: User) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    
    // Find the start of the @mention
    const mentionStart = beforeCursor.lastIndexOf('@');
    if (mentionStart === -1) return;

    // Replace the current @mention with the selected user
    const newValue = 
      value.substring(0, mentionStart) + 
      `@${user.handle} ` + 
      afterCursor;

    onChange(newValue);
    setShowSuggestions(false);
    
    // Set cursor position after the mention
    const newCursorPos = mentionStart + user.handle.length + 2;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      setCursorPosition(newCursorPos);
    }, 0);

    // Callback for parent component
    if (onUserTag) {
      onUserTag(user);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || users.length === 0) return;

    if (e.key === 'Escape') {
      setShowSuggestions(false);
      e.preventDefault();
    }
  };

  // Process text to highlight @mentions
  const processTextForDisplay = (text: string) => {
    return text.replace(/@(\w+)/g, '<span class="text-blue-500 font-medium">@$1</span>');
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyUp={handleKeyUp}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[120px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                 placeholder-gray-500 dark:placeholder-gray-400"
        data-testid="input-post-content"
      />

      {/* User suggestions dropdown */}
      {showSuggestions && users.length > 0 && (
        <Card 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg max-h-60 overflow-y-auto"
        >
          <div className="p-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <AtSign className="w-4 h-4" />
              <span>Tag users</span>
            </div>
            {users.map((user: User) => (
              <Button
                key={user.handle}
                variant="ghost"
                className="w-full justify-start p-2 h-auto hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleUserSelect(user)}
                data-testid={`user-suggestion-${user.handle}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage 
                      src={user.profileImageUrl || ''} 
                      alt={user.displayName || user.handle}
                    />
                    <AvatarFallback>
                      {(user.displayName || user.handle).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {user.displayName || user.handle}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      @{user.handle}
                    </span>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// Helper function to extract mentioned users from text
export function extractMentionedUsers(text: string): string[] {
  const mentions = text.match(/@(\w+)/g);
  return mentions ? mentions.map(mention => mention.substring(1)) : [];
}

// Helper function to render text with highlighted mentions
export function renderTextWithMentions(text: string) {
  return text.split(/(@\w+)/).map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span key={index} className="text-blue-500 font-medium hover:underline cursor-pointer">
          {part}
        </span>
      );
    }
    return part;
  });
}
