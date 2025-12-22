import { useState, useEffect, useRef } from 'react';
import { Search, Plus } from 'lucide-react';
import api from '../../services/api';
import Button from '../UI/Button';

const AddItem = ({ onAdd }) => {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchMedicines = async (currPage, term, isNewSearch) => {
    if (!term.trim()) {
        setMedicines([]);
        return;
    }
    
    setLoading(true);
    try {
        const res = await api.get(`/medicines?search=${term}&page=${currPage}&limit=10`);
        const newItems = res.data.medicines || res.data || [];
        const totalPages = res.data.totalPages || 1;
        
        setMedicines(prev => {
            // Filter duplicates just in case
            const combined = isNewSearch ? newItems : [...prev, ...newItems];
            const unique = combined.filter((item, index, self) => 
                index === self.findIndex((t) => (
                    t._id === item._id
                ))
            );
            return unique;
        });
        
        setHasMore(currPage < totalPages);
        if (isNewSearch && newItems.length > 0) setIsOpen(true);
    } catch (err) {
        console.error('Failed to search medicines', err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
        if(searchTerm.trim()) {
            setPage(1);
            setHasMore(true);
            fetchMedicines(1, searchTerm, true);
        } else {
            setMedicines([]);
        }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
      // Load more when page increments
      if (page > 1) {
          fetchMedicines(page, searchTerm, false);
      }
  }, [page]);

  const handleScroll = (e) => {
      const { scrollTop, clientHeight, scrollHeight } = e.target;
      if (scrollHeight - scrollTop <= clientHeight + 50) { // Load when close to bottom
          if (!loading && hasMore) {
              setPage(prev => prev + 1);
          }
      }
  };

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (medicine) => {
      if (!medicine) return;
      
      // OPTIMISTIC: Don't wait. Fire and forget.
      onAdd(medicine);
      
      // Reset UI immediately
      setSearchTerm('');
      setIsOpen(false);
      setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || medicines.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % medicines.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + medicines.length) % medicines.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        handleSelect(medicines[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '500px', marginBottom: '2rem' }}>
      <div 
        className="glass-panel"
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0.5rem',
            paddingLeft: '1rem',
            borderRadius: '50px' // Pill shape
        }}
      >
        <Search size={20} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
        <input
            type="text"
            placeholder="Search medicine to add..."
            value={searchTerm}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(-1);
            }}
            onFocus={() => {
                if (medicines.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                flex: 1,
                fontSize: '1rem',
                minWidth: 0
            }}
        />
        <Button 
            disabled={!searchTerm} 
            className="btn-icon"
            style={{ borderRadius: '50%', padding: '0.5rem' }}
        >
             <Plus size={20} />
        </Button>
      </div>

      {isOpen && searchTerm && (
        <div 
            className="glass-panel"
            onScroll={handleScroll}
            style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                right: 0,
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 50,
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '0.5rem'
            }}
        >
            {loading && page === 1 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Searching...
                </div>
            ) : medicines.length > 0 ? (
                medicines.map((medicine, index) => (
                    <button
                        key={medicine._id}
                        onClick={() => handleSelect(medicine)}
                        style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.75rem',
                            border: 'none',
                            background: highlightedIndex === index ? 'var(--primary-light)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderRadius: '8px',
                            transition: 'background 0.2s',
                            color: 'var(--text-main)'
                        }}
                        onMouseOver={() => setHighlightedIndex(index)}
                        onMouseOut={() => setHighlightedIndex(-1)}
                    >
                        <span style={{ fontWeight: 500 }}>{medicine.name}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {medicine.supplierId?.name}
                        </span>
                    </button>
                ))
            ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No medicines found.
                </div>
            )}
            {loading && page > 1 && (
                 <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                     Loading more...
                 </div>
            )}
        </div>
      )}
    </div>
  );
};

export default AddItem;
