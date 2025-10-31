import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { enableMocking } from './mocks'

// Запуск MSW перед рендером приложения
enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
