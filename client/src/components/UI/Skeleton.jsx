/**
 * Skeleton - Reusable shimmer placeholder
 *
 * Props:
 *  width       - CSS width  (default: '100%')
 *  height      - CSS height (default: '1rem')
 *  borderRadius- CSS border-radius (default: '6px')
 *  count       - repeat N times in a column (default: 1)
 *  style       - extra inline styles
 */
const Skeleton = ({ width = '100%', height = '1rem', borderRadius = '6px', count = 1, style = {} }) => {
  const base = {
    width,
    height,
    borderRadius,
    ...style,
  };

  if (count === 1) {
    return <div className="skeleton" style={base} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={base} />
      ))}
    </div>
  );
};

/* ─── Composed skeleton layouts ─────────────────────────────────────────── */

/** A single horizontal request/history card row */
export const RequestCardSkeleton = () => (
  <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <Skeleton width="4px" height="40px" borderRadius="2px" style={{ flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <Skeleton width="40%" height="1rem" style={{ marginBottom: '0.5rem' }} />
      <Skeleton width="60%" height="0.75rem" />
    </div>
    <Skeleton width="100px" height="24px" borderRadius="12px" />
    <Skeleton width="24px" height="24px" borderRadius="4px" />
  </div>
);

/** A card for task grids */
export const TaskCardSkeleton = () => (
  <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton width="50%" height="1.1rem" borderRadius="6px" />
      <Skeleton width="70px" height="22px" borderRadius="12px" />
    </div>
    <Skeleton width="90%" height="0.8rem" />
    <Skeleton width="70%" height="0.8rem" />
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
      <Skeleton width="80px" height="22px" borderRadius="20px" />
      <Skeleton width="80px" height="22px" borderRadius="20px" />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
      <Skeleton width="100px" height="0.75rem" />
      <Skeleton width="32px" height="32px" borderRadius="50%" />
    </div>
  </div>
);

/** Table rows for Medicines / ManageStaff */
export const TableRowSkeleton = ({ cols = 3, rows = 8 }) => (
  <tbody>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} style={{ padding: '0.85rem 1rem' }}>
            <Skeleton height="0.85rem" width={j === 0 ? '30%' : '70%'} />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

/** History page card skeleton */
export const HistoryCardSkeleton = () => (
  <div className="glass-panel" style={{ padding: '1.5rem' }}>
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      <Skeleton width="80px" height="80px" borderRadius="12px" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <Skeleton width="55%" height="1.1rem" style={{ marginBottom: '0.6rem' }} />
        <Skeleton width="35%" height="0.8rem" style={{ marginBottom: '0.75rem' }} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Skeleton width="60px" height="20px" borderRadius="4px" />
          <Skeleton width="80px" height="20px" borderRadius="4px" />
          <Skeleton width="70px" height="20px" borderRadius="4px" />
        </div>
      </div>
    </div>
  </div>
);

/** Dashboard list item skeleton */
export const DashboardRowSkeleton = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
    <Skeleton width="28px" height="28px" borderRadius="6px" style={{ flexShrink: 0 }} />
    <Skeleton width="50%" height="0.9rem" />
    <Skeleton width="80px" height="0.8rem" style={{ marginLeft: 'auto' }} />
    <Skeleton width="32px" height="32px" borderRadius="8px" style={{ flexShrink: 0 }} />
  </div>
);

/** Audit table skeleton */
export const AuditTableSkeleton = ({ rows = 6 }) => (
  <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
    <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between' }}>
      <Skeleton width="180px" height="1.2rem" />
      <Skeleton width="120px" height="0.9rem" />
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.06)' }}>
          {['Date', 'Branch', 'Quantity', 'Status'].map(h => (
            <th key={h} style={{ padding: '1.25rem 1.5rem', textAlign: 'left' }}>
              <Skeleton width="80px" height="0.8rem" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <td style={{ padding: '1.1rem 1.5rem' }}><Skeleton width="100px" height="0.85rem" /></td>
            <td style={{ padding: '1.1rem 1.5rem' }}><Skeleton width="120px" height="0.85rem" /></td>
            <td style={{ padding: '1.1rem 1.5rem' }}><Skeleton width="50px" height="0.85rem" /></td>
            <td style={{ padding: '1.1rem 1.5rem' }}><Skeleton width="90px" height="22px" borderRadius="20px" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Feedback card skeleton (AdminFeedback accordion row) */
export const FeedbackCardSkeleton = () => (
  <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <Skeleton width="40px" height="40px" borderRadius="12px" style={{ flexShrink: 0 }} />
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
          <Skeleton width="70px" height="0.85rem" />
          <Skeleton width="80px" height="0.75rem" />
        </div>
        <Skeleton width="280px" height="0.8rem" />
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
      <Skeleton width="90px" height="0.8rem" />
      <Skeleton width="20px" height="20px" borderRadius="4px" />
    </div>
  </div>
);



export default Skeleton;
