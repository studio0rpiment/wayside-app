import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Route components
import Home from './components/routes/Home';
import Onboarding from './components/routes/Onboarding';
import { PermissionsProvider } from './context/PermissionsContext';




import './App.css';



function App() {
  return (
   


    <div className="App">
      <PermissionsProvider> 

          <Router>
              <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/onboarding" element={<Onboarding onComplete={function (): void {
              throw new Error('Function not implemented.');
            } } />} />
              </Routes>
          </Router>


      </PermissionsProvider>
    </div>


    
  );
}

export default App;