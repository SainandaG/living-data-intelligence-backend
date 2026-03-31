import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * RelationshipImpactLabel
 * -----------------------
 * Renders floating HTML labels at the midpoint of each FK edge.
 *
 * Since ThreeGraph uses vanilla Three.js (not @react-three/fiber),
 * this component manually projects 3D world positions to 2D screen
 * coordinates via its own requestAnimationFrame loop — functionally
 * identical to @react-three/drei's <Html> component.
 *
 * Labels only appear when `businessRole` is truthy.
 */

const IMPACT_COLORS = {
    CRITICAL: '#FF4D6D',
    IMPORTANT: '#FFD166',
    LOW: '#4A5568',
};

export default function RelationshipImpactLabel({
    relationships,     // Array from businessLensData.relationships
    nodesRef,          // ref to ThreeGraph's nodesRef.current
    cameraRef,         // ref to the Three.js camera
    rendererRef,       // ref to the Three.js renderer
    businessRole,      // 'ceo' | 'analyst' | 'tech' | null
    selectedNodeRef,   // Ref to currently clicked node
    hoverNodeRef,      // Ref to currently hovered node
}) {
    const containerRef = useRef(null);
    const labelsRef = useRef([]);   // {el, source, target} entries
    const frameRef = useRef(null);

    // ── Create / Destroy label DOM elements ──────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Clear previous labels
        labelsRef.current.forEach(l => l.el.remove());
        labelsRef.current = [];

        if (!businessRole || !relationships || relationships.length === 0) {
            return;
        }

        // Create a label element for each relationship
        relationships.forEach(rel => {
            const borderColor = IMPACT_COLORS[rel.impact_level] || IMPACT_COLORS.LOW;

            const el = document.createElement('div');
            el.className = 'biz-impact-label';
            el.style.cssText = `
                position: absolute;
                top: 0; left: 0;
                transform: translate(-50%, -50%);
                pointer-events: none;
                background: rgba(0, 0, 0, 0.82);
                border: 1px solid ${borderColor};
                border-radius: 6px;
                padding: 4px 10px;
                font-family: 'Inter', 'SF Pro', system-ui, sans-serif;
                font-size: 11px;
                max-width: 180px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                backdrop-filter: blur(6px);
                transition: transform 0.15s ease, opacity 0.2s ease;
                opacity: 0;
                z-index: 10;
                display: flex;
                align-items: center;
                gap: 6px;
            `;

            // Level badge
            const badge = document.createElement('span');
            badge.textContent = rel.impact_level;
            badge.style.cssText = `
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 0.8px;
                text-transform: uppercase;
                color: ${borderColor};
                flex-shrink: 0;
            `;

            // Label text (truncated for long labels)
            const text = document.createElement('span');
            // Show shorter version: just the count part
            const shortLabel = rel.impact_label.length > 40
                ? rel.impact_label.slice(0, 38) + '…'
                : rel.impact_label;
            text.textContent = shortLabel;
            text.style.cssText = `
                font-size: 10px;
                color: rgba(255, 255, 255, 0.7);
                overflow: hidden;
                text-overflow: ellipsis;
            `;

            el.appendChild(badge);
            el.appendChild(text);
            container.appendChild(el);

            labelsRef.current.push({
                el,
                source: rel.source,
                target: rel.target,
            });
        });

        // Fade in after a frame
        requestAnimationFrame(() => {
            labelsRef.current.forEach(l => {
                l.el.style.opacity = '1';
            });
        });

        return () => {
            labelsRef.current.forEach(l => l.el.remove());
            labelsRef.current = [];
        };
    }, [businessRole, relationships]);

    // ── Projection loop: 3D → 2D every frame ────────────────
    useEffect(() => {
        if (!businessRole || labelsRef.current.length === 0) {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            return;
        }

        const tempVec = new THREE.Vector3();

        const projectLabels = () => {
            const camera = cameraRef?.current;
            const renderer = rendererRef?.current;
            const nodes = nodesRef?.current;

            if (!camera || !renderer || !nodes || nodes.length === 0) {
                frameRef.current = requestAnimationFrame(projectLabels);
                return;
            }

            const canvas = renderer.domElement;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;

            labelsRef.current.forEach(label => {
                const src = nodes.find(n => n.id === label.source);
                const tgt = nodes.find(n => n.id === label.target);

                if (!src || !tgt) {
                    label.el.style.display = 'none';
                    return;
                }

                // Dynamic Filtering based on selection (60FPS instead of expensive React re-renders)
                const activeId = selectedNodeRef?.current?.id || hoverNodeRef?.current?.id;

                // We want the label to float directly above the CONNECTED table, NOT in the middle of the edge
                const targetNode = src.id === activeId ? tgt : src;

                const targetX = targetNode.x;
                const targetY = targetNode.y + 2.0; // lifted safely above the node geometry
                const targetZ = targetNode.z;

                if (!activeId) {
                    label._isActiveForFrame = false;
                    label.el.style.display = 'none';
                    return;
                }

                if (label.source !== activeId && label.target !== activeId) {
                    label._isActiveForFrame = false;
                    label.el.style.display = 'none';
                    return;
                }

                // Add sorting metadata
                label._isActiveForFrame = true;
                label._impactScore = label.el.textContent.includes('CRITICAL') ? 3 :
                    label.el.textContent.includes('IMPORTANT') ? 2 : 1;

                tempVec.set(targetX, targetY, targetZ);
                tempVec.project(camera);

                // Behind camera? Hide it
                if (tempVec.z > 1) {
                    label._isActiveForFrame = false;
                    label.el.style.display = 'none';
                    return;
                }

                label._screenX = (tempVec.x * 0.5 + 0.5) * w;
                label._screenY = (-tempVec.y * 0.5 + 0.5) * h;

                // Distance-based opacity fade (labels fade at extreme distance)
                const depth = Math.abs(tempVec.z);
                label._opacity = depth > 0.999 ? 0.3 : 1.0;
            });

            // Cap at top 5 labels
            const activeLabels = labelsRef.current.filter(l => l._isActiveForFrame);

            // Sort by impact score descending
            activeLabels.sort((a, b) => b._impactScore - a._impactScore);

            // Apply visibility and transforms
            activeLabels.forEach((label, index) => {
                if (index < 5) {
                    label.el.style.display = 'flex';
                    label.el.style.transform = `translate(${label._screenX}px, ${label._screenY}px) translate(-50%, -50%)`;
                    label.el.style.opacity = String(label._opacity);
                    // slightly higher z-index for more critical labels so they render on top
                    label.el.style.zIndex = String(20 - index);
                } else {
                    label.el.style.display = 'none';
                }
            });

            frameRef.current = requestAnimationFrame(projectLabels);
        };

        frameRef.current = requestAnimationFrame(projectLabels);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [businessRole, cameraRef, rendererRef, nodesRef]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 10,
                overflow: 'hidden',
            }}
        />
    );
}
