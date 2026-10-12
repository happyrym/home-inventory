import { useEffect } from 'preact/hooks';
import { Gate } from './pages/Gate';
import { Home } from './pages/Home';
import { ItemEdit } from './pages/ItemEdit';
import { Join } from './pages/Join';
import { PlaceItems } from './pages/PlaceItems';
import { Places } from './pages/Places';
import { Settings } from './pages/Settings';
import { matchRoute, navigate, useRoute } from './router';
import { boot, gate } from './state';

export function App() {
  const route = useRoute();
  useEffect(() => { boot(); }, []);

  const g = gate.value;
  if (g.kind === 'no-code' || route.path === '/join') return <Join params={route.params} />;
  if (g.kind !== 'allowed') return <Gate state={g} />;

  let m: Record<string, string> | null;
  if (route.path === '/') return <Home />;
  if ((m = matchRoute('/item/:id', route.path))) return <ItemEdit key={m.id} id={m.id} params={route.params} />;
  if (route.path === '/places') return <Places />;
  if ((m = matchRoute('/place/:id', route.path))) return <PlaceItems id={m.id} />;
  if (route.path === '/settings') return <Settings />;
  return <main class="page center"><p>없는 페이지</p><button onClick={() => navigate('/')}>홈으로</button></main>;
}
