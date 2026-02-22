'use client';

import { Search } from 'lucide-react';

interface ProductFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
}

export default function ProductFilters({
  searchValue,
  onSearchChange,
  categories,
  selectedCategory,
  onCategorySelect,
}: ProductFiltersProps) {
  return (
    <div className="mb-8 space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search products..."
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Search products"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategorySelect(category)}
            className={`px-6 py-2 rounded-lg font-body font-semibold transition-colors duration-200 cursor-pointer ${
              selectedCategory === category
                ? 'bg-primary text-white'
                : 'bg-white text-text border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
