// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import './App.css'; // You can create a simple App.css for basic styling

// --- 1. HTTP Cache (Browser Cache) Demonstration ---
function HttpCacheDemo() {
  const imageUrl = 'http://localhost:3001/cached-logo.png';
  const apiDataUrl = 'http://localhost:3001/api/data';
  const [apiData, setApiData] = useState(null);
  const [loadingApi, setLoadingApi] = useState(false);

  const fetchApiData = useCallback(async () => {
    setLoadingApi(true);
    try {
      const response = await fetch(apiDataUrl);
      if (response.status === 304) {
        setApiData(prev => ({ ...prev, message: 'Data is fresh (304 Not Modified)', fromCache: true }));
      } else {
        const data = await response.json();
        setApiData({ ...data, fromCache: false });
      }
    } catch (error) {
      console.error('Error fetching API data:', error);
      setApiData({ message: 'Error fetching data', error: true });
    } finally {
      setLoadingApi(false);
    }
  }, [apiDataUrl]);

  useEffect(() => {
    fetchApiData(); // Initial fetch
  }, [fetchApiData]);


  return (
    <div className="section">
      <h2>1. HTTP Cache (Browser Cache)</h2>
      <p>
        The image below is served with `Cache-Control: public, max-age=3600, immutable`.
        Open your browser's DevTools (F12) &gt; Network tab.
        Refresh the page multiple times. After the first load,
        you should see "disk cache" or "memory cache" under the "Size" column for the image,
        and no network request for it.
      </p>
      <p>
        The API data below has `Cache-Control: public, max-age=10` and `ETag`.
        Watch the Network tab:
        <br/>
        - First load: Status 200.
        <br/>
        - Within 10s: Status 200 (from memory/disk cache, no request if browser optimizes).
        <br/>
        - After 10s, but same ETag: Status 304 Not Modified (request made, but content served from cache).
      </p>
      <img src={imageUrl} alt="Cached Logo" style={{ maxWidth: '100px', border: '1px solid #ccc' }} />
      <p>
        <strong>API Data:</strong> {loadingApi ? 'Loading...' : apiData ? `${apiData.message} (Timestamp: ${apiData.timestamp}) ${apiData.fromCache ? '(304 response, from browser cache)' : ''}` : 'No data'}
      </p>
      <button onClick={fetchApiData} disabled={loadingApi}>
        {loadingApi ? 'Fetching...' : 'Re-fetch API Data (Observe Network Tab)'}
      </button>
    </div>
  );
}

// --- 2. Service Worker (Programmable Cache) Demonstration ---
function ServiceWorkerDemo() {
  const [swApiData, setSwApiData] = useState(null);
  const [swStatus, setSwStatus] = useState('Not Registered');
  const apiEndpoint = 'http://localhost:3001/api/data'; // Same API endpoint as above

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
          setSwStatus('Registered');
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
          setSwStatus('Registration Failed');
        });
    } else {
      setSwStatus('Service Workers not supported in this browser.');
    }
  }, []);

  const fetchSwControlledData = async () => {
    setSwApiData('Loading via Service Worker...');
    try {
      const response = await fetch(apiEndpoint);
      const data = await response.json();
      setSwApiData(`SW Fetched: ${data.message} (Timestamp: ${data.timestamp})`);
      console.log('SW fetch response:', data);
    } catch (error) {
      console.error('Failed to fetch via SW:', error);
      setSwApiData('Failed to fetch via SW. Check console. Probably offline or API is down. Data might be from SW cache.');
    }
  };

  return (
    <div className="section">
      <h2>2. Service Worker (Programmable Cache)</h2>
      <p>
        **Service Worker Status:** {swStatus}
      </p>
      <p>
        This will fetch data from `{apiEndpoint}`. The Service Worker is configured to use a "Cache First, then Network" strategy for this endpoint.
        <br />
        **To test:**
        <br />
        1. Click "Fetch SW Data". Observe initial load (Network Tab).
        <br />
        2. Go to DevTools &gt; Application tab &gt; Service Workers. Check "Offline" checkbox.
        <br />
        3. Refresh the page or click "Fetch SW Data" again. You should still get data, but it will come from the Service Worker's cache.
      </p>
      <button onClick={fetchSwControlledData}>Fetch SW Controlled Data</button>
      <p><strong>SW Data:</strong> {swApiData}</p>
    </div>
  );
}

// --- 3. Web Storage (localStorage & sessionStorage) Demonstration ---
function WebStorageDemo() {
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [tempFormInput, setTempFormInput] = useState(() => sessionStorage.getItem('tempFormInput') || '');

  useEffect(() => {
    // localStorage updates
    localStorage.setItem('username', username);
  }, [username]);

  useEffect(() => {
    // sessionStorage updates
    sessionStorage.setItem('tempFormInput', tempFormInput);
  }, [tempFormInput]);

  const handleClearLocalStorage = () => {
    localStorage.removeItem('username');
    setUsername('');
  };

  const handleClearSessionStorage = () => {
    sessionStorage.removeItem('tempFormInput');
    setTempFormInput('');
  };

  return (
    <div className="section">
      <h2>3. Web Storage (localStorage & sessionStorage)</h2>

      <h3>localStorage (Persists across sessions/tabs)</h3>
      <p>
        Your saved username will persist even if you close and reopen the browser.
        Check DevTools &gt; Application &gt; Local Storage.
      </p>
      <label>
        Username:
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
        />
      </label>
      <p>Stored Username: <strong>{username || 'None'}</strong></p>
      <button onClick={handleClearLocalStorage}>Clear Local Storage Username</button>

      <h3>sessionStorage (Cleared when tab is closed)</h3>
      <p>
        This temporary form input will clear if you close this browser tab,
        but persist if you refresh the page or navigate away and then back within the same tab.
        Check DevTools &gt; Application &gt; Session Storage.
      </p>
      <label>
        Temporary Input:
        <input
          type="text"
          value={tempFormInput}
          onChange={(e) => setTempFormInput(e.target.value)}
          placeholder="Enter temporary data"
        />
      </label>
      <p>Temporary Input Value: <strong>{tempFormInput || 'None'}</strong></p>
      <button onClick={handleClearSessionStorage}>Clear Session Storage Input</button>
    </div>
  );
}


function App() {
  return (
    <div className="App">
      <h1>Client-Side Caching Demo (React)</h1>
      <HttpCacheDemo />
      <hr />
      <ServiceWorkerDemo />
      <hr />
      <WebStorageDemo />
    </div>
  );
}

export default App;