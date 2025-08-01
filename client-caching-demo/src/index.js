// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css'; // Make sure to import your css if it's App.css
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// IMPORTANT: Register your Service Worker here
// This is done in the App.js component's useEffect for demonstration purposes,
// but for a real app, you might do it directly here, possibly after checking if
// in production to use the default CRA service worker or your custom one.
// For this demo, the ServiceWorkerDemo component handles the registration.
// Just ensure the 'public/service-worker.js' file exists.