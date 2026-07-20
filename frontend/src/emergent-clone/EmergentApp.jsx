import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import Enterprise from './pages/Enterprise';
import Features from './pages/Features';
import FAQs from './pages/FAQs';
import Login from './pages/Login';
import Signup from './pages/Signup';

const withLayout = (Page, { showFooter = true } = {}) => (
  <>
    <Navbar />
    <Page />
    {showFooter && <Footer />}
  </>
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function EmergentApp() {
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    return () => { document.body.style.overflow = ''; document.body.style.height = ''; };
  }, []);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/site" element={withLayout(Landing)} />
        <Route path="/pricing" element={withLayout(Pricing)} />
        <Route path="/enterprise" element={withLayout(Enterprise)} />
        <Route path="/features" element={withLayout(Features)} />
        <Route path="/faqs" element={withLayout(FAQs)} />
        <Route path="/site/login" element={withLayout(Login, { showFooter: false })} />
        <Route path="/site/signup" element={withLayout(Signup, { showFooter: false })} />
      </Routes>
    </>
  );
}
