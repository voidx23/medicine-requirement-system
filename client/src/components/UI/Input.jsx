const Input = ({
  label,
  id,
  error,
  type = 'text',
  className = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`} style={{ marginBottom: '1rem' }}>
      {label && (
        <label 
          htmlFor={id} 
          style={{ 
            fontSize: '0.9rem', 
            fontWeight: 500, 
            color: 'var(--text-main)',
            marginBottom: '0.3rem',
            display: 'block'
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        style={{
          width: '100%',
          borderColor: error ? 'var(--danger)' : undefined
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
          {error}
        </span>
      )}
    </div>
  );
};

export default Input;
