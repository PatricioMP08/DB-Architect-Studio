import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Sincronizar el tema visual ('dark' o 'light') antes de montar el árbol de componentes
const temaGuardado = localStorage.getItem('db_architect_theme') || 'dark';
if (temaGuardado === 'light') {
  document.documentElement.classList.remove('dark');
} else {
  document.documentElement.classList.add('dark');
}

// Montar la aplicación React en el contenedor raíz
const elementoRaiz = document.getElementById('root');
if (elementoRaiz) {
  createRoot(elementoRaiz).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
