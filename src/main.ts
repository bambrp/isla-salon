import { mount } from 'svelte';
import gsap from 'gsap';
import App from './App.svelte';
import {
  chooseLength,
  cutSwipe,
  rotateView,
  salon,
  selectCutTarget,
  setColour,
  setColourMode,
  setCurl,
  setLength,
  setStage,
  setStyleProduct,
  setCharacterLook,
  randomiseLook,
  resetLook,
  switchCharacter,
} from './state';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

// Visiting the page with ?debug exposes the store so cuts, stages and views can be driven from the console
// or an automated browser. It changes nothing for normal visitors.
if (new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).salonDebug = {
    salon,
    chooseLength,
    cutSwipe,
    rotateView,
    setStage,
    setColour,
    setColourMode,
    selectCutTarget,
    setLength,
    setCurl,
    setStyleProduct,
    setCharacterLook,
    randomiseLook,
    resetLook,
    switchCharacter,
    gsap,
  };
}

// Keep a copy of the whole game in the browser so it opens and plays with no network, once it has loaded once.
// Skipped for the debug and still pages, which automated checks load fresh each time.
const params = new URLSearchParams(window.location.search);
if ('serviceWorker' in navigator && !params.has('debug') && !params.has('still') && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline play is a bonus; the game works without it */
    });
  });
}

export default mount(App, { target });
