/**
 * InteractionHandler.js
 * Responsibility: Mouse click, hover, drag, multi-select, raycasting.
 * Extracted from ThreeGraph.jsx (scene setup useEffect, lines ~1964-2160).
 *
 * The interaction logic runs inside the main scene useEffect because it needs
 * direct access to scene, camera, renderer and the component's refs.
 * This module provides the setup function that wires up all event listeners
 * and returns a cleanup function.
 *
 * Usage inside ThreeGraph component:
 *   const cleanup = setupInteractionHandlers(scene, camera, renderer, refs, callbacks);
 *   return cleanup; // inside useEffect return
 */
import * as THREE from 'three';
import { propagateImpact } from '../LatentSpaceLogic.jsx';
import soundSystem from '../../../utils/SoundSystem';
import { logger } from '../../../utils/logger';

/**
 * Wire up mouse interaction handlers (hover, click, drag detection) for the 3D scene.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Scene} scene
 * @param {Object} refs - { nodesRef, edgesRef, hoverNodeRef, selectedNodeRef, layoutModeRef }
 * @param {Object} callbacks - { onNodeClick, onNodeHover, onEdgeHover }
 * @returns {Function} cleanup — call in useEffect return to remove all listeners
 */
export function setupInteractionHandlers(renderer, camera, scene, refs, callbacks) {
    const { nodesRef, edgesRef, hoverNodeRef, selectedNodeRef, layoutModeRef } = refs;
    const { onNodeClick, onNodeHover, onEdgeHover } = callbacks;

    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 4.0;

    const onMouseMove = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            let foundNode = null;

            for (let i = 0; i < intersects.length; i++) {
                const intersection = intersects[i];
                let object = intersection.object;

                // InstancedMesh support
                if (object.isInstancedMesh && intersection.instanceId !== undefined) {
                    const node = nodesRef.current.find((n) => n.instanceId === intersection.instanceId);
                    if (node) { foundNode = node; break; }
                }

                // Legacy traversal
                let traverser = object;
                while (traverser) {
                    if (traverser.userData?.isNode) { foundNode = traverser.userData; break; }
                    traverser = traverser.parent;
                }
                if (foundNode) break;
            }

            if (foundNode && foundNode !== hoverNodeRef.current) {
                hoverNodeRef.current = foundNode;
                document.body.style.cursor = 'pointer';
                onNodeHover?.(foundNode);
                onEdgeHover?.(null);
                soundSystem.playMetricOscillation?.(foundNode.importance_score || 1.0, foundNode.node_glow || 0.5);
            } else if (!foundNode) {
                // Check for edge intersection
                let foundEdge = null;
                for (let i = 0; i < intersects.length; i++) {
                    const { object: obj, } = intersects[i];
                    const ud = obj.userData;
                    if (obj.type === 'Line' && ud?.sourceId && ud?.targetId) {
                        foundEdge = {
                            isEdge: true,
                            data: ud.edgeData || {},
                            sourceNode: nodesRef.current.find((n) => n.id === (typeof ud.sourceId === 'object' ? ud.sourceId.id : ud.sourceId)),
                            targetNode: nodesRef.current.find((n) => n.id === (typeof ud.targetId === 'object' ? ud.targetId.id : ud.targetId)),
                            mousePos: { x: e.clientX, y: e.clientY },
                        };
                        break;
                    }
                }
                document.body.style.cursor = foundEdge ? 'pointer' : 'default';
                onEdgeHover?.(foundEdge || null);
            }
        } else {
            if (hoverNodeRef.current) { hoverNodeRef.current = null; onNodeHover?.(null); }
            onEdgeHover?.(null);
            document.body.style.cursor = 'default';
        }
    };

    let mouseDownPos = { x: 0, y: 0 };
    const onMouseDown = (e) => { mouseDownPos = { x: e.clientX, y: e.clientY }; };

    const onClick = (event) => {
        const dx = event.clientX - mouseDownPos.x;
        const dy = event.clientY - mouseDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return; // drag — ignore

        if (hoverNodeRef.current) {
            const node = hoverNodeRef.current;
            logger.debug('ThreeGraph: Node Clicked -', node.name);
            selectedNodeRef.current = node;

            if (layoutModeRef.current === 'latent') {
                const impactedIds = propagateImpact(node.id, nodesRef.current);
                nodesRef.current.forEach((n) => {
                    if (impactedIds.has(n.id) && n.mesh) {
                        const originalColor = new THREE.Color(n.latent_color || '#11ff44');
                        n.mesh.material.color.set('#ff8800');
                        if (n.mesh.material.emissive) {
                            n.mesh.material.emissive.set('#ff4400');
                            n.mesh.material.emissiveIntensity = 1.0;
                        }
                        n.isImpacted = true;
                        setTimeout(() => {
                            if (n.mesh?.material) {
                                n.mesh.material.color.copy(originalColor);
                                if (n.mesh.material.emissive) {
                                    n.mesh.material.emissive.setHex(0x000000);
                                    n.mesh.material.emissiveIntensity = 0.5;
                                }
                                n.isImpacted = false;
                            }
                        }, 2000);
                    }
                });
            }

            event.stopPropagation();
            event.preventDefault();
            soundSystem.play?.('nodeClick');
            onNodeClick?.(node, event.shiftKey);
        } else {
            selectedNodeRef.current = null;
        }
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('click', onClick);

    // Return cleanup function
    return () => {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('click', onClick);
    };
}
