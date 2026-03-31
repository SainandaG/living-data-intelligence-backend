/**
 * SceneSetup.js
 * Responsibility: Scene atmosphere — skydome, infinite dust starfield, neural core halo,
 * soft sprite textures, and the disposeObject utility.
 * Extracted from ThreeGraph.jsx lines 590-800.
 *
 * Exports:
 *   createUniversalSkydome(scene)
 *   createInfiniteDustLayer(scene)
 *   createSoftSpriteTexture(size, type)
 *   createStarfield(scene, nodes)
 *   createNeuralCoreHalo(scene)
 *   disposeObject(obj)
 *   InfiniteDustShader
 *   UniversalSkydomeShader
 */
import * as THREE from 'three';
import { logger } from '../../../utils/logger';

import { SeededRNG } from '../../../utils/mathUtils';

// --- "Infinite Atmosphere" Shader-driven Skydome & Dust ---
const InfiniteDustShader = {
    uniforms: {
        uTime: { value: 0 },
        uCameraPos: { value: new THREE.Vector3() },
        uBoundary: { value: 40000.0 }, // Size of the local wrapping volume
        uTexture: { value: null },
        uOpacity: { value: 0.8 },
        uMinSize: { value: 1.5 } // Keep stars visible even at distance
    },
    vertexShader: `
        uniform float uTime;
        uniform vec3 uCameraPos;
        uniform float uBoundary;
        uniform float uMinSize;
        varying float vOpacity;
        
        void main() {
            vec3 pos = position;
            vec3 halfBound = vec3(uBoundary * 0.5);
            vec3 offsetPos = pos - uCameraPos;
            
            // Custom Modulo wrapping
            vec3 wrappedPos = mod(offsetPos + halfBound, uBoundary) - halfBound;
            vec3 finalPos = uCameraPos + wrappedPos;
            
            float dist = length(wrappedPos);
            // Softer falloff for "infinite" feel
            vOpacity = smoothstep(uBoundary * 0.5, uBoundary * 0.35, dist);
            
            vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
            // Enhanced size attenuation: Base size + distance based + constant minimum
            gl_PointSize = uMinSize + (30.0 * (1000.0 / -mvPosition.z)); 
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uOpacity;
        varying float vOpacity;
        
        void main() {
            vec4 tex = texture2D(uTexture, gl_PointCoord);
            if (tex.a < 0.1) discard;
            // Boost brightness for "Real Star" look
            gl_FragColor = vec4(tex.rgb * 1.5, tex.a * uOpacity * vOpacity);
        }
    `
};

const UniversalSkydomeShader = {
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec3 viewDir = normalize(vWorldPosition);
            float height = viewDir.y;
            
            // Deep Space Palette (Blacker Base)
            vec3 deepSpace = vec3(0.0, 0.0, 0.001);
            vec3 horizonBlue = vec3(0.001, 0.002, 0.005);
            vec3 nebulaPurple = vec3(0.002, 0.001, 0.005);
            
            // Subtle Organic Gradient (Atmosphere simulation)
            vec3 atmosphere = mix(deepSpace, horizonBlue, exp(-abs(height) * 4.0));
            atmosphere = mix(atmosphere, nebulaPurple, max(0.0, sin(viewDir.x * 2.0 + viewDir.z * 3.0) * 0.1));
            
            gl_FragColor = vec4(atmosphere, 1.0);
        }
    `
};

function createUniversalSkydome(scene) {
    const geometry = new THREE.SphereGeometry(1.5e5, 32, 32);
    const material = new THREE.ShaderMaterial({
        vertexShader: UniversalSkydomeShader.vertexShader,
        fragmentShader: UniversalSkydomeShader.fragmentShader,
        side: THREE.BackSide,
        depthWrite: false
    });
    const skydome = new THREE.Mesh(geometry, material);
    skydome.userData = { isBackground: true, isAtmos: true };
    scene.add(skydome);
    return skydome;
}

function createInfiniteDustLayer(scene) {
    const count = 50000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const rng = new SeededRNG("infinite-dust-v2"); // New seed for fresh distribution

    const bound = 40000.0;
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (rng.next() - 0.5) * bound;
        positions[i * 3 + 1] = (rng.next() - 0.5) * bound;
        positions[i * 3 + 2] = (rng.next() - 0.5) * bound;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(InfiniteDustShader.uniforms),
        vertexShader: InfiniteDustShader.vertexShader,
        fragmentShader: InfiniteDustShader.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const starTexture = createSoftSpriteTexture(64, 'star');
    mat.uniforms.uTexture.value = starTexture;

    const points = new THREE.Points(geometry, mat);
    points.userData = { isInfiniteDust: true };
    scene.add(points);
    return points;
}

function createSoftSpriteTexture(size = 128, type = 'star') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);

    if (type === 'nebula') {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createStarfield(scene, nodes = []) {
    // REMOVED IN FAVOR OF WRAPPING INFINITE DUST
    return new THREE.Group();
}

// --- Neural Core Halo: Prevents "White Dot" look at distance ---
function createNeuralCoreHalo(scene) {
    const texture = createSoftSpriteTexture(512, 'nebula');
    const mat = new THREE.SpriteMaterial({
        map: texture,
        color: 0x00d4ff, // Cyan but darker
        transparent: true,
        opacity: 0.15, // More subtle
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4000, 4000, 1); // Slightly smaller halo
    sprite.position.set(0, 0, 0);
    sprite.userData = { isHalo: true };

    // Pulse animation logic will be added via userData
    scene.add(sprite);
    return sprite;
}

// Helper to properly dispose of Three.js objects
const disposeObject = (obj) => {
    if (!obj) return;

    // Recursive disposal for children (e.g. labels, shells)
    if (obj.children) {
        [...obj.children].forEach(child => disposeObject(child));
    }

    if (obj.geometry) obj.geometry.dispose();

    if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(m => {
            // Standard maps
            if (m.map) m.map.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            if (m.roughnessMap) m.roughnessMap.dispose();
            if (m.metalnessMap) m.metalnessMap.dispose();
            if (m.normalMap) m.normalMap.dispose();
            if (m.alphaMap) m.alphaMap.dispose();
            if (m.aoMap) m.aoMap.dispose();
            if (m.bumpMap) m.bumpMap.dispose();
            if (m.displacementMap) m.displacementMap.dispose();
            if (m.lightMap) m.lightMap.dispose();
            if (m.envMap) m.envMap.dispose();

            m.dispose();
        });
    }
};


export {
    createUniversalSkydome,
    createInfiniteDustLayer,
    createSoftSpriteTexture,
    createStarfield,
    createNeuralCoreHalo,
    disposeObject,
    InfiniteDustShader,
    UniversalSkydomeShader,
};
