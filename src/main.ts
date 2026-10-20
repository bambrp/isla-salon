import { mount } from 'svelte';
import gsap from 'gsap';
import App from './App.svelte';
import { salon, rotateView, setStage } from './state';
import './app.css';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

// Visiting the page with ?debug exposes the store so cuts, stages and views can be driven from the console
// or an automated browser. It changes nothing for normal visitors.
if (new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).salonDebug = { salon, rotateView, setStage, gsap };
}

export default mount(App, { target });
