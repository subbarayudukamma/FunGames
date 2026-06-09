import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PlayerEntry from './pages/PlayerEntry';
import Play from './pages/Play';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayerEntry />} />
        <Route path="/play" element={<Play />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
