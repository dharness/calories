import { useEffect, useMemo, useRef, useState } from "react";

import { apiClient } from "./apiClient";

type SearchResult = {
  fdcId: number;
  description: string;
};

type ApiResponse = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  meta?: Record<string, unknown>;
};

const formatCalories = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(0) : "--";

const DEBOUNCE_MS = 300;

type CalorieLookupModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const CalorieLookupModal = ({ isOpen, onClose }: CalorieLookupModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("g");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const canSubmit = useMemo(() => selectedItem !== null, [selectedItem]);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if an item is selected and input is not focused
    if (selectedItem && document.activeElement !== inputRef.current) {
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearchLoading(true);
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await apiClient.search.query({
          query: searchQuery.trim(),
          limit: 10,
        });
        setSearchResults(result.results);
        // Only show dropdown if input is focused
        if (document.activeElement === inputRef.current) {
          setShowDropdown(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, selectedItem]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleSelectItem = (item: SearchResult) => {
    setSelectedItem(item);
    setSearchQuery(item.description);
    setShowDropdown(false);
    setError(null);
    // Blur the input after selection
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const fetchCalories = async () => {
    if (!selectedItem) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const result = await apiClient.calories.query({
        fdcId: selectedItem.fdcId,
        name: selectedItem.description,
        quantity,
        unit: unit.trim() || "g",
      });
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Calorie Lookup</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="modal-content">
          <section className="card">
            <label className="label">
              Ingredient
              <div className="search-container" ref={dropdownRef}>
                <input
                  ref={inputRef}
                  className="input"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSelectedItem(null);
                    setResult(null);
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowDropdown(true);
                    } else if (searchQuery.trim()) {
                      setShowDropdown(true);
                    }
                  }}
                  placeholder="Type to search for an ingredient..."
                />
                {showDropdown && !selectedItem && (
                  <div className="dropdown">
                    {searchLoading ? (
                      <div className="dropdown-item">Searching...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="dropdown-item muted">No results found</div>
                    ) : (
                      searchResults.map((item) => (
                        <button
                          key={item.fdcId}
                          type="button"
                          className="dropdown-item"
                          onClick={() => handleSelectItem(item)}
                        >
                          {item.description}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedItem && (
                <div className="selected-item">
                  Selected: <strong>{selectedItem.description}</strong>
                </div>
              )}
            </label>

            <div className="row">
              <label className="label">
                Quantity
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>
              <label className="label">
                Unit
                <input
                  className="input"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder="g"
                />
              </label>
            </div>

            <button
              className="button"
              type="button"
              disabled={!canSubmit || loading}
              onClick={fetchCalories}
            >
              {loading ? "Looking up..." : "Get Calories"}
            </button>
          </section>

          <section className="card">
            <h2>Result</h2>
            {error && <div className="error">{error}</div>}
            {!error && !result && !loading && (
              <p className="muted">Enter an ingredient to see calories.</p>
            )}
            {result && (
              <div className="result">
                <div>
                  <strong>{result.name}</strong>
                </div>
                <div>
                  {formatCalories(result.calories)} calories for {result.quantity}{" "}
                  {result.unit}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default CalorieLookupModal;
