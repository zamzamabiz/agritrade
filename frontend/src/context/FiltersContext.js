import React, { createContext, useState } from 'react';

export const FiltersContext = createContext(null);

const defaultFilters = {
  product: 'all',
  sort: 'az',
  range: 'all',
  from_month: 'Jan',
  from_year: '25',
  to_month: 'Dec',
  to_year: '25',
};

export const FiltersProvider = ({ children }) => {
  const [filters, setFilters] = useState(defaultFilters);

  const updateFilters = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <FiltersContext.Provider value={{ filters, setFilters, updateFilters, defaultFilters }}>
      {children}
    </FiltersContext.Provider>
  );
};

export default FiltersProvider;
