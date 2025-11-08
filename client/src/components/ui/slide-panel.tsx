import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Eye, EyeOff } from 'lucide-react';

interface SlidePanelProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function SlidePanel({ isVisible, onClose, title, description, children }: SlidePanelProps) {
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div 
      className={`slide-panel ${isVisible ? 'visible' : 'hidden'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="slide-content" onClick={(e) => e.stopPropagation()}>
        <div className="slide-header">
          <h3 className="slide-title">{title}</h3>
          <button className="slide-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="slide-body">
          <p className="slide-description">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

interface PasswordSlidePanelProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PasswordSlidePanel({ 
  isVisible, 
  onClose, 
  title, 
  description, 
  onConfirm, 
  onCancel,
  isLoading = false
}: PasswordSlidePanelProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onConfirm(password);
      setPassword('');
    }
  };

  const handleCancel = () => {
    setPassword('');
    onCancel();
    onClose();
  };

  useEffect(() => {
    if (!isVisible) {
      setPassword('');
      setShowPassword(false);
    }
  }, [isVisible]);

  return (
    <SlidePanel isVisible={isVisible} onClose={handleCancel} title={title} description={description}>
      <form onSubmit={handleSubmit}>
        <div className="password-input-group">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your wallet password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="password-input pr-12"
              autoFocus
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password.trim()) {
                  e.preventDefault();
                  onConfirm(password);
                  setPassword('');
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="slide-actions">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!password.trim() || isLoading}
          >
            {isLoading ? 'Processing...' : 'Confirm'}
          </Button>
        </div>
      </form>
    </SlidePanel>
  );
}

interface ConfirmationSlidePanelProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationSlidePanel({ 
  isVisible, 
  onClose, 
  title, 
  description, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm, 
  onCancel,
  isLoading = false
}: ConfirmationSlidePanelProps) {

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <SlidePanel isVisible={isVisible} onClose={handleCancel} title={title} description={description}>
      <div className="slide-actions">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleCancel}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
        <Button 
          onClick={handleConfirm}
          variant={variant === 'destructive' ? 'destructive' : variant === 'warning' ? 'outline' : 'default'}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : confirmText}
        </Button>
      </div>
    </SlidePanel>
  );
}
