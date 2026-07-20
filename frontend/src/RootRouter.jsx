import { useLocation } from 'react-router-dom';
import App from './App.jsx';
import EmergentApp from './emergent-clone/EmergentApp.jsx';

const publicPrefixes = ['/site', '/pricing', '/features', '/faqs', '/enterprise'];

export default function RootRouter() {
  const { pathname } = useLocation();
  const isPublic = publicPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (isPublic) return <EmergentApp />;
  return <App />;
}
