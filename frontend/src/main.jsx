import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import DeepAnalysisPage from './components/Dashboard/DeepAnalysisPage.jsx'

// Route /deep-analysis to its own standalone page (opened in new tab from WorkOnDataModal).
// All other paths go through the main App shell unchanged.
const isDeepAnalysis = window.location.pathname.startsWith('/deep-analysis')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDeepAnalysis ? (
      <DeepAnalysisPage />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)