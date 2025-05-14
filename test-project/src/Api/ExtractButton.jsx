import React from 'react';

function ExtractButton() {
  const handleExtract = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/extract-code');
      const result = await response.json();
      console.log('Server response:', result);
      alert(result.message); // or update UI as needed
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  return (
    <button onClick={handleExtract}>
      Run Code Extractor
    </button>
  );
}

export default ExtractButton;
