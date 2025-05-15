// src/app.js
import React, { useState } from 'react';
import { getInitialMessage, getUpdatedMessage } from './utils';

function App() {
  const [message, setMessage] = useState(getInitialMessage());

  const handleClick = () => {
    setMessage(getUpdatedMessage());
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>{message}</h1>
      <button onClick={handleClick}>Change Greeting</button>
    </div>
  );
}

export default App;
