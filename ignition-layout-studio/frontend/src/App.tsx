import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ProjectList from './pages/ProjectList';
import ProjectEditor from './pages/ProjectEditor';
import ErrorBoundary from './components/ErrorBoundary';
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
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 4,
          },
        }}
      >
        <Router>
          <ErrorBoundary>
            <Routes>
              <Route
                path='/'
                element={
                  <ErrorBoundary>
                    <ProjectList />
                  </ErrorBoundary>
                }
              />
              <Route
                path='/project/:projectId'
                element={
                  <ErrorBoundary>
                    <ProjectEditor />
                  </ErrorBoundary>
                }
              />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </ErrorBoundary>
        </Router>
      </ConfigProvider>
    </ErrorBoundary>
  );
};

export default App;
