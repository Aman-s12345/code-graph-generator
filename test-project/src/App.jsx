import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './index.css';
import ExtractButton from './Api/ExtractButton';

// Sample data
const players = [
  { id: 1, name: 'Lionel Messi', position: 'Forward' },
  { id: 2, name: 'Sergio Busquets', position: 'Midfielder' },
  { id: 3, name: 'Gerard Pique', position: 'Defender' },
];

const matches = [
  { id: 1, opponent: 'Real Madrid', date: '2025-05-15' },
  { id: 2, opponent: 'Atletico Madrid', date: '2025-05-22' },
];

export function Players() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Players</h1>
      <ul className="space-y-2">
        {players.map(player => (
          <li key={player.id} className="border p-2 rounded shadow">
            <h2 className="text-xl">{player.name}</h2>
            <p>{player.position}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Matches() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Upcoming Matches</h1>
      <ul className="space-y-2">
        {matches.map(match => (
          <li key={match.id} className="border p-2 rounded shadow">
            <h2 className="text-xl">vs {match.opponent}</h2>
            <p>Date: {match.date}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NavBar() {
  return (
    <>
     <nav className="bg-blue-800 text-white p-4">
      <ul className="flex space-x-4">
        <li><Link to="/players" className="hover:underline">Players</Link></li>
        <li><Link to="/matches" className="hover:underline">Matches</Link></li>
       


      </ul>
    </nav>
    <button><ExtractButton></ExtractButton></button>
    </>
   
    
  );
}

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/players" element={<Players />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="*" element={<Players />} />
       
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// main.jsx
// Ensure this file imports the default App:
// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import App from './App.jsx';
// import './index.css';
//
// ReactDOM.createRoot(document.getElementById('root')).render(<App />);
