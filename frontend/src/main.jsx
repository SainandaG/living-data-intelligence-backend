import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import DeepAnalysisPage from './components/Dashboard/DeepAnalysisPage.jsx'
import DeepSelectionPage from './components/Dashboard/DeepSelectionPage.jsx'

// Route /deep-analysis to its own standalone page (opened in new tab from WorkOnDataModal).
// Route /deep-selection to its own standalone page for metric picking.
// All other paths go through the main App shell unchanged.
const isDeepAnalysis = window.location.pathname.startsWith('/deep-analysis')
const isDeepSelection = window.location.pathname.startsWith('/deep-selection')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDeepAnalysis ? (
      <DeepAnalysisPage />
    ) : isDeepSelection ? (
      <DeepSelectionPage />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)