import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import RootRouter from './RootRouter.jsx'
import DeepAnalysisPage from './components/Dashboard/DeepAnalysisPage.jsx'
import DeepSelectionPage from './components/Dashboard/DeepSelectionPage.jsx'

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
        <RootRouter />
      </BrowserRouter>
    )}
  </StrictMode>,
)
