// Quick diagnostic script to check Latent Space integration
// Paste this in the browser console (F12 -> Console tab)

console.log('=== LATENT SPACE DIAGNOSTIC ===');

// Check if React is loaded
console.log('1. React loaded:', typeof React !== 'undefined');

// Check if ThreeGraph component exists
console.log('2. Checking DOM elements...');
const mountRef = document.querySelector('[class*="inset-0 z-0"]');
console.log('   - ThreeGraph mount:', mountRef ? 'Found' : 'NOT FOUND');

// Check for LatentWorld
const latentWorld = document.querySelector('[class*="z-[9999]"]');
console.log('   - LatentWorld:', latentWorld ? 'VISIBLE' : 'Hidden');

// Check for topology indicator
const topoIndicator = document.querySelector('[class*="TOPOLOGY VIEW"]');
console.log('   - Topology indicator:', topoIndicator ? 'Found' : 'NOT FOUND');

// Listen for clicks
console.log('3. Setting up click listener...');
document.addEventListener('click', (e) => {
    console.log('Click detected at:', e.clientX, e.clientY);
    console.log('Target:', e.target);
}, true);

console.log('4. Check browser console for errors (red text)');
console.log('5. Try clicking a node and watch for logs');
console.log('=================================');
