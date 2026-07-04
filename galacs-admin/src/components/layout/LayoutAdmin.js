import React from 'react';
import SidebarAdmin from './SidebarAdmin';
import TopbarAdmin from './TopbarAdmin';

const LayoutAdmin = ({ children }) => {
  return (
    <div id="app">
      <SidebarAdmin />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopbarAdmin />
        <div id="page-area" style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default LayoutAdmin;