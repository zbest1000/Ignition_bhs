import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ProjectList from './pages/ProjectList';
import ProjectEditor from './pages/ProjectEditor';
import socketService from './services/socket';
import './App.css';

const App: React.FC = () => {
  useEffect(() => {
    // Connect to WebSocket on app start
    socketService.connect();

    return () => {
      // Disconnect when app unmounts
      socketService.disconnect();
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 4,
        },
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:projectId" element={<ProjectEditor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

export default App;
