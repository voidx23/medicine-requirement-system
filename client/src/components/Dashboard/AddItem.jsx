import { useState, useEffect, useRef } from 'react';
import { Search, Plus } from 'lucide-react';
import api from '../../services/api';
import Button from '../UI/Button';

const AddItem = ({ onAdd }) => {
  const [medicines, setMedicines] = useState([]); // Filtered results
  const [allMedicines, setAllMedicines] = useState([]); // Master list
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // 1. Fetch ALL medicines on mount (with Caching)
  useEffect(() => {
    const fetchAll = async () => {
        // Try to load from cache first for instant load
        const cached = localStorage.getItem('cachedMedicinesMasterList');
        if (cached) {
            try {
                setAllMedicines(JSON.parse(cached));
            } catch (e) {
                console.error("Cache parse error", e);
            }
        }

        try {
            const res = await api.get('/medicines?limit=all');
            const meds = res.data.medicines || [];
            if (meds.length > 0) {
                setAllMedicines(meds);
                localStorage.setItem('cachedMedicinesMasterList', JSON.stringify(meds));
            }
        } catch (err) {
            console.error('Failed to load medicines', err);
        }
    };
    fetchAll();
  }, []);

  // 2. Client-side Filter
  useEffect(() => {
    if (!searchTerm.trim()) {
        setMedicines([]);
        setIsOpen(false);
        return;
    }

    const lower = searchTerm.toLowerCase();
    const filtered = allMedicines.filter(m => 
        m.name.toLowerCase().includes(lower) || 
        m.barcode?.includes(lower)
    ).slice(0, 10); // Limit to 10 for display

    setMedicines(filtered);
    setIsOpen(true);
  }, [searchTerm, allMedicines]);



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
            aria-label="Add selected medicine"
        >
             <Plus size={20} />
        </Button>
      </div>

      {isOpen && searchTerm && (
        <div 
            className="glass-panel"
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
            {medicines.length > 0 ? (
                medicines.map((medicine, index) => (
                    <button
                        key={medicine._id}
                        onClick={() => handleSelect(medicine)}
                        aria-label={`Select ${medicine.name}`}
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

        </div>
      )}
    </div>
  );
};

export default AddItem;
