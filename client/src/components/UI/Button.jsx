import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  type = 'button', 
  isLoading = false, 
  icon: Icon,
  disabled,
  onClick,
  className = '',
  ...props 
}, ref) => {
  const baseClass = 'btn';
  const variantClass = `btn-${variant}`;
  
  return (
    <button
      ref={ref}
      type={type}
      className={`${baseClass} ${variantClass} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      style={{ opacity: disabled || isLoading ? 0.7 : 1 }}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin" size={18} />
      ) : Icon ? (
        <Icon size={18} />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
