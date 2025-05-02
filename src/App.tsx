import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Route components
import Home from './components/routes/Home';
import Onboarding from './components/routes/Onboarding';
import Map from './components/routes/Map';
import WaterLevel from './components/routes/WaterLevel';
import Lotus from './components/routes/Lotus';
import Mac from './components/routes/Mac';
import { PermissionsProvider } from './context/PermissionsContext.tsx';
import AppThemeProvider from './theme/ThemeProvider';

import './App.css';

// Wrapper component to provide navigation functionality
function OnboardingWrapper() {
  const navigate = useNavigate();
  
  const handleComplete = () => {
    // This function should only be called when the user explicitly completes onboarding
    // by clicking the "Start Experience" button
    navigate('/map');
  };
  
  return <Onboarding onComplete={handleComplete} />;
}

function App() {

  useEffect(() => {
    console.log("App mounted - initializing permissions");
    // This will force a log to appear even if nothing else is working
  }, []);
  
  return (
    <div className="App">
      <AppThemeProvider>
        <PermissionsProvider> 
          <Router>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/onboarding" element={<OnboardingWrapper />} />
              <Route path="/map" element={<Map />} />
              <Route path="/water-level" element={<WaterLevel />} />
              <Route path="/lotus" element={<Lotus />} />
              <Route path="/mac" element={<Mac />} />
            </Routes>
          </Router>
        </PermissionsProvider>
      </AppThemeProvider>
    </div>
  );
}

export default App;